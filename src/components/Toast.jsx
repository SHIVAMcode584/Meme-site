import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";

const TOAST_STYLES = {
  success: {
    container: "border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
    icon: "bg-emerald-500/15 text-emerald-300",
    iconNode: CheckCircle2,
  },
  error: {
    container: "border-red-400/20 bg-red-500/10 text-red-100",
    icon: "bg-red-500/15 text-red-300",
    iconNode: AlertTriangle,
  },
  warning: {
    container: "border-amber-400/20 bg-amber-500/10 text-amber-50",
    icon: "bg-amber-500/15 text-amber-200",
    iconNode: AlertTriangle,
  },
  loading: {
    container: "border-violet-400/20 bg-violet-500/10 text-violet-100",
    icon: "bg-violet-500/15 text-violet-300",
    iconNode: Loader2,
  },
};

export default function Toast({ toast, className = "" }) {
  if (!toast) return null;

  const tone = TOAST_STYLES[toast.type] || TOAST_STYLES.success;
  const Icon = tone.iconNode;
  const isActionable = Boolean(toast.actionLabel && typeof toast.onAction === "function");

  const handleAction = () => {
    toast.onAction?.();
    toast.onClose?.();
  };

  const handleKeyDown = (event) => {
    if (!isActionable) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleAction();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-2xl shadow-black/25 backdrop-blur-xl transition ${tone.container} ${isActionable ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-black/35" : ""} ${className}`}
      role={isActionable ? "button" : "status"}
      tabIndex={isActionable ? 0 : undefined}
      aria-live="polite"
      onClick={isActionable ? handleAction : undefined}
      onKeyDown={isActionable ? handleKeyDown : undefined}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
        <Icon className={toast.type === "loading" ? "h-5 w-5 animate-spin" : "h-5 w-5"} />
      </div>

      <div className="min-w-0 flex-1">
        {toast.title ? <p className="text-sm font-bold">{toast.title}</p> : null}
        <p className="text-sm opacity-90">{toast.message}</p>
        {toast.previewImage ? (
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2">
            <img
              src={toast.previewImage}
              alt={toast.previewTitle || "Meme preview"}
              className="h-10 w-10 shrink-0 rounded-xl border border-white/10 object-cover"
              draggable={false}
            />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">
                New meme
              </p>
              <p className="truncate text-xs font-semibold opacity-95">
                {toast.previewTitle || "Open to view"}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {toast.actionLabel && typeof toast.onAction === "function" ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            handleAction();
          }}
          className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-current transition hover:bg-white/15"
        >
          {toast.actionLabel}
        </button>
      ) : null}

      {toast.dismissible !== false ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            toast.onClose?.();
          }}
          disabled={!toast.onClose}
          className="rounded-full p-1 text-current/70 transition hover:bg-white/10 hover:text-white"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </motion.div>
  );
}
