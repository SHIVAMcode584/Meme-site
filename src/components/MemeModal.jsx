import { useState } from "react";
import { X, Download, Heart, SkipForward, Link, MessageCircle, Check } from "lucide-react";

export default function MemeModal({ meme, onClose, toggleFavorite, favorites, onNext }) {
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
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center px-4">
      <div className="relative w-full max-w-4xl bg-[#0d1220] border border-white/10 rounded-3xl overflow-y-auto max-h-[90vh] md:max-h-none shadow-2xl md:overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 border border-white/20 text-white hover:bg-black/60"
        >
          <X size={20} />
        </button>

        <div className="grid md:grid-cols-2">
          <div className="bg-black/50 flex items-center justify-center min-h-[200px] md:min-h-0">
            <img src={meme.image} alt={meme.title} className="w-full h-full object-contain max-h-[40vh] md:max-h-[80vh]" />
          </div>

          <div className="p-5 sm:p-8 flex flex-col justify-between">
            <div>
              <p className="text-sm text-violet-300 mb-2">{meme.category} • {meme.mood}</p>
              <h2 className="text-2xl sm:text-3xl font-bold">{meme.title}</h2>

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

            <div className="mt-6 sm:mt-10 space-y-4">
              {onNext && (
                <button
                  onClick={onNext}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90 transition flex items-center justify-center gap-2 font-bold text-white shadow-lg shadow-violet-500/20"
                >
                  <SkipForward size={20} />
                  Next Random Meme
                </button>
              )}

              <div className="grid grid-cols-2 gap-4">
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
                  onClick={handleDownload}
                  className="py-3 rounded-2xl bg-white/10 border border-white/10 text-white hover:bg-white/15 transition flex items-center justify-center gap-2 font-medium"
                >
                  <Download size={18} />
                  Download
                </button>
              </div>

              <div className="pt-6 border-t border-white/5 space-y-3">
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-bold">Share Meme</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center justify-center gap-2 text-sm font-semibold"
                  >
                    {copied ? <Check size={18} className="text-green-400" /> : <Link size={18} />}
                    {copied ? "Copied Link" : "Copy Link"}
                  </button>
                  <button
                    onClick={shareWhatsApp}
                    className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center justify-center text-green-500"
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