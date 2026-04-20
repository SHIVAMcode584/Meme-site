import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Loader2, Send, ShieldAlert, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import Toast from "./Toast";

const REPORT_REASONS = ["Spam", "Offensive", "Copyright", "Other"];

export default function ReportModal({
  isOpen,
  onClose,
  memeId,
  user,
  memeOwnerId = null,
  isAdminUser = false,
  isBlockedUser = false,
}) {
  const [reason, setReason] = useState("");
  const [otherIssue, setOtherIssue] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [ownerId, setOwnerId] = useState(memeOwnerId);

  useEffect(() => {
    if (!isOpen) return;

    setReason("");
    setOtherIssue("");
    setError("");
    setSubmitted(false);
    setToast(null);
    setOwnerId(memeOwnerId);
  }, [isOpen, memeId, memeOwnerId]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    let cancelled = false;

    const loadOwner = async () => {
      if (!isOpen || !memeId) return;
      if (memeOwnerId) return;

      const { data, error: ownerError } = await supabase
        .from("meme-table")
        .select("user_id")
        .eq("id", memeId)
        .maybeSingle();

      if (cancelled) return;

      if (ownerError) {
        console.error("Report owner lookup failed:", ownerError);
        setOwnerId(null);
        return;
      }

      setOwnerId(data?.user_id || null);
    };

    loadOwner();

    return () => {
      cancelled = true;
    };
  }, [isOpen, memeId, memeOwnerId]);

  const canSubmitOwnMeme = Boolean(ownerId && user?.id && ownerId === user.id);
  const hasOtherDetails = Boolean(otherIssue.trim());
  const canReport = Boolean(
    user &&
      !isAdminUser &&
      !isBlockedUser &&
      !canSubmitOwnMeme &&
      reason &&
      (reason !== "Other" || hasOtherDetails)
  );

  const clearToast = () => setToast(null);

  const handleSubmit = async () => {
    if (!user) {
      setToast({
        type: "error",
        title: "Sign in required",
        message: "Please sign in before reporting a meme.",
        onClose: clearToast,
      });
      return;
    }

    if (isAdminUser) {
      setToast({
        type: "error",
        title: "Admins blocked",
        message: "Admin accounts cannot report memes.",
        onClose: clearToast,
      });
      return;
    }

    if (isBlockedUser) {
      setToast({
        type: "error",
        title: "Account blocked",
        message: "Blocked accounts cannot submit reports.",
        onClose: clearToast,
      });
      return;
    }

    if (!reason) {
      setError("Pick a reason before submitting.");
      return;
    }

    if (reason === "Other" && !hasOtherDetails) {
      setError("Please describe the issue.");
      return;
    }

    if (canSubmitOwnMeme) {
      setError("You cannot report your own meme.");
      return;
    }

    const finalReason = reason === "Other" ? `Other: ${otherIssue.trim()}` : reason;

    setLoading(true);
    setError("");
    setToast(null);

    try {
      const { error: insertError } = await supabase.from("reports").insert({
        user_id: user.id,
        meme_id: memeId,
        reason: finalReason,
      });

      if (insertError) {
        if (insertError.code === "23505") {
          throw new Error("You have already reported this meme.");
        }

        if (insertError.code === "42501") {
          throw new Error("You do not have permission to report memes.");
        }

        throw insertError;
      }

      setSubmitted(true);
      setToast({
        type: "success",
        title: "Report sent",
        message: "Report submitted successfully.",
        onClose: clearToast,
      });

      window.setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setToast({
        type: "error",
        title: "Report failed",
        message: err.message || "Failed to submit report.",
        onClose: clearToast,
      });
      setError(err.message || "Failed to submit report.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-[220] flex items-end justify-center overflow-y-auto overscroll-contain p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:items-center sm:p-4 xl:pl-64">
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            aria-label="Close report modal"
          />

          <div className="flex w-full min-h-full items-end justify-center sm:items-center">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0d1220] shadow-2xl shadow-black/40 max-h-[calc(100dvh-1.5rem-env(safe-area-inset-bottom))] sm:rounded-[2rem] sm:max-h-[calc(100dvh-4rem)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_48%)]" />
              <button
                onClick={onClose}
                className="absolute right-4 top-4 z-20 rounded-full border border-white/10 bg-black/60 p-2 text-zinc-200 shadow-lg shadow-black/20 transition hover:bg-black/75 hover:text-white sm:right-5 sm:top-5"
                aria-label="Close report modal"
              >
                <X size={18} />
              </button>

              <div className="relative max-h-full overflow-y-auto p-5 pr-14 sm:p-6 sm:pr-16">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-red-300">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-300">
                        Report content
                      </p>
                      <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Report Meme</h2>
                      <p className="mt-1 text-sm text-zinc-400">
                        Pick the best reason so admins can review it quickly.
                      </p>
                    </div>
                  </div>
                </div>

              {canSubmitOwnMeme ? (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">Self-reporting is blocked</p>
                    <p className="mt-1 text-red-100/80">You cannot report your own meme.</p>
                  </div>
                </div>
              ) : null}

              {submitted ? (
                <div className="mt-8 rounded-[1.5rem] border border-emerald-400/20 bg-emerald-500/10 p-6 text-center">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <p className="text-lg font-bold text-white">Report submitted successfully</p>
                  <p className="mt-2 text-sm text-emerald-100/80">
                    Thanks. An admin can now review this meme.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="grid gap-2">
                    {REPORT_REASONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setReason(option);
                          if (option !== "Other") setOtherIssue("");
                          if (error) setError("");
                        }}
                        className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                          reason === option
                            ? "border-violet-500/50 bg-violet-500/15 text-white shadow-lg shadow-violet-500/10"
                            : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/20 hover:bg-white/10"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence initial={false}>
                    {reason === "Other" ? (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -6 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -6 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4"
                      >
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                          Tell us what is wrong
                        </label>
                        <textarea
                          value={otherIssue}
                          onChange={(event) => {
                            setOtherIssue(event.target.value);
                            if (error) setError("");
                          }}
                          rows={4}
                          maxLength={240}
                          placeholder="Describe the issue so admins can review it..."
                          className="w-full resize-none rounded-2xl border border-white/10 bg-[#070B14] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-violet-500/40"
                        />
                        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                          <span>Be specific. This helps admins understand the problem faster.</span>
                          <span>{otherIssue.trim().length}/240</span>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  {error ? (
                    <p className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      {error}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading || !canReport}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 font-bold text-white shadow-lg shadow-orange-500/20 transition hover:scale-[1.01] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Submit Report
                  </button>
                </div>
              )}
              </div>
            </motion.div>
          </div>

          <AnimatePresence>
            {toast ? (
              <Toast
                toast={{ ...toast, onClose: clearToast }}
                className="fixed bottom-5 left-1/2 z-[120] w-[calc(100vw-2rem)] -translate-x-1/2 sm:w-auto"
              />
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
