import { useState } from "react";
import { X, Download, Heart, SkipForward, Link, MessageCircle, Check } from "lucide-react";

export default function MemeModal({ meme, user, onClose, toggleFavorite, favorites, onNext }) {
  const [copied, setCopied] = useState(false);

  if (!meme) return null;

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

  const getShareUrl = () => {
    const siteUrl = window.location.origin + window.location.pathname;
    return `${siteUrl}?meme=${meme.id}`;
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

  const isFavorite = favorites.includes(meme.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-2 sm:px-4">
      <div className="relative w-full max-w-4xl bg-[#0d1220] border border-white/10 rounded-3xl overflow-y-auto max-h-[95vh] md:max-h-none shadow-2xl md:overflow-hidden scrollbar-hide">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10 p-2 rounded-full bg-black/40 border border-white/20 text-white hover:bg-black/60"
        >
          <X size={20} />
        </button>

        <div className="grid md:grid-cols-2">
          <div className="bg-black/50 flex items-center justify-center min-h-[150px] md:min-h-0">
            <img src={meme.image} alt={meme.title} className="w-full h-full object-contain max-h-[35vh] md:max-h-[80vh]" />
          </div>

          <div className="p-4 sm:p-8 flex flex-col justify-between h-full">
            <div>
              <p className="text-xs sm:text-sm text-violet-300 mb-1 sm:mb-2">{meme.category} • {meme.mood}</p>
              <h2 className="text-xl sm:text-3xl font-bold line-clamp-1 sm:line-clamp-none">{meme.title}</h2>
              <p className="text-xs text-zinc-400 mt-2">
                Uploaded by: <span className="text-zinc-300 font-medium">
                  {meme.username}
                </span>
              </p>

              <div className="flex flex-wrap gap-1.5 mt-3 sm:mt-6">
                {(Array.isArray(meme.keywords) ? meme.keywords : []).map((tag, i) => (
                  <span
                    key={i}
                    className="text-[10px] sm:text-sm px-2 py-1 sm:px-3 sm:py-2 rounded-full bg-white/10 border border-white/10 text-zinc-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 sm:mt-8 space-y-3 sm:space-y-4">
              {onNext && (
                <button
                  onClick={onNext}
                  className="w-full py-2.5 sm:py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90 transition flex items-center justify-center gap-2 font-bold text-white shadow-lg shadow-violet-500/20 text-sm sm:text-base"
                >
                  <SkipForward size={20} />
                  Next Random Meme
                </button>
              )}

              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <button
                  onClick={() => toggleFavorite(meme.id)}
                  className={`py-2 sm:py-3 rounded-2xl border transition flex items-center justify-center gap-2 text-sm sm:text-base ${
                    isFavorite
                      ? "bg-pink-500/80 border-pink-400 text-white"
                      : "bg-white/10 border-white/10 text-white hover:bg-white/15"
                  }`}
                >
                  <Heart size={18} fill={isFavorite ? "currentColor" : "none"} />
                  {isFavorite ? "Saved" : "Save"}
                </button>

                <button
                  onClick={handleDownload}
                  className="py-2 sm:py-3 rounded-2xl bg-white/10 border border-white/10 text-white hover:bg-white/15 transition flex items-center justify-center gap-2 font-medium text-sm sm:text-base"
                >
                  <Download size={18} />
                  Download
                </button>
              </div>

              <div className="pt-4 sm:pt-6 border-t border-white/5 space-y-2 sm:space-y-3">
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold">Share Meme</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 h-10 sm:h-12 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold"
                  >
                    {copied ? <Check size={18} className="text-green-400" /> : <Link size={18} />}
                    {copied ? "Copied Link" : "Copy Link"}
                  </button>
                  <button
                    onClick={shareWhatsApp}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center justify-center text-green-500"
                    title="Share on WhatsApp"
                  >
                    <MessageCircle size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}