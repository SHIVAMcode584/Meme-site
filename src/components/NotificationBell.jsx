import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Bell } from "lucide-react";
import { supabase } from "../lib/supabase";
import Toast from "./Toast";
import { resolveSenderUsernames } from "../utils/notifications";
import NotificationsPage from "./NotificationsPage";

export default function NotificationBell({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [toast, setToast] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.is_read).length,
    [notifications]
  );

  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return undefined;

    const timer = window.setTimeout(() => {
      clearToast();
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [toast, clearToast]);

  const hydrateNotifications = useCallback(async (rows) => {
    const senderLookup = await resolveSenderUsernames((rows || []).map((item) => item.sender_id), supabase);

    return (rows || []).map((notification) => ({
      ...notification,
      sender_username: senderLookup[notification.sender_id] || "Meme fan",
    }));
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, sender_id, meme_id, type, message, is_read, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const hydrated = await hydrateNotifications(data || []);
      setNotifications(hydrated);
    } catch (error) {
      console.error("Notification load error:", error);
    }
  }, [hydrateNotifications, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
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

  if (!user?.id) return null;

  return (
    <div className="relative shrink-0">
      <Motion.button
        type="button"
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen((current) => !current)}
        className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-200 transition hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-100"
        aria-label="Open notifications"
      >
        <Bell className={`h-5 w-5 ${unreadCount > 0 ? "fill-current" : ""}`} />
        {unreadCount > 0 ? (
          <>
            <Motion.span
              key={unreadCount}
              initial={{ scale: 0.75, opacity: 0 }}
              animate={{ scale: [1, 1.16, 1], opacity: 1 }}
              transition={{ duration: 0.38, ease: "easeOut" }}
              className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow-lg shadow-red-500/30"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Motion.span>
            <Motion.span
              key={`${unreadCount}-ring`}
              aria-hidden="true"
              initial={{ opacity: 0.35, scale: 1 }}
              animate={{ opacity: 0, scale: 1.45 }}
              transition={{ duration: 0.75, ease: "easeOut" }}
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full border border-red-400/60"
            />
          </>
        ) : null}
        {unreadCount > 0 ? <span className="absolute inset-0 rounded-2xl bg-red-500/10 animate-pulse" /> : null}
      </Motion.button>

      <AnimatePresence>
        {isOpen ? (
          <NotificationsPage user={user} onBack={() => setIsOpen(false)} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {toast ? (
          <Toast
            toast={{ ...toast, onClose: clearToast }}
            className="fixed right-4 top-4 z-[160] w-[calc(100vw-2rem)] sm:w-auto"
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
