import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  AlertTriangle,
  Eye,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  CheckCircle2,
  Clock3,
  UserRound,
} from "lucide-react";
import Toast from "./Toast";
import Footer from "./Footer";

function formatDate(value) {
  if (!value) return "Unknown date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusTone(status) {
  if (status === "pending") {
    return {
      badge: "bg-amber-500/10 text-amber-300 border border-amber-500/20",
      panel: "border-amber-500/20 bg-amber-500/[0.04]",
    };
  }

  if (status === "removed") {
    return {
      badge: "bg-red-500/10 text-red-300 border border-red-500/20",
      panel: "border-red-500/20 bg-red-500/[0.04]",
    };
  }

  return {
    badge: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20",
    panel: "border-emerald-500/20 bg-emerald-500/[0.04]",
  };
}

export default function AdminModeration({ user, onBack, onMemeDeleted }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [pendingDeleteReport, setPendingDeleteReport] = useState(null);
  const [toast, setToast] = useState(null);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return undefined;

    const timer = window.setTimeout(() => {
      clearToast();
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [toast, clearToast]);

  const pushToast = useCallback((nextToast) => {
    setToast({ ...nextToast, onClose: clearToast });
  }, [clearToast]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reports")
        .select('id, user_id, meme_id, reason, status, created_at, meme:"meme-table"(id, title, image_url, user_id)')
        .order("created_at", { ascending: false });

      if (error) throw error;

      const reportRows = data || [];
      const reporterIds = [...new Set(reportRows.map((report) => report.user_id).filter(Boolean))];

      let reporterLookup = {};
      if (reporterIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", reporterIds);

        if (profilesError) throw profilesError;

        reporterLookup = (profilesData || []).reduce((lookup, profile) => {
          lookup[profile.id] = profile.username || "Anonymous";
          return lookup;
        }, {});
      }

      setReports(
        reportRows.map((report) => ({
          ...report,
          reporter: {
            username: reporterLookup[report.user_id] || "Anonymous",
          },
        }))
      );
    } catch (err) {
      console.error("Failed to load reports:", err);
      pushToast({
        type: "error",
        title: "Load failed",
        message: err.message || "Could not load reports.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Admin check failed:", error);
        setLoading(false);
        return;
      }

      if (data?.role === "admin") {
        setIsAdmin(true);
        fetchReports();
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    };

    checkAdmin();
  }, [user, fetchReports]);

  const filteredReports = useMemo(() => {
    return statusFilter === "all" ? reports : reports.filter((report) => report.status === statusFilter);
  }, [reports, statusFilter]);

  useEffect(() => {
    if (filteredReports.length === 0) {
      setSelectedReportId(null);
      return;
    }

    if (!filteredReports.some((report) => report.id === selectedReportId)) {
      setSelectedReportId(filteredReports[0].id);
    }
  }, [filteredReports, selectedReportId]);

  const selectedReport = useMemo(() => {
    return reports.find((report) => report.id === selectedReportId) || null;
  }, [reports, selectedReportId]);

  const handleResolve = async (reportId) => {
    const { error } = await supabase.from("reports").update({ status: "reviewed" }).eq("id", reportId);

    if (error) {
      console.error("Dismiss report failed:", error);
      pushToast({
        type: "error",
        title: "Action failed",
        message: "Could not mark the report as reviewed.",
      });
      return;
    }

    setReports((currentReports) =>
      currentReports.map((report) =>
        report.id === reportId ? { ...report, status: "reviewed" } : report
      )
    );
    pushToast({
      type: "success",
      title: "Report reviewed",
      message: "The report was marked as reviewed.",
    });
  };

  const handleDeleteMeme = async (report) => {
    if (!report?.meme_id) return;

    const memeId = report.meme_id;

    const { data: relatedReports, error: reportLookupError } = await supabase
      .from("reports")
      .select("id")
      .eq("meme_id", memeId);

    if (reportLookupError) {
      console.error("Loading related reports failed:", reportLookupError);
      pushToast({
        type: "error",
        title: "Action failed",
        message: reportLookupError.message || "Could not load related reports.",
      });
      return;
    }

    const reportIds = (relatedReports || []).map((item) => item.id);
    let reportStatusFailed = false;

    const { error } = await supabase.from("meme-table").delete().eq("id", memeId);

    if (error) {
      console.error("Delete meme failed:", error);
      pushToast({
        type: "error",
        title: "Delete failed",
        message: error.message || "The meme could not be deleted.",
      });
      return;
    }

    if (reportIds.length > 0) {
      const { error: reportStatusError } = await supabase
        .from("reports")
        .update({ status: "removed" })
        .in("id", reportIds);

      if (reportStatusError) {
        console.error("Marking reports removed failed:", reportStatusError);
        reportStatusFailed = true;
        pushToast({
          type: "error",
          title: "Meme deleted",
          message: "The meme was deleted, but some report statuses could not be updated.",
        });
      }
    }

    onMemeDeleted?.(memeId);
    await fetchReports();
    if (!reportStatusFailed) {
      pushToast({
        type: "success",
        title: "Meme removed",
        message: "The meme was deleted and its reports were marked removed.",
      });
    }
  };

  const openDeleteConfirm = (report) => {
    if (!report?.meme_id) return;
    setPendingDeleteReport(report);
  };

  const closeDeleteConfirm = () => {
    setPendingDeleteReport(null);
  };

  const confirmDeleteMeme = async () => {
    const report = pendingDeleteReport;
    setPendingDeleteReport(null);
    if (!report) return;
    await handleDeleteMeme(report);
  };

  const handleSelectReport = (reportId) => {
    setSelectedReportId(reportId);
  };

  if (loading && reports.length === 0) {
    return (
      <div className="flex justify-center p-20">
        <Loader2 className="animate-spin text-violet-500" size={40} />
      </div>
    );
  }

  if (!isAdmin && !loading) {
    return <div className="p-20 text-center text-zinc-500">Admins only.</div>;
  }

  const pendingCount = reports.filter((report) => report.status === "pending").length;
  const reviewedCount = reports.filter((report) => report.status === "reviewed").length;
  const removedCount = reports.filter((report) => report.status === "removed").length;

  return (
    <div className="relative mx-auto max-w-7xl p-4 sm:p-6">
      <div className="absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.16),transparent_55%)]" />

      <div className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-[#0d1220] p-5 shadow-2xl shadow-black/20 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-3 text-violet-300">
            <ShieldCheck size={28} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">
              Moderation Hub
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
              Report Review Center
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Review reports, inspect the meme in context, dismiss false flags, or remove content that should not stay up.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Pending</p>
            <p className="mt-1 text-lg font-bold text-white">{pendingCount}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Reviewed</p>
            <p className="mt-1 text-lg font-bold text-white">{reviewedCount}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Removed</p>
            <p className="mt-1 text-lg font-bold text-white">{removedCount}</p>
          </div>
          {onBack ? (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
            >
              Back to site
            </button>
          ) : null}
          <button
            onClick={fetchReports}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
            title="Refresh Reports"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {["pending", "reviewed", "removed", "all"].map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`rounded-full px-4 py-2 text-sm font-bold capitalize transition ${
              statusFilter === filter
                ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20"
                : "border border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/10 hover:text-white"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
        <section className="space-y-4">
          {filteredReports.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.03] p-12 text-center text-zinc-400">
              No {statusFilter !== "all" ? statusFilter : ""} reports found.
            </div>
          ) : (
            filteredReports.map((report) => {
              const tones = getStatusTone(report.status);
              const isSelected = selectedReportId === report.id;

              return (
                <article
                  key={report.id}
                  className={`rounded-[2rem] border p-5 transition ${
                    isSelected
                      ? "border-violet-400/30 bg-violet-500/[0.05] shadow-lg shadow-violet-500/10"
                      : `${tones.panel} hover:border-white/15`
                  }`}
                >
                  <div className="flex flex-col gap-5 sm:flex-row">
                    <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/40 sm:w-28">
                      {report.meme ? (
                        <>
                          <img
                            src={report.meme.image_url}
                            alt={report.meme.title || "Reported meme"}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity hover:opacity-100">
                            <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white">
                              Preview
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] italic text-zinc-500">
                          Deleted
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tones.badge}`}>
                          {report.status}
                        </span>
                        <span className="text-sm text-zinc-400">
                          by{" "}
                          <span className="font-semibold text-zinc-200">
                            {report.reporter?.username || "Anonymous"}
                          </span>
                        </span>
                      </div>

                      <h3 className="mt-2 truncate text-lg font-bold text-white">
                        {report.meme?.title || "Deleted Meme"}
                      </h3>

                      <div className="mt-2 flex items-start gap-2 text-sm text-zinc-400">
                        <span className="mt-0.5 rounded bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter text-violet-300">
                          Reason
                        </span>
                        <p className="italic">{report.reason}</p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 size={12} />
                          {formatDate(report.created_at)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <UserRound size={12} />
                          Meme ID {report.meme_id}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectReport(report.id)}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
                    >
                      <Eye size={16} />
                      View report
                    </button>

                    {report.status === "pending" ? (
                      <button
                        type="button"
                        onClick={() => handleResolve(report.id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                      >
                        <CheckCircle2 size={16} />
                        Mark reviewed
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => openDeleteConfirm(report)}
                      disabled={!report.meme}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={16} />
                      Remove
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>

        <aside className="lg:sticky lg:top-6">
          <div className="rounded-[2rem] border border-white/10 bg-[#0d1220] p-5 shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">
                  Report Details
                </p>
                <h2 className="mt-1 text-xl font-bold text-white">Selected report</h2>
              </div>
              <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-3 text-violet-300">
                <AlertTriangle size={20} />
              </div>
            </div>

            {!selectedReport ? (
              <div className="mt-6 rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-zinc-400">
                Choose a report from the list to inspect the meme, read the reason, and take action.
              </div>
            ) : (
              <>
                <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.04]">
                  {selectedReport.meme ? (
                    <img
                      src={selectedReport.meme.image_url}
                      alt={selectedReport.meme.title || "Reported meme"}
                      className="h-56 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-56 items-center justify-center bg-black/30 text-sm italic text-zinc-500">
                      The meme has been deleted.
                    </div>
                  )}
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusTone(selectedReport.status).badge}`}>
                      {selectedReport.status}
                    </span>
                    <span className="text-sm text-zinc-400">
                      {selectedReport.reporter?.username || "Anonymous"}
                    </span>
                  </div>

                  <h3 className="text-2xl font-black tracking-tight text-white">
                    {selectedReport.meme?.title || "Deleted Meme"}
                  </h3>

                  <p className="text-sm leading-6 text-zinc-300">
                    {selectedReport.reason}
                  </p>

                  <div className="grid gap-3 rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <Clock3 size={14} />
                        Reported
                      </span>
                      <span className="text-zinc-200">{formatDate(selectedReport.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <UserRound size={14} />
                        Reporter
                      </span>
                      <span className="text-zinc-200">{selectedReport.reporter?.username || "Anonymous"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <ShieldCheck size={14} />
                        Meme ID
                      </span>
                      <span className="text-zinc-200">{selectedReport.meme_id}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleSelectReport(selectedReport.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      <Eye size={16} />
                      Focus report
                    </button>

                    {selectedReport.meme ? (
                      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-200">
                        Open the preview above to inspect the meme.
                      </div>
                    ) : null}

                    {selectedReport.status === "pending" ? (
                      <button
                        type="button"
                        onClick={() => handleResolve(selectedReport.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                      >
                        <CheckCircle2 size={16} />
                        Mark reviewed
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => openDeleteConfirm(selectedReport)}
                      disabled={!selectedReport.meme}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={16} />
                      Remove meme
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>
      </div>

      <div className="mt-16">
        <Footer />
      </div>

      <div className="fixed right-4 top-4 z-[120] w-[calc(100vw-2rem)] sm:w-auto">
        <Toast toast={toast} className="ml-auto" />
      </div>

      {pendingDeleteReport ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#0d1220] p-6 shadow-2xl shadow-black/40">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-red-300">
                <Trash2 size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-red-300">
                  Confirm Delete
                </p>
                <h3 className="mt-1 text-2xl font-black tracking-tight text-white">
                  Delete this meme?
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  This will permanently remove the meme from the site. The linked reports will stay in moderation history.
                </p>
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-zinc-500">Meme ID</p>
                  <p className="mt-1 break-all text-sm font-semibold text-zinc-200">
                    {pendingDeleteReport.meme_id}
                  </p>
                  <p className="mt-3 text-sm text-zinc-400">
                    <span className="font-semibold text-zinc-200">
                      {pendingDeleteReport.meme?.title || "Deleted Meme"}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteMeme}
                className="inline-flex items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
              >
                Yes, delete it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
