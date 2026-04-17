import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import {
  AlertTriangle,
  Eye,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  CheckCircle2,
  Clock3,
  Search,
  ChevronDown,
  ChevronUp,
  Send,
  Users,
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

function getUserTone(role) {
  if (role === "admin") {
    return {
      badge: "bg-violet-500/10 text-violet-200 border border-violet-400/20",
      panel: "border-violet-400/20 bg-violet-500/[0.04]",
      icon: ShieldCheck,
      label: "Admin",
    };
  }

  if (role === "blocked") {
    return {
      badge: "bg-red-500/10 text-red-200 border border-red-400/20",
      panel: "border-red-400/20 bg-red-500/[0.04]",
      icon: ShieldAlert,
      label: "Blocked",
    };
  }

  return {
    badge: "bg-emerald-500/10 text-emerald-200 border border-emerald-400/20",
    panel: "border-white/10 bg-white/[0.04]",
    icon: Users,
    label: "User",
  };
}

export default function AdminModeration({ user, onBack, onMemeDeleted }) {
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeSection, setActiveSection] = useState("reports");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [userSearch, setUserSearch] = useState("");
  const [warningDrafts, setWarningDrafts] = useState({});
  const [expandedWarningUserId, setExpandedWarningUserId] = useState(null);
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [pendingDeleteReport, setPendingDeleteReport] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [pendingActionCountdown, setPendingActionCountdown] = useState(0);
  const [toast, setToast] = useState(null);
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return undefined;

    const timer = window.setTimeout(() => {
      clearToast();
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [toast, clearToast]);

  useEffect(() => {
    if (!pendingAction) {
      setPendingActionCountdown(0);
      return undefined;
    }

    if (pendingActionCountdown <= 0) return undefined;

    const timer = window.setTimeout(() => {
      setPendingActionCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [pendingAction, pendingActionCountdown]);

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
  }, [pushToast]);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);

    try {
      const [{ data: profileRows, error: profileError }, { data: memeRows, error: memeError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, username, points, role")
            .order("username", { ascending: true }),
          supabase.from("meme-table").select("id, user_id"),
        ]);

      if (profileError) throw profileError;
      if (memeError) {
        console.warn("Could not load meme counts for users:", memeError);
      }

      const memeCounts = (memeRows || []).reduce((counts, meme) => {
        const key = String(meme.user_id);
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {});

      setUsers(
        (profileRows || []).map((profileRow) => ({
          ...profileRow,
          memeCount: memeCounts[String(profileRow.id)] || 0,
          role: profileRow.role || "user",
        }))
      );
    } catch (err) {
      console.error("Failed to load users:", err);
      pushToast({
        type: "error",
        title: "User load failed",
        message: err.message || "Could not load user list.",
      });
    } finally {
      setUsersLoading(false);
    }
  }, [pushToast]);

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
        fetchUsers();
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    };

    checkAdmin();
  }, [user, fetchReports, fetchUsers]);

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

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return users;

    return users.filter((profileRow) => {
      return [profileRow.username, profileRow.id, profileRow.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [users, userSearch]);

  const executeToggleUserBlock = async (profileRow) => {
    if (!profileRow?.id) return;
    const nextRole = profileRow.role === "blocked" ? null : "blocked";
    const { error } = await supabase.from("profiles").update({ role: nextRole }).eq("id", profileRow.id);

    if (error) {
      console.error("Failed to update user status:", error);
      pushToast({
        type: "error",
        title: "Update failed",
        message: error.message || "Could not change the user status.",
      });
      return;
    }

    setUsers((currentUsers) =>
      currentUsers.map((item) =>
        item.id === profileRow.id
          ? { ...item, role: nextRole || "user" }
          : item
      )
    );

    pushToast({
      type: "success",
      title: nextRole === "blocked" ? "User blocked" : "User unblocked",
      message:
        nextRole === "blocked"
          ? "The user can no longer upload or report from this app."
          : "The user has been restored.",
    });
  };

  const executeDeleteUser = async (profileRow) => {
    if (!profileRow?.id) return;
    try {
      const { data: memeRows, error: memeLookupError } = await supabase
        .from("meme-table")
        .select("id")
        .eq("user_id", profileRow.id);

      if (memeLookupError) throw memeLookupError;

      const memeIds = (memeRows || []).map((row) => row.id);

      const cleanupRequests = [
        supabase.from("likes").delete().eq("user_id", profileRow.id),
        supabase.from("reports").delete().eq("user_id", profileRow.id),
        supabase.from("comments").delete().eq("user_id", profileRow.id),
        supabase.from("meme-table").delete().eq("user_id", profileRow.id),
        supabase.from("profiles").delete().eq("id", profileRow.id),
      ];

      if (memeIds.length > 0) {
        cleanupRequests.push(supabase.from("likes").delete().in("meme_id", memeIds));
        cleanupRequests.push(supabase.from("reports").delete().in("meme_id", memeIds));
        cleanupRequests.push(supabase.from("comments").delete().in("meme_id", memeIds));
      }

      const results = await Promise.all(cleanupRequests);
      const failedResult = results.find((result) => result?.error);
      if (failedResult?.error) throw failedResult.error;

      setUsers((currentUsers) => currentUsers.filter((item) => item.id !== profileRow.id));
      setWarningDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[profileRow.id];
        return nextDrafts;
      });
      setExpandedWarningUserId((current) => (current === profileRow.id ? null : current));
      setReports((currentReports) =>
        currentReports.filter((report) => report.meme?.user_id !== profileRow.id && report.user_id !== profileRow.id)
      );

      pushToast({
        type: "success",
        title: "User deleted",
        message: "The profile and related content were removed.",
      });
    } catch (error) {
      console.error("Failed to delete user:", error);
      pushToast({
        type: "error",
        title: "Delete failed",
        message: error.message || "Could not delete the user.",
      });
    }
  };

  const executeSendWarning = async (profileRow, warningMessage) => {
    if (!profileRow?.id || !warningMessage) return;

    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: profileRow.id,
        sender_id: user?.id || null,
        meme_id: null,
        type: "warning",
        message: warningMessage,
        is_read: false,
      });

      if (error) throw error;

      setWarningDrafts((current) => ({
        ...current,
        [profileRow.id]: "",
      }));
      setExpandedWarningUserId((current) => (current === profileRow.id ? null : current));

      pushToast({
        type: "success",
        title: "Warning sent",
        message: "The user received an in-app warning notification.",
      });
    } catch (error) {
      console.error("Failed to send warning:", error);
      pushToast({
        type: "error",
        title: "Send failed",
        message: error.message || "Could not send the warning.",
      });
    }
  };

  const requestToggleUserBlock = (profileRow) => {
    if (!profileRow?.id) return;
    if (profileRow.role === "admin") {
      pushToast({
        type: "error",
        title: "Action blocked",
        message: "Admin accounts cannot be blocked from here.",
      });
      return;
    }

    if (profileRow.id === user?.id) {
      pushToast({
        type: "error",
        title: "Action blocked",
        message: "You cannot change your own status from this screen.",
      });
      return;
    }

    const blocked = profileRow.role === "blocked";
    setPendingAction({
      kind: "toggle-user-block",
      profileRow,
      title: blocked ? "Unblock this user?" : "Block this user?",
      message: blocked
        ? "Unblocking restores posting, commenting, and reporting access."
        : "Blocking removes the user's ability to post, comment, and report.",
      confirmLabel: blocked ? "Yes, unblock" : "Yes, block",
      tone: "warning",
    });
    setPendingActionCountdown(3);
  };

  const requestDeleteUser = (profileRow) => {
    if (!profileRow?.id) return;
    if (profileRow.role === "admin") {
      pushToast({
        type: "error",
        title: "Action blocked",
        message: "Admin accounts cannot be deleted from here.",
      });
      return;
    }

    if (profileRow.id === user?.id) {
      pushToast({
        type: "error",
        title: "Action blocked",
        message: "You cannot delete your own account from this screen.",
      });
      return;
    }

    setPendingAction({
      kind: "delete-user",
      profileRow,
      title: "Delete this user?",
      message:
        "This removes the profile and all related memes, reports, likes, comments, and notifications from the app.",
      confirmLabel: "Yes, delete user",
      tone: "danger",
    });
    setPendingActionCountdown(3);
  };

  const requestSendWarning = (profileRow) => {
    if (!profileRow?.id) return;

    if (profileRow.role === "admin") {
      pushToast({
        type: "error",
        title: "Action blocked",
        message: "Admin accounts cannot receive warnings from here.",
      });
      return;
    }

    if (profileRow.id === user?.id) {
      pushToast({
        type: "error",
        title: "Action blocked",
        message: "You cannot warn your own account from this screen.",
      });
      return;
    }

    const warningMessage = (warningDrafts[profileRow.id] || "").trim();
    if (!warningMessage) {
      pushToast({
        type: "error",
        title: "Message required",
        message: "Write a warning message before continuing.",
      });
      return;
    }

    setPendingAction({
      kind: "send-warning",
      profileRow,
      title: "Send this warning?",
      message: "The user will receive the message in their notifications center.",
      confirmLabel: "Send warning",
      tone: "warning",
      warningMessage,
    });
    setPendingActionCountdown(3);
  };

  const confirmPendingAction = async () => {
    const action = pendingAction;
    if (pendingActionCountdown > 0) return;
    setPendingAction(null);
    setPendingActionCountdown(0);
    if (!action) return;

    if (action.kind === "toggle-user-block") {
      await executeToggleUserBlock(action.profileRow);
      return;
    }

    if (action.kind === "delete-user") {
      await executeDeleteUser(action.profileRow);
      return;
    }

    if (action.kind === "send-warning") {
      await executeSendWarning(action.profileRow, action.warningMessage);
    }
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
  const totalCount = reports.length;
  const totalUsers = users.length;
  const blockedCount = users.filter((profileRow) => profileRow.role === "blocked").length;
  const adminCount = users.filter((profileRow) => profileRow.role === "admin").length;
  const selectedReportIndex = selectedReport
    ? filteredReports.findIndex((report) => report.id === selectedReport.id) + 1
    : 0;

  const filterTabs = [
    { key: "pending", label: "Pending", count: pendingCount },
    { key: "reviewed", label: "Reviewed", count: reviewedCount },
    { key: "removed", label: "Removed", count: removedCount },
    { key: "all", label: "All", count: totalCount },
  ];

  const sectionTabs = [
    { key: "reports", label: "Reports", count: totalCount },
    { key: "users", label: "Users", count: totalUsers },
  ];

  return (
    <div className="relative mx-auto max-w-7xl overflow-x-hidden px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
      <div className="absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.16),transparent_55%)]" />

      <div className="mb-4 flex items-center justify-center rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-200 sm:px-4 sm:text-sm sm:tracking-[0.35em]">
        This is only for admins of the web app
      </div>

      <div className="relative mb-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d1220] shadow-2xl shadow-black/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.12),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_35%)]" />
        <div className="relative flex flex-col gap-6 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-3 text-violet-300 shadow-lg shadow-violet-500/10">
              <ShieldCheck size={28} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">
                Moderation Hub
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Moderation Center
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-[15px]">
                Review reports, inspect memes in context, remove content, and manage users from one place.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4 lg:min-w-[520px]">
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
            <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-violet-200/80">Total</p>
              <p className="mt-1 text-lg font-bold text-white">{totalCount}</p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            {onBack ? (
              <button
                onClick={onBack}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 sm:w-auto"
              >
                Back to site
              </button>
            ) : null}
            <button
              onClick={() => {
                fetchReports();
                fetchUsers();
              }}
              disabled={loading || usersLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 disabled:opacity-50 sm:w-auto"
              title="Refresh Moderation Data"
            >
              <RefreshCw size={18} className={loading || usersLoading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 flex overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2">
          {sectionTabs.map((section) => (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                activeSection === section.key
                  ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20"
                  : "border border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span>{section.label}</span>
              <span className="ml-2 rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-black tracking-wider">
                {section.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {activeSection === "reports" ? (
        <>
          <div className="mb-6 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-2">
              {filterTabs.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setStatusFilter(filter.key)}
                  className={`rounded-full px-4 py-2 text-sm font-bold capitalize transition ${
                    statusFilter === filter.key
                      ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20"
                      : "border border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span>{filter.label}</span>
                  <span className="ml-2 rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-black tracking-wider">
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <aside className="order-first xl:sticky xl:top-6 xl:order-none">
              <div className="rounded-[2rem] border border-white/10 bg-[#0d1220] p-4 shadow-2xl shadow-black/20 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">
                      Report Details
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-white sm:text-xl">Selected report</h2>
                  </div>
                  <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-2.5 text-violet-300 sm:p-3">
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
                          className="h-44 w-full object-cover sm:h-56"
                        />
                      ) : (
                        <div className="flex h-44 items-center justify-center bg-black/30 text-sm italic text-zinc-500 sm:h-56">
                          The meme has been deleted.
                        </div>
                      )}
                    </div>

                    <div className="mt-5 space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusTone(selectedReport.status).badge}`}>
                          {selectedReport.status}
                        </span>
                        <span className="text-sm text-zinc-400">
                          {selectedReport.reporter?.username || "Anonymous"}
                        </span>
                        {selectedReportIndex ? (
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                            {selectedReportIndex} of {filteredReports.length}
                          </span>
                        ) : null}
                      </div>

                      <h3 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                        {selectedReport.meme?.title || "Deleted Meme"}
                      </h3>

                      <p className="text-sm leading-6 text-zinc-300">
                        {selectedReport.reason}
                      </p>

                      <div className="grid gap-3 rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <span className="flex items-center gap-2">
                            <Clock3 size={14} />
                            Reported
                          </span>
                          <span className="text-zinc-200">{formatDate(selectedReport.created_at)}</span>
                        </div>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <span className="flex items-center gap-2">
                            <UserRound size={14} />
                            Reporter
                          </span>
                          <span className="text-zinc-200">{selectedReport.reporter?.username || "Anonymous"}</span>
                        </div>
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <span className="flex items-center gap-2">
                            <ShieldCheck size={14} />
                            Meme ID
                          </span>
                          <span className="break-all text-zinc-200">{selectedReport.meme_id}</span>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => handleSelectReport(selectedReport.id)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                          <Eye size={16} />
                          Focus report
                        </button>

                        {selectedReport.status === "pending" ? (
                          <button
                            type="button"
                            onClick={() => handleResolve(selectedReport.id)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                          >
                            <CheckCircle2 size={16} />
                            Mark reviewed
                          </button>
                        ) : (
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-zinc-400">
                            This report is already {selectedReport.status}.
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => openDeleteConfirm(selectedReport)}
                          disabled={!selectedReport.meme}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-2"
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
                      className={`rounded-[2rem] border p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 ${
                        isSelected
                          ? "border-violet-400/30 bg-violet-500/[0.05] shadow-lg shadow-violet-500/10"
                          : `${tones.panel} hover:border-white/15`
                      }`}
                    >
                      <div className="flex flex-col gap-5 sm:flex-row">
                        <div className="group relative h-28 w-full shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/40 sm:w-28">
                          {report.meme ? (
                            <>
                              <img
                                src={report.meme.image_url}
                                alt={report.meme.title || "Reported meme"}
                                className="h-full w-full object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
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
                        {isSelected ? (
                          <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-200">
                            Selected
                          </span>
                        ) : null}
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

                  <div className="mt-5 grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => handleSelectReport(report.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
                    >
                      <Eye size={16} />
                      View report
                    </button>

                    {report.status === "pending" ? (
                      <button
                        type="button"
                        onClick={() => handleResolve(report.id)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                      >
                        <CheckCircle2 size={16} />
                        Mark reviewed
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => openDeleteConfirm(report)}
                      disabled={!report.meme}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40 sm:col-start-3"
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
      </div>
      </>
      ) : (
        <section className="space-y-5">
          <div className="rounded-[2rem] border border-white/10 bg-[#0d1220] p-5 shadow-2xl shadow-black/20">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">
                  User Management
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-white">
                  All users
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Block problematic accounts or remove profiles and their content from the app.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center sm:min-w-[360px]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Users</p>
                  <p className="mt-1 text-lg font-bold text-white">{totalUsers}</p>
                </div>
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-red-200/80">Blocked</p>
                  <p className="mt-1 text-lg font-bold text-white">{blockedCount}</p>
                </div>
                <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-violet-200/80">Admins</p>
                  <p className="mt-1 text-lg font-bold text-white">{adminCount}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-[1.4rem] border border-white/10 bg-white/[0.03] px-4 py-3">
              <Search size={18} className="text-zinc-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search users by name, role, or id"
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
              />
            </div>
          </div>

          {usersLoading && users.length === 0 ? (
            <div className="flex justify-center rounded-[2rem] border border-white/10 bg-[#0d1220] p-16 shadow-2xl shadow-black/20">
              <Loader2 className="animate-spin text-violet-500" size={40} />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.03] p-12 text-center text-zinc-400">
              No users found.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
              {filteredUsers.map((profileRow) => {
                const tone = getUserTone(profileRow.role);
                const StatusIcon = tone.icon;
                const isAdminAccount = profileRow.role === "admin";
                const isBlockedAccount = profileRow.role === "blocked";
                const isSelf = profileRow.id === user?.id;
                const warningValue = warningDrafts[profileRow.id] || "";
                const isWarningOpen = expandedWarningUserId === profileRow.id;

                return (
                  <article
                    key={profileRow.id}
                    className={`rounded-[2rem] border p-5 shadow-2xl shadow-black/20 backdrop-blur-sm transition hover:-translate-y-0.5 ${tone.panel}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-lg font-bold text-white">
                            {profileRow.username || "Unnamed user"}
                          </h3>
                          {isSelf ? (
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                              You
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 break-all text-xs text-zinc-500">{profileRow.id}</p>
                      </div>

                      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] ${tone.badge}`}>
                        <StatusIcon size={12} />
                        {tone.label}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Points</p>
                        <p className="mt-1 text-base font-bold text-white">{profileRow.points || 0}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Memes</p>
                        <p className="mt-1 text-base font-bold text-white">{profileRow.memeCount || 0}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Role</p>
                        <p className="mt-1 text-base font-bold text-white">{profileRow.role || "user"}</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => requestToggleUserBlock(profileRow)}
                        disabled={isAdminAccount || isSelf}
                        className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          isBlockedAccount
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                            : "border-amber-500/20 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                        }`}
                      >
                        {isBlockedAccount ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                        {isBlockedAccount ? "Unblock user" : "Block user"}
                      </button>

                      <button
                        type="button"
                        onClick={() => requestDeleteUser(profileRow)}
                        disabled={isAdminAccount || isSelf}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 size={16} />
                        Delete user
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedWarningUserId((current) =>
                            current === profileRow.id ? null : profileRow.id
                          )
                        }
                        disabled={isAdminAccount || isSelf}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Send size={16} />
                        {isWarningOpen ? "Hide warning" : "Write warning"}
                        {isWarningOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>

                    <div
                      className={`overflow-hidden rounded-[1.5rem] border transition-all duration-300 ${
                        isWarningOpen
                          ? "mt-4 max-h-[420px] border-amber-500/20 bg-amber-500/[0.04] p-4 opacity-100"
                          : "max-h-0 border-transparent bg-transparent p-0 opacity-0"
                      }`}
                    >
                      {isWarningOpen ? (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/80">
                                Warning note
                              </p>
                              <p className="mt-1 text-xs leading-5 text-amber-50/70">
                                Write the warning first, then review it on the confirmation page.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => requestSendWarning(profileRow)}
                              disabled={warningValue.trim().length === 0}
                              className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Send size={14} />
                              Review warning
                            </button>
                          </div>

                          <textarea
                            value={warningValue}
                            onChange={(event) =>
                              setWarningDrafts((current) => ({
                                ...current,
                                [profileRow.id]: event.target.value,
                              }))
                            }
                            rows={4}
                            placeholder="Write the warning text here..."
                            className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-amber-400/40 focus:ring-2 focus:ring-amber-400/20"
                          />
                        </>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div className="mt-16">
        <Footer />
      </div>

      <div className="fixed right-4 top-4 z-[120] w-[calc(100vw-2rem)] sm:w-auto">
        <Toast toast={toast} className="ml-auto" />
      </div>

      {pendingAction ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div
            className={`w-full max-w-xl rounded-[2rem] border p-6 shadow-2xl shadow-black/40 ${
              pendingAction.tone === "danger"
                ? "border-red-500/20 bg-[#0d1220]"
                : "border-amber-500/20 bg-[#0d1220]"
            }`}
          >
            <div className="flex flex-col gap-5">
              <div className="flex items-start gap-4">
                <div
                  className={`rounded-2xl border p-3 ${
                    pendingAction.tone === "danger"
                      ? "border-red-500/20 bg-red-500/10 text-red-300"
                      : "border-amber-500/20 bg-amber-500/10 text-amber-200"
                  }`}
                >
                  {pendingAction.kind === "delete-user" ? <Trash2 size={22} /> : <AlertTriangle size={22} />}
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-xs font-semibold uppercase tracking-[0.28em] ${
                      pendingAction.tone === "danger" ? "text-red-300" : "text-amber-300"
                    }`}
                  >
                    Confirm action
                  </p>
                  <h3 className="mt-1 text-2xl font-black tracking-tight text-white">
                    {pendingAction.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{pendingAction.message}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_190px]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Target</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-100">
                    {pendingAction.profileRow?.username || "Unnamed user"}
                  </p>
                  <p className="mt-1 break-all text-xs text-zinc-500">{pendingAction.profileRow?.id}</p>

                  {pendingAction.kind === "send-warning" ? (
                    <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-amber-300">Warning preview</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-100">
                        {pendingAction.warningMessage}
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <motion.div
                    className="relative flex h-36 w-36 items-center justify-center"
                    animate={
                      pendingActionCountdown > 0
                        ? { scale: [1, 1.03, 1], rotate: [0, 1.5, -1.5, 0] }
                        : { scale: 1, rotate: 0 }
                    }
                    transition={
                      pendingActionCountdown > 0
                        ? { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
                        : { duration: 0.2 }
                    }
                  >
                    <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                      <defs>
                        <linearGradient id="adminActionTimerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={pendingAction.tone === "danger" ? "#ef4444" : "#f59e0b"} />
                          <stop offset="100%" stopColor={pendingAction.tone === "danger" ? "#fb923c" : "#fbbf24"} />
                        </linearGradient>
                      </defs>
                      <circle cx="60" cy="60" r="46" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                      <motion.circle
                        cx="60"
                        cy="60"
                        r="46"
                        fill="none"
                        stroke="url(#adminActionTimerGradient)"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={289}
                        animate={{
                          strokeDashoffset: 289 - 289 * Math.max(0, Math.min(1, (3 - pendingActionCountdown) / 3)),
                        }}
                        transition={{ type: "spring", stiffness: 90, damping: 18 }}
                      />
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <AnimatePresence mode="wait" initial={false}>
                        {pendingActionCountdown > 0 ? (
                          <motion.span
                            key={`admin-action-count-${pendingActionCountdown}`}
                            initial={{ scale: 0.75, opacity: 0, filter: "blur(4px)" }}
                            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                            exit={{ scale: 1.1, opacity: 0, filter: "blur(4px)" }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="text-4xl font-black tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                          >
                            {pendingActionCountdown}
                          </motion.span>
                        ) : (
                          <motion.span
                            key="admin-action-ready"
                            initial={{ scale: 0.75, opacity: 0, filter: "blur(4px)" }}
                            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="text-sm font-black uppercase tracking-[0.24em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                          >
                            Ready
                          </motion.span>
                        )}
                      </AnimatePresence>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-300/90">
                        Hold to confirm
                      </p>
                    </div>
                  </motion.div>
                </div>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setPendingAction(null);
                    setPendingActionCountdown(0);
                  }}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPendingAction}
                  disabled={pendingActionCountdown > 0}
                  className={`inline-flex items-center justify-center rounded-2xl border px-5 py-3 text-sm font-semibold transition ${
                    pendingAction.tone === "danger"
                      ? "border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                      : "border-amber-500/20 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {pendingActionCountdown > 0 ? `Wait ${pendingActionCountdown}s` : pendingAction.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
