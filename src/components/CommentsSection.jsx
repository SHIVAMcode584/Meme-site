import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  CornerDownRight,
  Loader2,
  Lock,
  MessageCircle,
  Reply,
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
  return [...comments].sort(
    (a, b) => (getSafeTimestamp(b.created_at) || 0) - (getSafeTimestamp(a.created_at) || 0)
  );
}

function buildCommentTree(flatComments) {
  const nodes = new Map();
  const roots = [];

  (flatComments || []).forEach((comment) => {
    nodes.set(comment.id, { ...comment, replies: [] });
  });

  (flatComments || []).forEach((comment) => {
    const node = nodes.get(comment.id);
    const parentId = comment.parent_id;

    if (parentId && nodes.has(parentId)) {
      nodes.get(parentId).replies.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (items) => {
    items.sort((a, b) => (getSafeTimestamp(b.created_at) || 0) - (getSafeTimestamp(a.created_at) || 0));
    items.forEach((item) => sortNodes(item.replies));
  };

  sortNodes(roots);
  return roots;
}

function formatRelativeTime(value, now) {
  const timestamp = getSafeTimestamp(value);
  if (timestamp === null) return "Just now";

  const diffSeconds = Math.round((timestamp - now) / 1000);
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
  const [replyText, setReplyText] = useState("");
  const [replyingToId, setReplyingToId] = useState(null);
  const [expandedReplyIds, setExpandedReplyIds] = useState(() => new Set());
  const [loading, setLoading] = useState(Boolean(isDatabaseMeme && memeId));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReplySubmitting, setIsReplySubmitting] = useState(false);
  const [deletingIds, setDeletingIds] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [replyError, setReplyError] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setComments([]);
    setNewComment("");
    setReplyText("");
    setReplyingToId(null);
    setExpandedReplyIds(new Set());
    setFeedback(null);
    setReplyError("");
    setLoading(Boolean(isDatabaseMeme && memeId));
  }, [isDatabaseMeme, memeId]);

  const fetchComments = useCallback(async () => {
    if (!isDatabaseMeme || !memeId) {
      setComments([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("comments")
        .select("id, user_id, meme_id, parent_id, text, created_at")
        .eq("meme_id", memeId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const usernames = await resolveUsernames((data || []).map((comment) => comment.user_id));
      const hydratedComments = (data || []).map((comment) => ({
        ...comment,
        username: usernames[comment.user_id] || "Meme fan",
      }));

      setComments(hydratedComments);
      setFeedback(null);
      setReplyError("");
    } catch (error) {
      console.error("Comment fetch error:", error);
      setFeedback({
        type: "error",
        message: getErrorMessage(error, "Unable to load comments right now."),
      });
    } finally {
      setLoading(false);
    }
  }, [isDatabaseMeme, memeId]);

  useEffect(() => {
    if (!isDatabaseMeme || !memeId) return undefined;

    let cancelled = false;

    const loadComments = async () => {
      if (cancelled) return;
      await fetchComments();
    };

    loadComments();

    const channel = supabase
      .channel(`comments-${memeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comments",
          filter: `meme_id=eq.${memeId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [fetchComments, isDatabaseMeme, memeId]);

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);
  const commentCount = comments.length;

  const clearReplyComposer = useCallback(() => {
    setReplyingToId(null);
    setReplyText("");
    setReplyError("");
  }, []);

  const handleSubmit = useCallback(async () => {
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
      parent_id: null,
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
          parent_id: null,
        })
        .select("id, user_id, meme_id, parent_id, text, created_at")
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
  }, [isDatabaseMeme, memeId, newComment, user]);

  const handleStartReply = useCallback(
    (comment) => {
      if (!user) {
        setFeedback({ type: "error", message: "Please sign in to reply." });
        return;
      }

      setFeedback(null);
      setReplyingToId(comment.id);
      setReplyText("");
      setReplyError("");
      setExpandedReplyIds((current) => {
        const next = new Set(current);
        next.add(comment.id);
        return next;
      });
    },
    [user]
  );

  const handleReplySubmit = useCallback(
    async (parentComment) => {
      const text = replyText.trim();

      if (!text) {
        setReplyError("Write a reply before posting.");
        return;
      }

      if (!user) {
        setReplyError("Please sign in to reply.");
        return;
      }

      if (!isDatabaseMeme || !memeId) {
        setReplyError("Replies are only available for uploaded memes.");
        return;
      }

      const optimisticId = `temp-${window.crypto?.randomUUID?.() || Date.now()}`;
      const username = getUserDisplayName(user);
      const optimisticReply = {
        id: optimisticId,
        user_id: user.id,
        meme_id: memeId,
        parent_id: parentComment.id,
        text,
        created_at: new Date().toISOString(),
        username,
        isPending: true,
      };

      usernameCache.set(user.id, username);
      setFeedback(null);
      setReplyError("");
      setIsReplySubmitting(true);
      setReplyText("");
      setComments((currentComments) => sortCommentsByNewest([optimisticReply, ...currentComments]));
      setExpandedReplyIds((current) => {
        const next = new Set(current);
        next.add(parentComment.id);
        return next;
      });

      try {
        const { data, error } = await supabase
          .from("comments")
          .insert({
            user_id: user.id,
            meme_id: memeId,
            text,
            parent_id: parentComment.id,
          })
          .select("id, user_id, meme_id, parent_id, text, created_at")
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

        setReplyingToId(null);
      } catch (error) {
        console.error("Reply insert error:", error);
        setComments((currentComments) => currentComments.filter((comment) => comment.id !== optimisticId));
        setReplyText(text);
        setReplyError(getErrorMessage(error, "Unable to post your reply right now."));
      } finally {
        setIsReplySubmitting(false);
      }
    },
    [isDatabaseMeme, memeId, replyText, user]
  );

  const handleDelete = useCallback(
    async (commentToDelete) => {
      if (!user || commentToDelete.user_id !== user.id) return;

      setFeedback(null);
      setDeletingIds((currentIds) => [...currentIds, commentToDelete.id]);

      try {
        const { error } = await supabase
          .from("comments")
          .delete()
          .eq("id", commentToDelete.id)
          .eq("user_id", user.id);

        if (error) throw error;

        await fetchComments();
      } catch (error) {
        console.error("Comment delete error:", error);
        setFeedback({
          type: "error",
          message: getErrorMessage(error, "Unable to delete that comment right now."),
        });
      } finally {
        setDeletingIds((currentIds) => currentIds.filter((id) => id !== commentToDelete.id));
      }
    },
    [fetchComments, user]
  );

  const toggleReplies = useCallback((commentId) => {
    setExpandedReplyIds((current) => {
      const next = new Set(current);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  }, []);

  const wrapperClassName =
    variant === "modal"
      ? "mt-6 rounded-[1.75rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface)]/95 p-4 sm:p-5"
      : "mt-4 rounded-[1.5rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface)]/95 p-4";

  const renderCommentNode = (comment, depth = 0) => {
    const isOwnComment = comment.user_id === user?.id;
    const isDeleting = deletingIds.includes(comment.id);
    const hasReplies = (comment.replies || []).length > 0;
    const isExpanded = expandedReplyIds.has(comment.id);
    const isReplyComposerOpen = replyingToId === comment.id;
    const canReply = depth < 2;

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
            ? "border-[color:var(--app-accent)]/25 bg-violet-500/10"
            : "border-[color:var(--app-border)] bg-[color:var(--app-bg)]/35"
        } ${depth > 0 ? "ml-4 border-l-2 border-l-[color:var(--app-border)] pl-4 sm:ml-6" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {depth > 0 ? <CornerDownRight className="h-3.5 w-3.5 text-[color:var(--app-muted)]" /> : null}
              <span className="truncate text-sm font-semibold text-[color:var(--app-text)]">
                {comment.username || "Meme fan"}
              </span>
              {isOwnComment ? (
                <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200">
                  You
                </span>
              ) : null}
            </div>

            <div className="mt-1 flex items-center gap-1.5 text-xs text-[color:var(--app-muted)]">
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
              className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)]/70 text-[color:var(--app-muted)] transition hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Delete comment"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          ) : null}
        </div>

        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-[color:var(--app-text)]">
          {comment.text}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canReply ? (
            <button
              type="button"
              onClick={() => handleStartReply(comment)}
              disabled={!user}
              className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)]/70 px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Reply className="h-3.5 w-3.5" />
              Reply
            </button>
          ) : null}

          {hasReplies ? (
            <button
              type="button"
              onClick={() => toggleReplies(comment.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/15"
            >
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {isExpanded ? "Hide replies" : `View replies (${comment.replies.length})`}
            </button>
          ) : null}
        </div>

        <AnimatePresence initial={false}>
          {isReplyComposerOpen ? (
            <Motion.div
              initial={{ opacity: 0, height: 0, y: -6 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={{ opacity: 0, height: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mt-4 overflow-hidden rounded-[1.25rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)]/70 p-3"
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">
                <Reply className="h-3.5 w-3.5" />
                Replying to {comment.username || "Meme fan"}
              </div>

              <textarea
                value={replyText}
                onChange={(event) => {
                  setReplyText(event.target.value);
                  if (replyError) setReplyError("");
                }}
                rows={3}
                placeholder={`Reply to ${comment.username || "Meme fan"}...`}
                className="mt-3 min-h-[84px] w-full resize-none rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-4 py-3 text-sm text-[color:var(--app-text)] outline-none transition placeholder:text-[color:var(--app-muted)] focus:border-violet-500/40"
              />

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[color:var(--app-muted)]">Press Enter to post, Shift+Enter for a new line.</p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={clearReplyComposer}
                    className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-4 py-2.5 text-sm font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-2)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReplySubmit(comment)}
                    disabled={isReplySubmitting}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isReplySubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Reply
                  </button>
                </div>
              </div>

              {replyError ? (
                <p className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {replyError}
                </p>
              ) : null}
            </Motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {hasReplies && isExpanded ? (
            <Motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mt-3 space-y-3 overflow-hidden"
            >
              {comment.replies.map((reply) => renderCommentNode(reply, depth + 1))}
            </Motion.div>
          ) : null}
        </AnimatePresence>
      </Motion.article>
    );
  };

  if (!isDatabaseMeme || !memeId) {
    return (
      <section className={wrapperClassName}>
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-2)]/50 p-4 text-sm text-[color:var(--app-muted)]">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-muted)]" />
          <div>
            <p className="font-semibold text-[color:var(--app-text)]">Comments are unavailable here</p>
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
              <h3 className="text-sm font-semibold text-[color:var(--app-text)] sm:text-base">Comments</h3>
              <p className="text-xs text-[color:var(--app-muted)]">
                {commentCount} {commentCount === 1 ? "comment" : "comments"} in this thread
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

      <div className="group/commentbox relative mt-4 overflow-hidden rounded-[1.35rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)]/70 p-3 transition-colors duration-300 focus-within:border-violet-300/45">
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
            className="min-h-[92px] w-full resize-none bg-transparent text-sm text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-muted)] disabled:cursor-not-allowed disabled:opacity-70"
          />

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[color:var(--app-muted)]">Press Enter to post, Shift+Enter for a new line.</p>

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
          <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)]/50 px-4 py-5 text-sm text-[color:var(--app-muted)]">
            <Loader2 className="h-4 w-4 animate-spin text-violet-300" />
            Loading comments...
          </div>
        ) : commentTree.length === 0 ? (
          <div className="rounded-[1.35rem] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-2)]/50 px-4 py-6 text-center">
            <p className="text-sm font-medium text-[color:var(--app-text)]">Start the thread</p>
            <p className="mt-1 text-xs text-[color:var(--app-muted)]">Be the first to react to this meme.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {commentTree.map((comment) => renderCommentNode(comment, 0))}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
