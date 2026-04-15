import { useState, useEffect } from "react";
import { motion as Motion } from "framer-motion";
import { Image as ImageIcon, ChevronDown } from "lucide-react";
import MemeCard from "./MemeCard";

export default function MemeGrid({
  memes,
  onOpen,
  toggleFavorite,
  favorites,
  setSearch,
}) {
  const ITEMS_PER_PAGE = 6;
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Reset visible count when the memes list changes (due to search/filter)
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [memes]);

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

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  };

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8">
        {displayedMemes.map((meme, index) => (
          <Motion.div
            key={`${meme.id}-${index}`}
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: (index % ITEMS_PER_PAGE) * 0.04 }}
          >
            <MemeCard
              meme={meme}
              onOpen={onOpen}
              toggleFavorite={toggleFavorite}
              favorites={favorites}
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
