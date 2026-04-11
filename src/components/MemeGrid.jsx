import { motion as Motion } from "framer-motion";
import { ImageIcon } from "lucide-react";
import MemeCard from "./MemeCard";

export default function MemeGrid({
  memes,
  onOpen,
  toggleFavorite,
  favorites,
  setSearch,
}) {
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

  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-8">
      {memes.map((meme, index) => (
        <Motion.div
          key={meme.id}
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: index * 0.04 }}
        >
          <MemeCard
            meme={meme}
            onOpen={onOpen}
            toggleFavorite={toggleFavorite}
            favorites={favorites}
          />
        </Motion.div>
      ))}
    </div>
  );
}
