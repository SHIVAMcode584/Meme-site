import { Download, Heart } from "lucide-react";

export default function MemeCard({ meme, onOpen, toggleFavorite, favorites }) {
  const isFavorite = favorites.includes(meme.id);

  const handleDownload = async () => {
    try {
      const response = await fetch(meme.image);
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
          className="absolute top-2 right-2 sm:top-4 sm:right-4 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 hover:scale-110 transition"
        >
          <Heart
            className={`w-4 h-4 sm:w-5 sm:h-5 ${
              isFavorite ? "fill-pink-500 text-pink-500" : "text-white"
            }`}
          />
        </button>
      </div>

      <div className="p-3 sm:p-5">
        <h3 className="text-sm sm:text-2xl font-bold line-clamp-1 sm:line-clamp-none">{meme.title}</h3>
        <p className="text-[10px] sm:text-sm text-zinc-400 mt-0.5 sm:mt-1">
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

        <button
          onClick={handleDownload}
          className="mt-3 sm:mt-5 w-full h-9 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-[10px] sm:text-base font-semibold flex items-center justify-center gap-1.5 sm:gap-2 hover:scale-[1.02] transition"
        >
          <Download className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden xs:inline">Download</span>
        </button>
      </div>
    </div>
  );
}