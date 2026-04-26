import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { AlertTriangle, Bell, CheckCheck, Heart, Loader2, MessageCircle, RefreshCw, Sparkles, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import Toast from "./Toast";
import {
  formatRelativeTime,
  resolveMemePreviewsByIds,
  resolveSenderUsernames,
} from "../utils/notifications";

function getNotificationTone(type) {
  if (type === "meme") {
    return {
      card: "border-violet-400/25 bg-[linear-gradient(180deg,rgba(139,92,246,0.14),rgba(13,18,32,0.95))]",
      cardHover: "hover:border-violet-300/45 hover:bg-[linear-gradient(180deg,rgba(139,92,246,0.18),rgba(13,18,32,0.98))]",
      preview: "border-violet-400/20 bg-violet-500/10 text-violet-200",
      badge: "border-violet-400/20 bg-violet-500/10 text-violet-200",
      icon: Sparkles,
      iconColor: "text-violet-200",
      chip: "border-violet-400/20 bg-violet-500/10 text-violet-200",
    };
  }

  if (type === "like") {
    return {
      card: "border-sky-400/25 bg-[linear-gradient(180deg,rgba(56,189,248,0.10),rgba(13,18,32,0.95))]",
      cardHover: "hover:border-sky-300/45 hover:bg-[linear-gradient(180deg,rgba(56,189,248,0.14),rgba(13,18,32,0.98))]",
      preview: "border-sky-400/20 bg-sky-500/10 text-sky-200",
      badge: "border-sky-400/20 bg-sky-500/10 text-sky-200",
      icon: Heart,
      iconColor: "text-sky-200",
      chip: "border-sky-400/20 bg-sky-500/10 text-sky-200",
    };
  }

  if (type === "comment") {
    return {
      card: "border-blue-400/25 bg-[linear-gradient(180deg,rgba(59,130,246,0.10),rgba(13,18,32,0.95))]",
      cardHover: "hover:border-blue-300/45 hover:bg-[linear-gradient(180deg,rgba(59,130,246,0.14),rgba(13,18,32,0.98))]",
      preview: "border-blue-400/20 bg-blue-500/10 text-blue-200",
      badge: "border-blue-400/20 bg-blue-500/10 text-blue-200",
      icon: MessageCircle,
      iconColor: "text-blue-200",
      chip: "border-blue-400/20 bg-blue-500/10 text-blue-200",
    };
  }

  if (type === "warning") {
    return {
      card: "border-rose-400/25 bg-[linear-gradient(180deg,rgba(251,113,133,0.12),rgba(13,18,32,0.95))]",
      cardHover: "hover:border-rose-300/45 hover:bg-[linear-gradient(180deg,rgba(251,113,133,0.16),rgba(13,18,32,0.98))]",
      preview: "border-rose-400/20 bg-rose-500/10 text-rose-200",
      badge: "border-rose-500/20 bg-rose-500/10 text-rose-200",
      icon: AlertTriangle,
      iconColor: "text-rose-200",
      chip: "border-rose-400/20 bg-rose-500/10 text-rose-200",
    };
  }

  if (type === "moderation" || type === "report" || type === "alert") {
    return {
      card: "border-red-400/25 bg-[linear-gradient(180deg,rgba(248,113,113,0.12),rgba(13,18,32,0.95))]",
      cardHover: "hover:border-red-300/45 hover:bg-[linear-gradient(180deg,rgba(248,113,113,0.16),rgba(13,18,32,0.98))]",
      preview: "border-red-400/20 bg-red-500/10 text-red-200",
      badge: "border-red-500/20 bg-red-500/10 text-red-200",
      icon: AlertTriangle,
      iconColor: "text-red-200",
      chip: "border-red-400/20 bg-red-500/10 text-red-200",
    };
  }

  return {
    card: "border-white/10 bg-[#0d1220]",
    cardHover: "hover:border-white/20 hover:bg-[#11182a]",
    preview: "border-white/10 bg-white/[0.03] text-zinc-300",
    badge: "border-white/10 bg-white/[0.04] text-zinc-200",
    icon: Heart,
    iconColor: "text-pink-200",
    chip: "border-white/10 bg-white/[0.03] text-zinc-300",
  };
}

export default function NotificationsPage({ user, onBack, onOpenMeme }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState("all");

  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return undefined;

    const timer = window.setTimeout(() => clearToast(), 2800);
    return () => window.clearTimeout(timer);
  }, [toast, clearToast]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const hydrateNotifications = useCallback(async (rows) => {
    const senderLookup = await resolveSenderUsernames(
      (rows || []).map((notification) => notification.sender_id),
      supabase
    );

    return (rows || []).map((notification) => ({
      ...notification,
      sender_username: senderLookup[notification.sender_id] || "Meme fan",
    }));
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, sender_id, meme_id, type, message, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const hydrated = await hydrateNotifications(data || []);
      let memeLookup = {};
      try {
        memeLookup = await resolveMemePreviewsByIds(
          hydrated.map((notification) => notification.meme_id),
          supabase
        );
      } catch (previewError) {
        console.warn("Notification meme preview lookup failed:", previewError);
      }

      setNotifications(
        hydrated.map((notification) => ({
          ...notification,
          meme_title: memeLookup[String(notification.meme_id)]?.title || "",
          meme_image_url: memeLookup[String(notification.meme_id)]?.image_url || "",
          meme_slug: memeLookup[String(notification.meme_id)]?.slug || "",
        }))
      );
    } catch (error) {
      console.error("Notification page load error:", error);
      setToast({
        type: "error",
        title: "Load failed",
        message: error.message || "Could not load notifications.",
        onClose: clearToast,
      });
    } finally {
      setLoading(false);
    }
  }, [clearToast, hydrateNotifications, user?.id]);

  const markAsRead = useCallback(async () => {
    if (!user?.id) return;

    const unreadIds = notifications.filter((notification) => !notification.is_read).map((item) => item.id);
    if (unreadIds.length === 0) return;

    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", unreadIds)
      .eq("user_id", user.id);

    if (error) {
      console.error("Mark notifications read failed:", error);
    }
  }, [notifications, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return undefined;
    }

    fetchNotifications();
    const pollTimer = window.setInterval(() => {
      fetchNotifications();
    }, 30_000);

    const handleFocus = () => {
      fetchNotifications();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(pollTimer);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchNotifications, user?.id]);

  useEffect(() => {
    if (notifications.some((notification) => !notification.is_read)) {
      markAsRead();
    }
  }, [markAsRead, notifications]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") return notifications.filter((notification) => !notification.is_read);
    if (filter === "read") return notifications.filter((notification) => notification.is_read);
    return notifications;
  }, [filter, notifications]);

  const handleNotificationClick = useCallback(
    async (notification) => {
      if (!notification?.meme_id || typeof onOpenMeme !== "function") return;

      if (!notification.is_read) {
        void markAsRead();
      }

      onBack?.();
      window.setTimeout(() => onOpenMeme(notification.meme_id), 0);
    },
    [markAsRead, onBack, onOpenMeme]
  );

  const body = (
    <Motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-4"
    >
      <button
        type="button"
        aria-label="Close notifications"
        onClick={onBack}
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
      />

      <Motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.98 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="relative z-[1] flex w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#070B14] text-white shadow-2xl shadow-black/60 max-h-[calc(100dvh-1.5rem)] sm:rounded-[2rem] sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="flex items-center justify-between border-b border-white/10 bg-[#0d1220] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-300">
              Notification Center
            </p>
            <h1 className="mt-1 text-lg font-black tracking-tight text-white sm:text-2xl">
              Your latest activity
            </h1>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-lg shadow-black/20 transition hover:bg-white/15 hover:text-violet-100"
            aria-label="Close notifications"
          >
            <X className="h-4 w-4" />
          </button>

        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="mb-4 rounded-[1.5rem] border border-white/10 bg-[#0d1220] p-4 shadow-lg shadow-black/10 sm:mb-5 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-3 text-violet-300">
                    <Bell size={20} />
                  </div>
                  <div className="min-w-0">
                  <p className="text-sm text-zinc-400">
                    Likes, comments, and admin warnings appear here...
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-zinc-400">
                      Unread {unreadCount}
                    </span>
                    <span className="hidden sm:inline">Live updates</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  onClick={markAsRead}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/10 sm:px-4 sm:py-3 sm:text-sm"
                >
                  <CheckCheck size={16} />
                  Mark all
                </button>
                <button
                  type="button"
                  onClick={fetchNotifications}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-zinc-200 transition hover:bg-white/10 disabled:opacity-50 sm:px-4 sm:py-3 sm:text-sm"
                >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {["all", "unread", "read"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition sm:text-sm sm:tracking-normal ${
                    filter === item
                      ? "bg-violet-500 text-white shadow-lg shadow-violet-500/20"
                      : "border border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_320px]">
            <section className="space-y-3">
              {loading && notifications.length === 0 ? (
                <div className="rounded-[1.5rem] border border-white/10 bg-[#0d1220] p-8 text-center sm:p-10">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-violet-300" />
                  <p className="mt-3 text-sm text-zinc-400">Loading notifications...</p>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-zinc-400 sm:p-12">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-500">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-200">No notifications yet</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Likes, comments, and warnings on your account will show up here automatically.
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notification) => {
                  const tone = getNotificationTone(notification.type);
                  const Icon = tone.icon;

                  const clickable = Boolean(notification.meme_id && onOpenMeme);

                  return (
                    <Motion.button
                      key={notification.id}
                      type="button"
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      onClick={() => handleNotificationClick(notification)}
                      disabled={!clickable}
                      className={`w-full rounded-[1.35rem] border p-4 text-left shadow-lg shadow-black/10 transition sm:p-5 ${
                        notification.is_read ? tone.card : `${tone.card} ring-1 ring-inset ring-white/5`
                      } ${clickable ? `${tone.cardHover} cursor-pointer` : "cursor-default"}`}
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        {notification.type === "meme" && notification.meme_image_url ? (
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-violet-400/25 bg-violet-500/10 shadow-inner shadow-black/20 sm:h-12 sm:w-12">
                            <img
                              src={notification.meme_image_url}
                              alt={notification.meme_title || "Meme thumbnail"}
                              className="h-full w-full object-cover"
                              draggable={false}
                            />
                          </div>
                        ) : (
                          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border sm:h-12 sm:w-12 ${tone.badge}`}>
                            <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${tone.iconColor}`} />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-white">
                              {notification.sender_username}
                            </p>
                            <span className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                              {formatRelativeTime(notification.created_at, now)}
                            </span>
                          </div>

                          <p className="mt-1 text-sm leading-6 text-zinc-300">{notification.message}</p>

                          {notification.meme_image_url ? (
                            <div className={`mt-3 flex items-center gap-3 rounded-[1.1rem] border p-2 ${tone.preview}`}>
                              <img
                                src={notification.meme_image_url}
                                alt={notification.meme_title || "Meme preview"}
                                className="h-14 w-14 shrink-0 rounded-xl border border-white/10 object-cover"
                                draggable={false}
                              />
                              <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">
                                Meme preview
                              </p>
                              <p className="truncate text-sm font-semibold text-white">
                                {notification.meme_title || "Open to view the meme"}
                              </p>
                            </div>
                              <div className={`ml-auto rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] ${tone.chip}`}>
                                Open meme
                              </div>
                            </div>
                          ) : null}

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 sm:text-xs">
                            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-semibold uppercase tracking-[0.18em] text-zinc-400">
                              {notification.type}
                            </span>
                            <span className="truncate">Meme ID {notification.meme_id}</span>
                          </div>
                        </div>
                      </div>
                    </Motion.button>
                  );
                })
              )}
            </section>

            <aside className="hidden lg:block">
              <div className="sticky top-0 rounded-[1.5rem] border border-white/10 bg-[#0d1220] p-5 shadow-2xl shadow-black/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">
                      Live feed
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-white">Realtime updates</h2>
                  </div>
                  <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-3 text-violet-300">
                    <Sparkles size={20} />
                  </div>
                </div>

                <div className="mt-5 space-y-3 text-sm text-zinc-400">
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4">
                    New likes and comments are streamed in from Supabase in real time.
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4">
                    Opening the popup marks unread notifications as read so your badge stays clean.
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4">
                    The popup is mounted in a portal so it won’t get clipped by the header layout.
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <div className="pointer-events-none fixed right-4 top-4 z-[260] w-[calc(100vw-2rem)] sm:w-auto">
          <Toast toast={toast} className="ml-auto pointer-events-auto" />
        </div>
      </Motion.div>
    </Motion.div>
  );

  if (typeof document === "undefined") {
    return body;
  }

  return createPortal(body, document.body);
}
