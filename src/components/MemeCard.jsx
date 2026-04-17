import { useEffect, useState } from "react";
import {
  Download,
  Heart,
  Bookmark,
  MessageCircle,
  ChevronDown,
  AlertTriangle,
  Trash2,
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
    <div className="group bg-[#101624] border border-white/10 rounded-3xl overflow-hidden hover:border-violet-400/30 transition shadow-lg">
      <div className="relative cursor-pointer" onClick={() => onOpen(meme)}>
        <img
          src={getOptimizedUrl(imageSrc)}
          alt={meme.title}
          className={`w-full object-cover group-hover:scale-105 transition duration-500 bg-zinc-900 ${imageSizeClass}`}
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
          className={`absolute top-2 right-2 sm:top-4 sm:right-4 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 hover:scale-110 transition active:scale-90 ${liked ? "border-pink-500/50" : ""}`}
        >
          <div className="flex flex-col items-center justify-center">
            <Motion.div animate={{ scale: liked ? [1, 1.4, 1] : 1 }} transition={{ duration: 0.3 }}>
              <Heart
                className={`w-4 h-4 sm:w-5 sm:h-5 transition-all ${
                  liked ? "fill-pink-500 text-pink-500" : "text-white"
                }`}
              />
            </Motion.div>
            <span className="text-[8px] sm:text-[10px] font-black text-white mt-0.5">{localLikeCount}</span>
          </div>
        </button>

        {canDelete ? (
          <button
            onClick={handleDelete}
            className="absolute top-2 right-12 sm:top-4 sm:right-16 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#561414]/95 backdrop-blur-md flex items-center justify-center border border-red-400/30 shadow-lg shadow-red-950/30 hover:scale-110 transition active:scale-90 hover:bg-[#741616] hover:border-red-300/70 group/delete"
            title="Delete Meme"
          >
            <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-red-100 group-hover/delete:text-white transition-colors" />
          </button>
        ) : canReport ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsReportModalOpen(true);
            }}
            className="absolute top-2 right-12 sm:top-4 sm:right-16 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[#5a1111]/90 backdrop-blur-md flex items-center justify-center border border-red-400/30 shadow-lg shadow-red-950/30 hover:scale-110 transition active:scale-90 hover:bg-[#7a1616] hover:border-red-300/70 group/report"
            title="Report Meme"
          >
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-100 group-hover/report:text-white transition-colors" />
          </button>
        ) : null}

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(meme.id);
          }}
          className="absolute top-2 left-2 sm:top-4 sm:left-4 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 hover:scale-110 transition"
        >
          <Bookmark
            className={`w-4 h-4 sm:w-5 sm:h-5 ${isFavorite ? "fill-violet-500 text-violet-500" : "text-white"}`}
          />
        </button>
      </div>

      <div className="p-3 sm:p-5">
        <h3 className="text-sm sm:text-2xl font-bold line-clamp-1 sm:line-clamp-none">{meme.title}</h3>
        <p className="text-[10px] sm:text-sm text-zinc-400">
          {meme.category} • {meme.mood}
        </p>

        <div className="hidden sm:flex flex-wrap gap-2 mt-4">
          {(Array.isArray(meme.keywords) ? meme.keywords : []).slice(0, 4).map((tag, index) => (
            <span
              key={index}
              className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-300"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-3 sm:mt-5">
          <button
            onClick={handleDownload}
            className="w-full h-9 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-[10px] sm:text-base font-semibold flex items-center justify-center gap-1.5 sm:gap-2 hover:scale-[1.02] transition shadow-lg shadow-violet-500/20"
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Download Meme</span>
          </button>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => onToggleComments?.(meme.id)}
            className="flex h-10 w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-zinc-200 transition hover:border-violet-400/30 hover:bg-white/10 sm:h-11 sm:rounded-2xl sm:text-sm"
          >
            <span className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-violet-300" />
              {isCommentsOpen ? "Hide Comments" : "Open Comments"}
            </span>
            <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${isCommentsOpen ? "rotate-180" : ""}`} />
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
