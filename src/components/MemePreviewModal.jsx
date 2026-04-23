import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Copy, Download, Sparkles, Upload, X } from "lucide-react";
import { downloadImage } from "../utils/helpers";

function sanitizeFileName(value) {
  return String(value || "meme")
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "meme";
}

export default function MemePreviewModal({ item, onClose, onUploadToRoastRiot }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  const imageUrl = item?.imageUrl || "";
  const title = item?.title || "Meme preview";

  useEffect(() => {
    if (!item) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [item, onClose]);

  useEffect(() => {
    if (!copyStatus) return undefined;

    const timer = window.setTimeout(() => setCopyStatus(""), 1400);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  const handleDownload = async () => {
    if (!imageUrl) return;

    setIsDownloading(true);

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${sanitizeFileName(title)}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch {
      downloadImage(imageUrl, sanitizeFileName(title));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!imageUrl) return;

    try {
      await navigator.clipboard.writeText(imageUrl);
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Copy failed");
    }
  };

  const handleUpload = () => {
    onUploadToRoastRiot?.(item);
    onClose?.();
  };

  const modalContent = item ? (
      <Motion.div
        key={imageUrl || title}
        className="fixed inset-0 z-[170] flex items-stretch justify-center p-0 xl:left-[18rem] xl:right-4 xl:top-4 xl:bottom-4 xl:items-center xl:px-4"
      >
        <Motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
          aria-label="Close meme preview"
        />

        <Motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ duration: 0.24, ease: "easeOut" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="meme-preview-title"
          aria-describedby="meme-preview-description"
          className="relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden bg-[#0d1220] shadow-2xl shadow-black/55 xl:h-[92dvh] xl:max-w-6xl xl:rounded-[2rem]"
        >
          <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-3 xl:hidden">
            <div className="h-1.5 w-14 rounded-full bg-white/15" />
          </div>

          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-30 rounded-full border border-white/15 bg-black/45 p-2 text-white transition hover:bg-black/65 xl:hidden"
            aria-label="Close meme preview"
          >
            <X size={20} />
          </button>

          <div className="grid h-full min-h-0 xl:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)]">
            <div className="relative flex min-h-[38vh] select-none items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#312e81_0%,#0b1020_55%,#05070d_100%)] px-4 pb-4 pt-10 sm:min-h-[46vh] sm:px-6 sm:pb-6 sm:pt-14 xl:min-h-0 xl:px-8 xl:py-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(236,72,153,0.18),transparent_45%)]" />

              <div className="relative flex max-h-full w-full items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/35 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-3">
                <img
                  src={imageUrl}
                  alt={title}
                  className="max-h-[34vh] w-auto max-w-full rounded-[1.25rem] object-contain sm:max-h-[44vh] xl:max-h-[76vh]"
                />
              </div>

              <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[11px] font-semibold text-white/80 backdrop-blur-md xl:hidden">
                <Sparkles size={12} />
                Preview
              </div>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden border-t border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] xl:border-l xl:border-t-0">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6 xl:hidden">
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
                  Meme Preview
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10"
                  aria-label="Close preview"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4 sm:px-6 sm:pb-6 sm:pt-5 custom-scrollbar">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4 shadow-lg shadow-black/20 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
                        Meme Preview
                      </p>
                      <h3 id="meme-preview-title" className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">
                        {title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="hidden rounded-full border border-white/10 bg-white/5 p-2 text-white transition hover:bg-white/10 xl:inline-flex"
                      aria-label="Close preview"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                      Preview
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                      From Reddit
                    </span>
                  </div>

                  <p id="meme-preview-description" className="mt-4 text-sm leading-6 text-zinc-300">
                    Review the image here first, then send it to RoastRiot, download a copy, or copy the direct image link.
                  </p>
                </div>

                <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-4 sm:mt-5 sm:p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                    Source URL
                  </p>
                  <p className="mt-2 break-all text-xs leading-5 text-zinc-300">
                    {imageUrl}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={handleUpload}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110 sm:col-span-1"
                  >
                    <Upload size={16} />
                    Upload
                  </button>

                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-1"
                  >
                    <Download size={16} />
                    {isDownloading ? "Downloading..." : "Download"}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08] sm:col-span-1"
                  >
                    <Copy size={16} />
                    {copyStatus || "Copy link"}
                  </button>
                </div>

                <div className="mt-4 rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.03] p-3 text-xs text-zinc-400 sm:mt-5 sm:p-4 sm:text-sm">
                  Tap outside the popup or press Escape to close it.
                </div>
              </div>
            </div>
          </div>
        </Motion.div>
      </Motion.div>
  ) : null;

  const body = (
    <AnimatePresence>
      {modalContent}
    </AnimatePresence>
  );

  if (typeof document === "undefined") {
    return body;
  }

  return createPortal(body, document.body);
}
