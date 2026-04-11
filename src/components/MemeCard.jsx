import { Download, Heart } from "lucide-react";
import { downloadImage } from "../utils/helpers";

export default function MemeCard({
  meme,
  onOpen,
  toggleFavorite,
  favorites,
}) {
  const isFavorite = favorites.includes(meme.id);

  return (
    <div className="group bg-[#101624] border border-white/10 rounded-3xl overflow-hidden hover:border-violet-400/30 transition shadow-lg">
      <div className="relative cursor-pointer" onClick={() => onOpen(meme)}>
        <img
          src={meme.image}
          alt={meme.title}
          className="w-full aspect-[4/5] object-cover group-hover:scale-105 transition duration-500"
        />

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(meme.id);
          }}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 hover:scale-110 transition"
        >
          <Heart
            className={`w-5 h-5 ${
              isFavorite ? "fill-pink-500 text-pink-500" : "text-white"
            }`}
          />
        </button>
      </div>

      <div className="p-5">
        <h3 className="text-2xl font-bold">{meme.title}</h3>
        <p className="text-zinc-400 mt-1">
          {meme.category} • {meme.mood}
        </p>

        <div className="flex flex-wrap gap-2 mt-4">
          {meme.keywords.slice(0, 4).map((tag, index) => (
            <span
              key={index}
              className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-300"
            >
              {tag}
            </span>
          ))}
        </div>

        <button
          onClick={() => downloadImage(meme.image, meme.title)}
          className="mt-5 w-full h-12 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold flex items-center justify-center gap-2 hover:scale-[1.02] transition"
        >
          <Download className="w-5 h-5" />
          Download Meme
        </button>
      </div>
    </div>
  );
}