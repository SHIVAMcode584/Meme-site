import { useEffect, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import {
  Clock3,
  Loader2,
  Lock,
  MessageCircle,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { supabase } from "../lib/supabase";

const usernameCache = new Map();
const timeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function getSafeTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function sortCommentsByNewest(comments) {
  return [...comments].sort((a, b) => (getSafeTimestamp(b.created_at) || 0) - (getSafeTimestamp(a.created_at) || 0));
}

function formatRelativeTime(value, now) {
  const timestamp = getSafeTimestamp(value);
  if (timestamp === null) return "Just now";

  const diffSeconds = Math.round((timestamp - now) / 1000);
  
  // If the comment is from the future (clock drift) or less than 15s ago, show "Just now"
  if (diffSeconds >= -15) return "Just now";

  const absSeconds = Math.abs(diffSeconds);
  if (absSeconds < 60) return timeFormatter.format(diffSeconds, "second");

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return timeFormatter.format(diffMinutes, "minute");

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return timeFormatter.format(diffHours, "hour");

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) return timeFormatter.format(diffDays, "day");

  const diffWeeks = Math.round(diffDays / 7);
  if (Math.abs(diffWeeks) < 5) return timeFormatter.format(diffWeeks, "week");

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) return timeFormatter.format(diffMonths, "month");

  const diffYears = Math.round(diffDays / 365);
  return timeFormatter.format(diffYears, "year");
}

function getUserDisplayName(user) {
  const candidate =
    user?.user_metadata?.username ||
    user?.user_metadata?.user_name ||
    user?.email?.split("@")?.[0] ||
    "Meme fan";

  return String(candidate).trim() || "Meme fan";
}

async function resolveUsernames(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  const missingIds = ids.filter((id) => !usernameCache.has(id));

  if (missingIds.length > 0) {
    const { data, error } = await supabase.from("profiles").select("id, username").in("id", missingIds);

    if (error) throw error;

    (data || []).forEach((profile) => {
      usernameCache.set(profile.id, profile.username || "Meme fan");
    });

    missingIds.forEach((id) => {
      if (!usernameCache.has(id)) usernameCache.set(id, "Meme fan");
    });
  }

  return ids.reduce((lookup, id) => {
    lookup[id] = usernameCache.get(id) || "Meme fan";
    return lookup;
  }, {});
}

function getErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (error.code === "42501") return "You do not have permission to do that.";
  return error.message || fallback;
}

