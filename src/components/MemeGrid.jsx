import { useState, useEffect } from "react";
import { motion as Motion } from "framer-motion";
import { Image as ImageIcon, ChevronDown } from "lucide-react";
import MemeCard from "./MemeCard";

function isIpadLikeDevice() {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent || "";
  const platform = window.navigator.platform || "";

  return /iPad/i.test(userAgent) || (platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
}

function getItemsPerPageForViewport() {
  if (typeof window === "undefined") return 6;
  if (isIpadLikeDevice()) return 6;
  if (window.innerWidth >= 1280) return 8;
  if (window.innerWidth >= 640) return 6;
  return 4;
}

export default function MemeGrid({
  memes,
  onOpen,
  toggleFavorite,
  favorites,
  setSearch,
  user,
  isAdminUser = false,
  isBlockedUser = false,
  onDeleteMeme,
  likeCounts = {},
  onLikeCountChange,
  onLikeStateChange,
}) {
  const [itemsPerPage, setItemsPerPage] = useState(() => getItemsPerPageForViewport());
  const [visibleCount, setVisibleCount] = useState(() => getItemsPerPageForViewport());
  const [openCommentsMemeId, setOpenCommentsMemeId] = useState(null);
  const memesSignature = memes.map((meme) => meme.id).join("|");

  useEffect(() => {
    const handleResize = () => {
      setItemsPerPage(getItemsPerPageForViewport());
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Reset visible count only when the actual meme set changes.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setVisibleCount(itemsPerPage);
      setOpenCommentsMemeId(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [itemsPerPage, memesSignature]);

  if (memes.length === 0) {
    return (
      <div className="text-center py-20 border border-white/10 rounded-3xl bg-white/5">
        <ImageIcon className="mx-auto w-14 h-14 text-zinc-500 mb-4" />
        <h3 className="text-2xl font-semibold">No memes found</h3>
        <p className="text-zinc-400 mt-2">Try keywords like:</p>

        <div className="flex flex-wrap justify-center gap-3 mt-6">
          {["awkward", "reply", "teacher", "ignored", "reaction", "funny"].map(
            (item) => (
              <button
                key={item}
                onClick={() => setSearch(item)}
                className="px-4 py-2 rounded-full bg-white/10 border border-white/10 text-sm text-zinc-300 hover:bg-white/15 transition"
              >
                {item}
              </button>
            )
          )}
        </div>
      </div>
    );
  }

  const displayedMemes = memes.slice(0, visibleCount);
  const hasMore = visibleCount < memes.length;
  const isIpad = isIpadLikeDevice();
  const gridClassName = isIpad
    ? "grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-8"
    : "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-8";
  const expandedCardClassName = isIpad ? "col-span-2 md:col-span-3" : "col-span-2 md:col-span-3 xl:col-span-4";

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + itemsPerPage);
  };

  return (
    <div className="space-y-10">
      <div className={gridClassName}>
        {displayedMemes.map((meme, index) => (
          <Motion.div
            key={`${meme.id}-${index}`}
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: (index % itemsPerPage) * 0.04 }}
            className={openCommentsMemeId === meme.id ? expandedCardClassName : ""}
          >
            <MemeCard
              meme={meme}
              onOpen={onOpen}
              toggleFavorite={toggleFavorite}
              favorites={favorites}
              user={user}
              isAdminUser={isAdminUser}
              isBlockedUser={isBlockedUser}
              onDeleteMeme={onDeleteMeme}
              likeCount={likeCounts[String(meme.id)] || 0}
              onLikeCountChange={onLikeCountChange}
              onLikeStateChange={onLikeStateChange}
              isCommentsOpen={openCommentsMemeId === meme.id}
              onToggleComments={(memeId) =>
                setOpenCommentsMemeId((currentId) => (currentId === memeId ? null : memeId))
              }
              // Give high priority to the first 2 images for LCP
              priority={index < 2}
            />
          </Motion.div>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={handleLoadMore}
            className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-violet-500/50 transition-all font-bold text-zinc-300 group"
          >
            Load More Memes
            <ChevronDown size={20} className="group-hover:translate-y-1 transition-transform" />
          </button>
        </div>
      )}
    </div>
  );
}
