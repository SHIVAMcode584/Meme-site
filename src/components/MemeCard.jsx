import { useEffect, useState } from "react";
import {
  Download,
  Heart,
  Bookmark,
  MessageCircle,
  ChevronDown,
  AlertTriangle,
  Trash2,
  Sparkles,
} from "lucide-react";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { getOwnerMemeLikeSnapshot, setOwnerMemeLike } from "../utils/likes";
import CommentsSection from "./CommentsSection";
import ReportModal from "./ReportModal";

export default function MemeCard({
  meme,
  onOpen,
  toggleFavorite,
  favorites,
  user,
  isAdminUser = false,
  isBlockedUser = false,
  onDeleteMeme,
  likeCount = 0,
  onLikeCountChange,
  onLikeStateChange,
  isCommentsOpen = false,
  onToggleComments,
  priority = false,
}) {
  const isFavorite = favorites.includes(meme.id);
  const isStaticMeme = !meme.user_id;
  const isAutoMeme = Boolean(meme?.isAutoMeme || meme?.is_auto || meme?.original_source === "meme-api");
  const imageSrc = meme.image || meme.image_url;
  const canReport = Boolean(
    user &&
      !isAdminUser &&
      !isBlockedUser &&
      meme?.user_id &&
      String(meme.user_id) !== String(user.id)
  );
  const canDelete = Boolean(isAdminUser && onDeleteMeme && meme?.user_id);
  const [liked, setLiked] = useState(false);
  const [localLikeCount, setLocalLikeCount] = useState(likeCount || 0);
  const [isLiking, setIsLiking] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  useEffect(() => {
    setLocalLikeCount(likeCount || 0);
  }, [likeCount]);

  useEffect(() => {
    let isMounted = true;

    const fetchLikedState = async () => {
      if (!user) {
        if (isMounted) setLiked(false);
        return;
      }

      if (isStaticMeme) {
        const snapshot = getOwnerMemeLikeSnapshot(meme.id, user.id);
        if (!isMounted) return;

        setLiked(snapshot.liked);
        setLocalLikeCount(snapshot.count);
        onLikeCountChange?.(meme.id, snapshot.count, true);
        return;
      }

      const { data, error } = await supabase
        .from("likes")
        .select("id")
        .eq("user_id", user.id)
        .eq("meme_id", meme.id)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.error("Like status error:", error);
        setLiked(false);
        return;
      }

      setLiked(Boolean(data));
    };

    fetchLikedState();

    return () => {
      isMounted = false;
    };
  }, [meme.id, isStaticMeme, user?.id, onLikeCountChange]);

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!user) return alert("Please sign in to like memes!");
    if (isLiking) return;

    const previousLiked = liked;
    const previousCount = localLikeCount;
    const nextLiked = !previousLiked;
    const nextCount = nextLiked ? previousCount + 1 : Math.max(0, previousCount - 1);

    setLiked(nextLiked);
    setLocalLikeCount(nextCount);
    onLikeCountChange?.(meme.id, nextCount, isStaticMeme);
    onLikeStateChange?.(meme.id, nextLiked);
    setIsLiking(true);

    try {
      if (isStaticMeme) {
        const snapshot = setOwnerMemeLike(meme.id, user.id, nextLiked);
        setLiked(snapshot.liked);
        setLocalLikeCount(snapshot.count);
        onLikeCountChange?.(meme.id, snapshot.count, true);
        onLikeStateChange?.(meme.id, snapshot.liked);
        return;
      }

      if (previousLiked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("user_id", user.id)
          .eq("meme_id", meme.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("likes").insert({ user_id: user.id, meme_id: meme.id });

        if (error?.code === "23505") {
          const { count } = await supabase
            .from("likes")
            .select("*", { count: "exact", head: true })
            .eq("meme_id", meme.id);

          const syncedCount = count || previousCount;
          setLiked(true);
          setLocalLikeCount(syncedCount);
          onLikeCountChange?.(meme.id, syncedCount, false);
          onLikeStateChange?.(meme.id, true);
          return;
        }

        if (error) throw error;
      }
    } catch (error) {
      console.error("Like error:", error);
      setLiked(previousLiked);
      setLocalLikeCount(previousCount);
      onLikeCountChange?.(meme.id, previousCount, isStaticMeme);
      onLikeStateChange?.(meme.id, previousLiked);
      alert("Unable to update like right now. Please try again.");
    } finally {
      setIsLiking(false);
    }
  };

  const getOptimizedUrl = (url) => {
    if (!url || !url.includes("cloudinary.com")) return url;
    return url.replace("/upload/", "/upload/f_auto,q_auto,w_500,c_scale/");
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(imageSrc);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${meme.title}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!canDelete) return;

    await onDeleteMeme?.(meme);
  };

  const imageSizeClass = isCommentsOpen
    ? "aspect-[4/3] sm:aspect-[16/10] lg:aspect-[21/9]"
    : "aspect-[3/4] sm:aspect-[4/5]";

  return (
    <div className="group overflow-hidden rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] shadow-lg transition hover:border-[color:var(--app-accent)]/30">
      <div className="relative cursor-pointer" onClick={() => onOpen(meme)}>
        <img
          src={getOptimizedUrl(imageSrc)}
          alt={meme.title}
          className={`w-full object-cover bg-[color:var(--app-surface-2)] transition duration-500 group-hover:scale-105 ${imageSizeClass}`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          width="500"
          height="625"
        />

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleLike(e);
          }}
          disabled={isLiking}
          className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)]/85 backdrop-blur-md transition active:scale-90 hover:scale-110 sm:right-4 sm:top-4 sm:h-10 sm:w-10 ${liked ? "border-pink-500/50" : ""}`}
        >
          <div className="flex flex-col items-center justify-center">
            <Motion.div animate={{ scale: liked ? [1, 1.4, 1] : 1 }} transition={{ duration: 0.3 }}>
              <Heart
                className={`w-4 h-4 sm:w-5 sm:h-5 transition-all ${
                  liked ? "fill-pink-500 text-pink-500" : "text-[color:var(--app-text)]"
                }`}
              />
            </Motion.div>
            <span className="mt-0.5 text-[8px] font-black text-[color:var(--app-text)] sm:text-[10px]">{localLikeCount}</span>
          </div>
        </button>

        {canDelete ? (
          <button
            onClick={handleDelete}
            className="group/delete absolute right-12 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-red-400/30 bg-red-950/80 backdrop-blur-md shadow-lg shadow-red-950/30 transition active:scale-90 hover:scale-110 hover:border-red-300/70 hover:bg-red-900 sm:right-16 sm:top-4 sm:h-10 sm:w-10"
            title="Delete Meme"
          >
            <Trash2 className="h-4 w-4 text-red-100 transition-colors group-hover/delete:text-white sm:h-5 sm:w-5" />
          </button>
        ) : canReport ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsReportModalOpen(true);
            }}
            className="group/report absolute right-12 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-red-400/30 bg-red-950/80 backdrop-blur-md shadow-lg shadow-red-950/30 transition active:scale-90 hover:scale-110 hover:border-red-300/70 hover:bg-red-900 sm:right-16 sm:top-4 sm:h-10 sm:w-10"
            title="Report Meme"
          >
            <AlertTriangle className="h-4 w-4 text-red-100 transition-colors group-hover/report:text-white sm:h-5 sm:w-5" />
          </button>
        ) : null}

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(meme.id);
          }}
          className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)]/85 backdrop-blur-md transition hover:scale-110 sm:left-4 sm:top-4 sm:h-10 sm:w-10"
        >
          <Bookmark
            className={`h-4 w-4 sm:h-5 sm:w-5 ${isFavorite ? "fill-violet-500 text-violet-500" : "text-[color:var(--app-text)]"}`}
          />
        </button>

        {isAutoMeme ? (
          <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100 shadow-lg backdrop-blur-md sm:top-4 sm:px-3 sm:text-[11px]">
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Auto Meme
            </span>
          </div>
        ) : null}
      </div>

      <div className="p-3 sm:p-5">
        <h3 className="text-sm sm:text-2xl font-bold line-clamp-1 sm:line-clamp-none">{meme.title}</h3>
        <p className="text-[10px] sm:text-sm text-[color:var(--app-muted)]">
          {meme.category} • {meme.mood}
        </p>

        <div className="hidden sm:flex flex-wrap gap-2 mt-4">
          {(Array.isArray(meme.keywords) ? meme.keywords : []).slice(0, 4).map((tag, index) => (
            <span
              key={index}
              className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1 text-xs text-[color:var(--app-text)]"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-3 sm:mt-5">
          <button
            onClick={handleDownload}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-[10px] font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:scale-[1.02] sm:h-12 sm:gap-2 sm:rounded-2xl sm:text-base"
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Download Meme</span>
          </button>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => onToggleComments?.(meme.id)}
            className="flex h-10 w-full items-center justify-between rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-4 text-xs font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent)]/30 hover:bg-[color:var(--app-surface)] sm:h-11 sm:rounded-2xl sm:text-sm"
          >
            <span className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-violet-400" />
              {isCommentsOpen ? "Hide Comments" : "Open Comments"}
            </span>
            <ChevronDown className={`h-4 w-4 text-[color:var(--app-muted)] transition-transform ${isCommentsOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {isCommentsOpen ? (
            <Motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 12 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <CommentsSection memeId={meme.id} user={user} isDatabaseMeme={meme.isDatabaseMeme} />
            </Motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        memeId={meme.id}
        user={user}
        memeOwnerId={meme.user_id}
        isAdminUser={isAdminUser}
        isBlockedUser={isBlockedUser}
      />
    </div>
  );
}
