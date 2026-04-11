import { X, Download, Heart } from "lucide-react";
import { downloadImage } from "../utils/helpers";

export default function MemeModal({ meme, onClose, toggleFavorite, favorites }) {
  if (!meme) return null;

  const isFavorite = favorites.includes(meme.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center px-4">
      <div className="relative w-full max-w-4xl bg-[#0d1220] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 border border-white/20 text-white hover:bg-black/60"
        >
          <X size={20} />
        </button>

        <div className="grid md:grid-cols-2">
          <div className="bg-black">
            <img src={meme.image} alt={meme.title} className="w-full h-full object-cover max-h-[80vh]" />
          </div>

          <div className="p-8 flex flex-col justify-between">
            <div>
              <p className="text-sm text-violet-300 mb-2">{meme.category} • {meme.mood}</p>
              <h2 className="text-3xl font-bold">{meme.title}</h2>

              <div className="flex flex-wrap gap-2 mt-6">
                {meme.keywords.map((tag, i) => (
                  <span
                    key={i}
                    className="text-sm px-3 py-2 rounded-full bg-white/10 border border-white/10 text-zinc-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-10">
              <button
                onClick={() => toggleFavorite(meme.id)}
                className={`py-3 rounded-2xl border transition flex items-center justify-center gap-2 ${
                  isFavorite
                    ? "bg-pink-500/80 border-pink-400 text-white"
                    : "bg-white/10 border-white/10 text-white hover:bg-white/15"
                }`}
              >
                <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
                {isFavorite ? "Saved" : "Save"}
              </button>

              <button
                onClick={() => downloadImage(meme.image, meme.title)}
                className="py-3 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90 transition flex items-center justify-center gap-2 font-medium"
              >
                <Download size={18} />
                Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}