export default function CommentsSection({
  memeId,
  user,
  isDatabaseMeme = true,
  variant = "card",
}) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(Boolean(isDatabaseMeme && memeId));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingIds, setDeletingIds] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadComments = async () => {
      if (!isDatabaseMeme || !memeId) {
        setComments([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("comments")
          .select("id, user_id, meme_id, text, created_at")
          .eq("meme_id", memeId)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const usernames = await resolveUsernames((data || []).map((comment) => comment.user_id));
        const hydratedComments = (data || []).map((comment) => ({
          ...comment,
          username: usernames[comment.user_id] || "Meme fan",
        }));

        if (!cancelled) {
          setComments(hydratedComments);
          setFeedback(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Comment fetch error:", error);
          setFeedback({
            type: "error",
            message: getErrorMessage(error, "Unable to load comments right now."),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadComments();

    return () => {
      cancelled = true;
    };
  }, [isDatabaseMeme, memeId]);

  const handleSubmit = async () => {
    const text = newComment.trim();

    if (!text) {
      setFeedback({ type: "error", message: "Write something before posting." });
      return;
    }

    if (!user) {
      setFeedback({ type: "error", message: "Please sign in to leave a comment." });
      return;
    }

    if (!isDatabaseMeme || !memeId) {
      setFeedback({ type: "error", message: "Comments are only available for uploaded memes." });
      return;
    }

    const optimisticId = `temp-${window.crypto?.randomUUID?.() || Date.now()}`;
    const username = getUserDisplayName(user);
    const optimisticComment = {
      id: optimisticId,
      user_id: user.id,
      meme_id: memeId,
      text,
      created_at: new Date().toISOString(),
      username,
      isPending: true,
    };

    usernameCache.set(user.id, username);
    setFeedback(null);
    setIsSubmitting(true);
    setNewComment("");
    setComments((currentComments) => sortCommentsByNewest([optimisticComment, ...currentComments]));

    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          user_id: user.id,
          meme_id: memeId,
          text,
        })
        .select("id, user_id, meme_id, text, created_at")
        .single();

      if (error) throw error;

      setComments((currentComments) =>
        currentComments.map((comment) =>
          comment.id === optimisticId
            ? {
                ...data,
                username,
              }
            : comment
        )
      );
    } catch (error) {
      console.error("Comment insert error:", error);
      setComments((currentComments) => currentComments.filter((comment) => comment.id !== optimisticId));
      setNewComment(text);
      setFeedback({
        type: "error",
        message: getErrorMessage(error, "Unable to post your comment right now."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentToDelete) => {
    if (!user || commentToDelete.user_id !== user.id) return;

    setFeedback(null);
    setDeletingIds((currentIds) => [...currentIds, commentToDelete.id]);
    setComments((currentComments) =>
      currentComments.filter((comment) => comment.id !== commentToDelete.id)
    );

    try {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentToDelete.id)
        .eq("user_id", user.id);

      if (error) throw error;
    } catch (error) {
      console.error("Comment delete error:", error);
      setComments((currentComments) => sortCommentsByNewest([...currentComments, commentToDelete]));
      setFeedback({
        type: "error",
        message: getErrorMessage(error, "Unable to delete that comment right now."),
      });
    } finally {
      setDeletingIds((currentIds) => currentIds.filter((id) => id !== commentToDelete.id));
    }
  };

  const wrapperClassName =
    variant === "modal"
      ? "mt-6 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-4 sm:p-5"
      : "mt-4 rounded-[1.5rem] border border-white/10 bg-[#0b1020]/90 p-4";

  if (!isDatabaseMeme || !memeId) {
    return (
      <section className={wrapperClassName}>
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-400">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
          <div>
            <p className="font-semibold text-zinc-300">Comments are unavailable here</p>
            <p className="mt-1">
              This meme is bundled locally. Uploaded Supabase memes support full discussions.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={wrapperClassName}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
              <MessageCircle className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white sm:text-base">Comments</h3>
              <p className="text-xs text-zinc-500">
                {comments.length} {comments.length === 1 ? "reply" : "replies"} in this thread
              </p>
            </div>
          </div>
        </div>

        {!user ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
            <Sparkles className="h-3.5 w-3.5" />
            Sign in to join the conversation
          </div>
        ) : null}
      </div>

      <div className="group/commentbox relative mt-4 overflow-hidden rounded-[1.35rem] border border-white/10 bg-black/20 p-3 transition-colors duration-300 focus-within:border-violet-300/45">
        <div className="pointer-events-none absolute inset-0 rounded-[1.35rem] border border-violet-400/80 opacity-0 [clip-path:inset(100%_0_0_0_round_1.35rem)] transition-[clip-path,opacity] duration-500 ease-out group-focus-within/commentbox:opacity-100 group-focus-within/commentbox:[clip-path:inset(0_0_0_0_round_1.35rem)]" />

        <div className="relative z-10">
          <textarea
            value={newComment}
            onChange={(event) => {
              setNewComment(event.target.value);
              if (feedback?.type === "error") setFeedback(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (!isSubmitting) handleSubmit();
              }
            }}
            disabled={!user || isSubmitting}
            placeholder={user ? "Write a comment..." : "Sign in to write a comment..."}
            className="min-h-[92px] w-full resize-none bg-transparent text-sm text-white outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-70"
          />

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500">Press Enter to post, Shift+Enter for a new line.</p>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!user || isSubmitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSubmitting ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      </div>

      {feedback ? (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
            feedback.type === "error"
              ? "border-red-500/20 bg-red-500/10 text-red-200"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="rounded-[1.35rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-center">
            <p className="text-sm font-medium text-zinc-200">Start the thread</p>
            <p className="mt-1 text-xs text-zinc-500">Be the first to react to this meme.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {comments.map((comment) => {
              const isOwnComment = comment.user_id === user?.id;
              const isDeleting = deletingIds.includes(comment.id);

              return (
                <Motion.article
                  key={comment.id}
                  layout
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className={`rounded-[1.35rem] border px-4 py-3 shadow-lg shadow-black/10 ${
                    comment.isPending
                      ? "border-violet-400/25 bg-violet-500/10"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-white">
                          {comment.username || "Meme fan"}
                        </span>
                        {isOwnComment ? (
                          <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200">
                            You
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                        <Clock3 className="h-3 w-3" />
                        <span>{formatRelativeTime(comment.created_at, now)}</span>
                        {comment.isPending ? <span className="text-violet-200">Sending...</span> : null}
                      </div>
                    </div>

                    {isOwnComment ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(comment)}
                        disabled={isDeleting}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-zinc-400 transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Delete comment"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </div>

                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-200">
                    {comment.text}
                  </p>
                </Motion.article>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
