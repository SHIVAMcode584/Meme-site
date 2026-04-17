import { useEffect, useState } from "react";
import {
  X,
  Download,
  Heart,
  SkipForward,
  Link,
  MessageCircle,
  Check,
  User as UserIcon,
  Bookmark,
  Sparkles,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { getOwnerMemeLikeSnapshot, setOwnerMemeLike } from "../utils/likes";
import CommentsSection from "./CommentsSection";
import ReportModal from "./ReportModal";

export default function MemeModal({
  meme,
  user,
  onClose,
  toggleFavorite,
  favorites,
  onNext,
  isAdminUser = false,
  isBlockedUser = false,
  onDeleteMeme,
  likeCounts = {},
  onLikeCountChange,
  onLikeStateChange,
}) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [localLikeCount, setLocalLikeCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const imageSrc = meme?.image || meme?.image_url;
  const isFavorite = favorites.includes(meme?.id);
  const isStaticMeme = meme && !meme.user_id;
  const canReport = Boolean(
    user &&
      !isAdminUser &&
      !isBlockedUser &&
      meme?.user_id &&
      String(meme.user_id) !== String(user.id)
  );
  const canDelete = Boolean(isAdminUser && onDeleteMeme && meme?.user_id);

  useEffect(() => {
    if (!meme) return;
    setLocalLikeCount(likeCounts[String(meme.id)] || 0);

    const fetchLikedState = async () => {
      if (!user) {
        setLiked(false);
        return;
      }

      if (isStaticMeme) {
        const snapshot = getOwnerMemeLikeSnapshot(meme.id, user.id);
        setLiked(snapshot.liked);
        return;
      }

      const { data } = await supabase
        .from("likes")
        .select("id")
        .eq("user_id", user.id)
        .eq("meme_id", meme.id)
        .maybeSingle();

      setLiked(Boolean(data));
    };

    fetchLikedState();
  }, [meme, user, likeCounts, isStaticMeme]);

  useEffect(() => {
    if (!meme) return undefined;

    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [meme, onClose]);

  if (!meme) return null;

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

  const getShareUrl = () => `${window.location.origin}/meme/${meme.slug}`;

  const handleLike = async () => {
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
        await supabase.from("likes").delete().eq("user_id", user.id).eq("meme_id", meme.id);
      } else {
        await supabase.from("likes").insert({ user_id: user.id, meme_id: meme.id });
      }
    } catch (error) {
      console.error("Like error:", error);
      setLiked(previousLiked);
      setLocalLikeCount(previousCount);
      onLikeCountChange?.(meme.id, previousCount, isStaticMeme);
      onLikeStateChange?.(meme.id, previousLiked);
    } finally {
      setIsLiking(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getShareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const shareUrl = getShareUrl();
    const text = encodeURIComponent(`Check out this meme: ${meme.title} - ${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleDelete = async () => {
    if (!canDelete) return;

    await onDeleteMeme?.(meme);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 lg:pl-64">
      <motion.button
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        aria-label="Close meme popup"
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="relative z-10 flex h-[92dvh] w-full max-w-6xl flex-col overflow-hidden border border-white/10 bg-[#0d1220] shadow-2xl shadow-black/50 sm:h-auto sm:max-h-[92vh] sm:rounded-[2rem]"
      >
        <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-3 sm:hidden">
          <div className="h-1.5 w-14 rounded-full bg-white/15" />
        </div>

        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 cursor-pointer rounded-full border border-white/15 bg-black/40 p-2 text-white transition hover:bg-black/60 sm:right-5 sm:top-5"
        >
          <X size={20} />
        </button>

        <div className="grid h-full min-h-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="relative flex min-h-[34vh] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#312e81_0%,#0b1020_55%,#05070d_100%)] px-4 pb-4 pt-10 sm:min-h-[44vh] sm:px-6 sm:pb-6 sm:pt-14 lg:min-h-0 lg:px-8 lg:py-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(236,72,153,0.18),transparent_45%)]" />
            <div className="relative flex max-h-full w-full items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/35 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-3">
              <img
                src={imageSrc}
                alt={meme.title}
                className="max-h-[28vh] w-auto max-w-full rounded-[1.25rem] object-contain sm:max-h-[38vh] lg:max-h-[76vh]"
              />
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5 lg:px-7 lg:pb-7 custom-scrollbar">
              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20 sm:p-5">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200/90">
                  <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1">
                    {meme.category || "Meme"}
                  </span>
                  <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-200">
                    {meme.mood || "Reaction"}
                  </span>
                </div>

                <h2 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {meme.title}
                </h2>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
                  <div className="flex items-center gap-2">
                    <UserIcon size={14} className="text-zinc-500" />
                    <span>
                      Uploaded by <span className="font-semibold text-violet-300">{meme.username}</span>
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-pink-400/20 bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-200">
                    <Heart size={14} className={liked ? "fill-current" : ""} />
                    {localLikeCount} likes
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(Array.isArray(meme.keywords) ? meme.keywords : []).map((tag, index) => (
                    <span
                      key={index}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-zinc-300 sm:text-xs"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <button
                    onClick={handleLike}
                    disabled={isLiking}
                    className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition ${
                      liked
                        ? "border-pink-400/40 bg-pink-500/15 text-pink-100"
                        : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                    } ${isLiking ? "cursor-not-allowed opacity-70" : ""}`}
                  >
                    <Heart size={18} className={liked ? "fill-current" : ""} />
                    {liked ? "Liked" : "Like"}
                  </button>

                  <button
                    onClick={() => toggleFavorite(meme.id)}
                    className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition ${
                      isFavorite
                        ? "border-violet-400/40 bg-violet-500/15 text-violet-100"
                        : "border-white/10 bg-white/5 text-white hover:bg-white/10"
                    }`}
                  >
                    <Bookmark size={18} className={isFavorite ? "fill-current" : ""} />
                    {isFavorite ? "Saved" : "Save"}
                  </button>

                  <button
                    onClick={handleDownload}
                    className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:opacity-90 sm:col-span-1"
                  >
                    <Download size={18} />
                    Download
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      Share
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">
                      Send this meme fast without leaving the popup.
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
                    <Sparkles size={18} />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-[minmax(0,1fr)_52px] gap-3 sm:grid-cols-[minmax(0,1fr)_56px]">
                  <button
                    onClick={handleCopyLink}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    {copied ? <Check size={18} className="text-green-400" /> : <Link size={18} />}
                    {copied ? "Copied Link" : "Copy Link"}
                  </button>
                  <button
                    onClick={shareWhatsApp}
                    className="flex h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-green-400 transition hover:bg-white/10"
                    title="Share on WhatsApp"
                  >
                    <MessageCircle size={20} />
                  </button>
                </div>
              </div>

              {onNext ? (
                <button
                  onClick={onNext}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-bold text-white transition hover:border-violet-400/30 hover:bg-white/10"
                >
                  <SkipForward size={18} />
                  Next Random Meme
                </button>
              ) : null}

              {canDelete ? (
                <button
                  onClick={handleDelete}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-[1.5rem] border border-red-400/30 bg-[#5a1111]/90 px-4 py-3 text-xs font-semibold text-red-50 shadow-lg shadow-red-950/30 transition hover:bg-[#7a1616] hover:border-red-300/70"
                >
                  <Trash2 size={14} className="text-red-100" /> Delete this meme
                </button>
              ) : canReport && (
                <button
                  onClick={() => setIsReportModalOpen(true)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-[1.5rem] border border-red-400/30 bg-[#5a1111]/90 px-4 py-3 text-xs font-semibold text-red-50 shadow-lg shadow-red-950/30 transition hover:bg-[#7a1616] hover:border-red-300/70"
                >
                  <AlertTriangle size={14} className="text-red-100" /> Report this meme
                </button>
              )}

              <CommentsSection
                memeId={meme.id}
                user={user}
                isDatabaseMeme={meme.isDatabaseMeme}
                variant="modal"
              />
            </div>
          </div>
        </div>
      </motion.div>

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
