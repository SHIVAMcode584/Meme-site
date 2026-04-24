import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Copy,
  Heart,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";

const RIZZ_API_URLS = [
  "https://rizzapi.vercel.app/random",
  "https://o1swy96l80.execute-api.ap-south-1.amazonaws.com/api/random",
  "https://rizz-api.vercel.app/api/random",
];
const STORAGE_KEY = "rizz-generator-saved-v1";
const HISTORY_LIMIT = 5;
const GENERATED_SOURCE = "api";
const FALLBACK_SOURCE = "local";
const GENERATE_COOLDOWN_MS = 900;
const TYPE_SPEED_MS = 18;
const DEFAULT_DRAWER_WIDTH = 760;
const MIN_DRAWER_WIDTH = 560;
const MAX_DRAWER_WIDTH = 1040;

const CATEGORY_OPTIONS = [
  { key: "all", label: "All Vibes", emoji: "✨" },
  { key: "funny", label: "Funny", emoji: "😄" },
  { key: "smooth", label: "Smooth", emoji: "😎" },
  { key: "savage", label: "Savage", emoji: "💀" },
];

const FALLBACK_LINES = {
  all: [
    "Are you Wi-Fi? Because I feel a strong connection.",
    "You must be the prompt, because you keep pulling the best response out of me.",
    "If charm was a meme, you would be the top post of the day.",
  ],
  funny: [
    "Are you a loading screen? Because I have been waiting for you all day.",
    "You and I would make such a good duo, even the memes would start shipping us.",
    "Are you made of copper and tellurium? Because you are Cu-Te.",
  ],
  smooth: [
    "Your vibe is so clean, even my pickup lines are trying to level up.",
    "I did not plan this, but meeting you just became the best part of my scroll.",
    "You make calm look way too attractive.",
  ],
  savage: [
    "I was going to act cool, but you showed up and raised the difficulty.",
    "You are so fine, even my backup lines are nervous.",
    "I came here for memes, but now I am here trying to impress you.",
  ],
};

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function pickRandomItem(items = []) {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items[Math.floor(Math.random() * items.length)] || "";
}

function dedupeByImage(items = []) {
  const seen = new Set();

  return items.filter((item) => {
    const key = normalizeText(item?.imageUrl || item?.postUrl || item?.id || item?.title || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractRizzText(payload, rawText) {
  if (typeof payload === "string") {
    return normalizeText(payload);
  }

  if (payload && typeof payload === "object" && typeof payload.text === "string") {
    return normalizeText(payload.text);
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const text = extractRizzText(item, rawText);
      if (text) return text;
    }
  }

  if (payload && typeof payload === "object") {
    const candidates = [
      payload.rizz,
      payload.line,
      payload.text,
      payload.message,
      payload.quote,
      payload.joke,
      payload.result,
      payload.output,
      payload.data,
    ];

    for (const candidate of candidates) {
      const text = extractRizzText(candidate, rawText);
      if (text) return text;
    }
  }

  return normalizeText(rawText);
}

async function fetchRizzFromApi() {
  for (const url of RIZZ_API_URLS) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers: {
          accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
        },
      });

      const rawText = await response.text();
      let payload = rawText;

      const contentType = response.headers.get("content-type") || "";
      const looksJson = contentType.includes("application/json") || /^[\s]*[\[{]/.test(rawText);

      if (looksJson) {
        try {
          payload = JSON.parse(rawText);
        } catch {
          payload = rawText;
        }
      }

      if (!response.ok) {
        continue;
      }

      const rizzText =
        typeof payload?.text === "string" ? normalizeText(payload.text) : extractRizzText(payload, rawText);
      if (!rizzText) {
        continue;
      }

      return {
        text: rizzText,
        source: GENERATED_SOURCE,
      };
    } catch {
      // Try the next documented endpoint.
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  throw new Error("Rizz API unavailable");
}

function buildFallbackLine(categoryKey = "all") {
  const safeKey = CATEGORY_OPTIONS.some((item) => item.key === categoryKey) ? categoryKey : "all";
  const pool = safeKey === "all" ? FALLBACK_LINES.all : FALLBACK_LINES[safeKey] || FALLBACK_LINES.all;

  return {
    text: pickRandomItem(pool) || pickRandomItem(FALLBACK_LINES.all),
    source: FALLBACK_SOURCE,
  };
}

function dedupeRizzItems(items = []) {
  const seen = new Set();

  return items.filter((item) => {
    const key = normalizeText(item?.text || "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readLocalSavedRizz() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) return [];

    return dedupeRizzItems(
      parsed
        .map((item) => ({
          text: normalizeText(item?.text || ""),
          category: item?.category || "all",
          source: item?.source || GENERATED_SOURCE,
          createdAt: item?.createdAt || new Date().toISOString(),
        }))
        .filter((item) => item.text)
    );
  } catch {
    return [];
  }
}

function writeLocalSavedRizz(items) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Keep the feature usable even if storage is blocked.
  }
}

function toSavedRizzRecord(item) {
  const text = normalizeText(item?.text || "");

  return {
    text,
    textKey: text.toLowerCase(),
    category: item?.category || "all",
    source: item?.source || GENERATED_SOURCE,
    createdAt: item?.createdAt || item?.created_at || new Date().toISOString(),
  };
}

function mergeSavedRizz(items = []) {
  return dedupeRizzItems(items.map(toSavedRizzRecord).filter((item) => item.text));
}

function toSupabaseSavedRizzRow(item, userId) {
  const record = toSavedRizzRecord(item);

  return {
    user_id: userId,
    text: record.text,
    category: record.category,
    source: record.source,
  };
}

async function syncSavedRizzRow(row) {
  const { error: deleteError } = await supabase
    .from("saved_rizz")
    .delete()
    .eq("user_id", row.user_id)
    .eq("text", row.text);

  if (deleteError) {
    throw deleteError;
  }

  const { error: insertError } = await supabase.from("saved_rizz").insert(row);

  if (insertError) {
    throw insertError;
  }
}

export default function RizzGeneratorSidebar({ isOpen, onOpenChange, user }) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentRizz, setCurrentRizz] = useState(null);
  const [history, setHistory] = useState([]);
  const [savedRizz, setSavedRizz] = useState([]);
  const [isLikedRizzOpen, setIsLikedRizzOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [typedText, setTypedText] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [touchStartY, setTouchStartY] = useState(null);
  const [showIntroPulse, setShowIntroPulse] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(DEFAULT_DRAWER_WIDTH);
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);
  const [isResizingWidth, setIsResizingWidth] = useState(false);
  const lastGenerateAtRef = useRef(0);
  const didOpenRef = useRef(false);
  const didShowIntroRef = useRef(false);
  const resizeStateRef = useRef({
    startX: 0,
    startWidth: DEFAULT_DRAWER_WIDTH,
  });

  const currentText = currentRizz?.text || "";

  const currentCategoryLabel = useMemo(() => {
    return CATEGORY_OPTIONS.find((item) => item.key === selectedCategory)?.label || "All Vibes";
  }, [selectedCategory]);

  const isCurrentSaved = useMemo(() => {
    const normalizedCurrent = normalizeText(currentText).toLowerCase();
    if (!normalizedCurrent) return false;
    return savedRizz.some((item) => normalizeText(item.text).toLowerCase() === normalizedCurrent);
  }, [currentText, savedRizz]);

  useEffect(() => {
    let isCancelled = false;

    const loadSavedRizz = async () => {
      const localSaved = readLocalSavedRizz();

      if (!user?.id) {
        if (!isCancelled) {
          setSavedRizz(localSaved);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from("saved_rizz")
          .select("text, category, source, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const remoteSaved = Array.isArray(data)
          ? data.map((item) =>
              toSavedRizzRecord({
                text: item?.text || "",
                category: item?.category || "all",
                source: item?.source || GENERATED_SOURCE,
                createdAt: item?.created_at || new Date().toISOString(),
              })
            )
          : [];

        const merged = mergeSavedRizz([...remoteSaved, ...localSaved]);

        if (!isCancelled) {
          setSavedRizz(merged);
        }

        const remoteKeys = new Set(remoteSaved.map((item) => item.textKey));
        const localOnly = localSaved.filter((item) => !remoteKeys.has(item.text.toLowerCase()));

        if (localOnly.length > 0) {
          for (const item of localOnly) {
            await syncSavedRizzRow(toSupabaseSavedRizzRow(item, user.id));
          }
        }
      } catch {
        if (!isCancelled) {
          setSavedRizz(localSaved);
        }
      }
    };

    void loadSavedRizz();

    return () => {
      isCancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    writeLocalSavedRizz(savedRizz);
  }, [savedRizz]);

  useEffect(() => {
    if (!isOpen) {
      didOpenRef.current = false;
      setShowIntroPulse(false);
      return undefined;
    }

    if (didOpenRef.current) return undefined;
    didOpenRef.current = true;

    let introTimer = null;
    if (!didShowIntroRef.current) {
      didShowIntroRef.current = true;
      setShowIntroPulse(true);
      introTimer = window.setTimeout(() => setShowIntroPulse(false), 2200);
    }

    void generateRizz({ preferApi: true });
    return () => {
      if (introTimer) {
        window.clearTimeout(introTimer);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!currentText) {
      setTypedText("");
      return undefined;
    }

    setTypedText("");
    let index = 0;
    const step = Math.max(1, Math.ceil(currentText.length / 60));

    const timer = window.setInterval(() => {
      index = Math.min(currentText.length, index + step);
      setTypedText(currentText.slice(0, index));

      if (index >= currentText.length) {
        window.clearInterval(timer);
      }
    }, TYPE_SPEED_MS);

    return () => window.clearInterval(timer);
  }, [currentText]);

  useEffect(() => {
    if (!copyStatus) return undefined;

    const timer = window.setTimeout(() => setCopyStatus(""), 1400);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  useEffect(() => {
    if (!actionMessage) return undefined;

    const timer = window.setTimeout(() => setActionMessage(""), 1800);
    return () => window.clearTimeout(timer);
  }, [actionMessage]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const clampWidth = (value) => {
      const viewportWidth = window.innerWidth;
      const maxWidth = Math.min(MAX_DRAWER_WIDTH, Math.max(MIN_DRAWER_WIDTH, viewportWidth - 48));
      return Math.min(Math.max(value, MIN_DRAWER_WIDTH), maxWidth);
    };

    const updateLayoutMode = () => {
      const desktop = window.innerWidth >= 768;
      setIsDesktopLayout(desktop);
      setDrawerWidth((current) => (desktop ? clampWidth(current) : current));
    };

    updateLayoutMode();
    window.addEventListener("resize", updateLayoutMode);

    return () => window.removeEventListener("resize", updateLayoutMode);
  }, []);

  useEffect(() => {
    if (!isResizingWidth) return undefined;

    const clampWidth = (value) => {
      const viewportWidth = window.innerWidth;
      const maxWidth = Math.min(MAX_DRAWER_WIDTH, Math.max(MIN_DRAWER_WIDTH, viewportWidth - 48));
      return Math.min(Math.max(value, DEFAULT_DRAWER_WIDTH), maxWidth);
    };

    window.document.body.style.cursor = "ew-resize";
    window.document.documentElement.style.cursor = "ew-resize";
    window.document.body.style.userSelect = "none";
    window.document.documentElement.style.userSelect = "none";

    const handlePointerMove = (event) => {
      const deltaX = event.clientX - resizeStateRef.current.startX;
      const nextWidth = clampWidth(resizeStateRef.current.startWidth + deltaX);
      setDrawerWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setIsResizingWidth(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.document.body.style.cursor = "";
      window.document.documentElement.style.cursor = "";
      window.document.body.style.userSelect = "";
      window.document.documentElement.style.userSelect = "";
    };
  }, [isResizingWidth]);

  const handleResizePointerDown = (event) => {
    if (!isDesktopLayout) return;

    event.preventDefault();
    event.stopPropagation();

    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: drawerWidth,
    };

    setIsResizingWidth(true);
  };

  const pushHistory = (nextRizz) => {
    if (!nextRizz?.text) return;

    setHistory((current) => {
      const deduped = current.filter(
        (item) => normalizeText(item.text).toLowerCase() !== normalizeText(nextRizz.text).toLowerCase()
      );

      return [
        {
          text: normalizeText(nextRizz.text),
          source: nextRizz.source || GENERATED_SOURCE,
          category: nextRizz.category || selectedCategory,
          createdAt: nextRizz.createdAt || new Date().toISOString(),
        },
        ...deduped,
      ].slice(0, HISTORY_LIMIT);
    });
  };

  async function generateRizz({ preferApi = true } = {}) {
    if (isGenerating) return;

    const now = Date.now();
    if (now - lastGenerateAtRef.current < GENERATE_COOLDOWN_MS) return;
    lastGenerateAtRef.current = now;

    setIsGenerating(true);
    setCopyStatus("");

    try {
      let nextRizz = null;

      if (preferApi) {
        try {
          const apiRizz = await fetchRizzFromApi();
          nextRizz = {
            text: apiRizz.text,
            source: GENERATED_SOURCE,
          };
        } catch {
          nextRizz = buildFallbackLine(selectedCategory);
        }
      } else {
        nextRizz = buildFallbackLine(selectedCategory);
      }

      const normalized = normalizeText(nextRizz?.text || "");
      if (!normalized) {
        throw new Error("No rizz line returned");
      }

      const finalRizz = {
        text: normalized,
        source: nextRizz.source || GENERATED_SOURCE,
        category: selectedCategory,
        createdAt: new Date().toISOString(),
      };

      setCurrentRizz(finalRizz);
      pushHistory(finalRizz);
      setActionMessage(finalRizz.source === GENERATED_SOURCE ? "Fetched" : "Fallback line");
    } catch {
      const fallback = buildFallbackLine(selectedCategory);
      const finalRizz = {
        text: fallback.text,
        source: fallback.source,
        category: selectedCategory,
        createdAt: new Date().toISOString(),
      };

      setCurrentRizz(finalRizz);
      pushHistory(finalRizz);
      setActionMessage("Fallback line");
    } finally {
      setIsGenerating(false);
    }
  }

  const toggleSaveCurrent = async () => {
    if (!currentText) return;

    const normalizedCurrent = normalizeText(currentText).toLowerCase();
    const currentRecord = {
      text: normalizeText(currentText),
      category: selectedCategory,
      createdAt: new Date().toISOString(),
      source: currentRizz?.source || GENERATED_SOURCE,
    };
    const exists = savedRizz.some((item) => normalizeText(item.text).toLowerCase() === normalizedCurrent);

    if (user?.id) {
      try {
        if (exists) {
          const { error } = await supabase
            .from("saved_rizz")
            .delete()
            .eq("user_id", user.id)
            .eq("text", normalizeText(currentText));

          if (error) throw error;

          setSavedRizz((current) =>
            current.filter((item) => normalizeText(item.text).toLowerCase() !== normalizedCurrent)
          );
          setActionMessage("Removed from liked");
          return;
        }

        await syncSavedRizzRow(toSupabaseSavedRizzRow(currentRecord, user.id));

        setSavedRizz((current) => dedupeRizzItems([currentRecord, ...current]));
        setActionMessage("Saved to Supabase");
        return;
      } catch (error) {
        console.error("Saved rizz sync failed:", error);
        setActionMessage(error?.message ? `Save failed: ${error.message}` : "Save failed");
        return;
      }
    }

    setSavedRizz((current) => {
      if (exists) {
        setActionMessage("Removed from saved");
        return current.filter((item) => normalizeText(item.text).toLowerCase() !== normalizedCurrent);
      }

      setActionMessage("Saved");
      return dedupeRizzItems([currentRecord, ...current]);
    });
  };

  const copyCurrent = async () => {
    if (!currentText) return;

    try {
      await navigator.clipboard.writeText(currentText);
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Copy failed");
    }
  };

  const handleClose = () => onOpenChange?.(false);

  const handleTouchStart = (event) => {
    setTouchStartY(event.touches?.[0]?.clientY ?? null);
  };

  const handleTouchEnd = (event) => {
    if (touchStartY == null) return;

    const endY = event.changedTouches?.[0]?.clientY ?? touchStartY;
    const deltaY = endY - touchStartY;

    if (deltaY > 70) {
      handleClose();
    }

    setTouchStartY(null);
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-4 right-4 z-[180] sm:bottom-6 sm:right-6"
          >
            <button
              type="button"
              onClick={() => onOpenChange?.(true)}
              className="group relative inline-flex items-center overflow-hidden rounded-full p-[1.5px] shadow-2xl shadow-fuchsia-500/20 transition hover:scale-[1.03]"
            >
              <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,var(--app-accent),var(--app-accent-2),#22d3ee,var(--app-accent))] animate-[spin_3.5s_linear_infinite]" />
              <span className="absolute inset-[1px] rounded-full bg-[color:var(--app-surface)]/96 backdrop-blur-xl transition group-hover:bg-[color:var(--app-surface-2)]/96" />
              <span className="relative inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-[color:var(--app-text)]">
                <Sparkles size={16} className="text-[color:var(--app-accent-2)]" />
                Rizz
                <span className="text-base">??</span>
              </span>
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen ? (
          <>
            <motion.button
              type="button"
              aria-label="Close rizz sidebar overlay"
              onClick={handleClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[184] bg-black/70 backdrop-blur-sm"
            />

            <motion.aside
              initial={{ y: 120, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 120, opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              drag={isResizingWidth ? false : "y"}
              dragDirectionLock
              dragElastic={0.08}
              dragMomentum={false}
              onDragEnd={(_, info) => {
                if (info.offset.y > 90 || info.velocity.y > 700) {
                  handleClose();
                }
              }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              style={
                isDesktopLayout
                  ? {
                      left: `calc(50% - ${drawerWidth / 2}px)`,
                      top: "5dvh",
                      right: "auto",
                      bottom: "auto",
                      width: `${drawerWidth}px`,
                    }
                  : undefined
              }
              className="fixed inset-x-0 bottom-0 z-[185] mx-auto flex h-[100dvh] w-full max-w-none flex-col overflow-hidden border-t border-[color:var(--app-border)] bg-[color:var(--app-bg)]/96 shadow-[0_-24px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:bottom-auto md:h-[90dvh] md:rounded-[2rem]"
            >
              {isDesktopLayout ? (
                <div
                  role="presentation"
                  onPointerDown={handleResizePointerDown}
                  className="absolute right-0 top-0 z-20 hidden h-full w-4 cursor-ew-resize bg-transparent md:block"
                />
              ) : null}
              <div className="relative overflow-hidden border-b border-[color:var(--app-border)] px-4 pb-4 pt-3 sm:px-6">
                <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-[color:var(--app-border)]/90 md:hidden" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--app-accent-2)]">
                    Sidebar tool
                  </p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-[color:var(--app-text)]">
                    Rizz Generator ??
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="absolute right-4 top-4 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-2 text-[color:var(--app-muted)] transition hover:bg-[color:var(--app-surface-2)] hover:text-[color:var(--app-text)]"
                  aria-label="Close rizz sidebar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 custom-scrollbar">
                <div className="rounded-[1.75rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 shadow-lg shadow-black/20 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-[color:var(--app-muted)]">
                        Auto mode
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--app-text)]">
                        A fresh line loads when the sidebar opens.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--app-text)]">
                      <Sparkles size={12} className="text-[color:var(--app-accent-2)]" />
                      Ready
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <label className="grid gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                        Category filter
                      </span>
                      <div className="relative">
                        <select
                          value={selectedCategory}
                          onChange={(event) => setSelectedCategory(event.target.value)}
                          className="w-full appearance-none rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-4 py-3 pr-10 text-sm font-semibold text-[color:var(--app-text)] outline-none transition focus:border-[color:var(--app-accent)]/45 focus:ring-2 focus:ring-[color:var(--app-glow)]"
                        >
                          {CATEGORY_OPTIONS.map((option) => (
                            <option key={option.key} value={option.key}>
                              {option.emoji} {option.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={16}
                          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500"
                        />
                      </div>
                    </label>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-[color:var(--app-accent)]/30 bg-[color:var(--app-accent)]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-[color:var(--app-text)]">
                        New
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text)]">
                        <Sparkles size={12} className="text-[color:var(--app-accent-2)]" />
                        New feature introduced
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--app-accent)]/30 bg-[color:var(--app-accent)]/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-[color:var(--app-text)] shadow-[0_0_0_1px_rgba(139,92,246,0.12)]">
                        <Sparkles size={10} className="text-[color:var(--app-accent-2)]" />
                        New!
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => generateRizz({ preferApi: true })}
                      disabled={isGenerating}
                      className={`relative inline-flex items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-accent)]/20 bg-gradient-to-r from-[color:var(--app-accent)]/15 to-[color:var(--app-accent-2)]/15 px-4 py-3 text-sm font-semibold text-[color:var(--app-text)] transition hover:from-[color:var(--app-accent)]/25 hover:to-[color:var(--app-accent-2)]/25 disabled:cursor-not-allowed disabled:opacity-60 ${showIntroPulse ? "animate-pulse shadow-[0_0_0_1px_rgba(217,70,239,0.18),0_0_40px_rgba(139,92,246,0.28)]" : ""}`}
                    >
                      {isGenerating ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <RefreshCw size={16} className="text-[color:var(--app-accent-2)]" />
                      )}
                      <span>{isGenerating ? "Generating..." : "Generate Rizz"}</span>
                    </button>

                  </div>
                </div>
                <AnimatePresence mode="wait">
                  {currentText ? (
                    <motion.div
                      key={currentRizz?.createdAt || currentText}
                      initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: 18, filter: "blur(8px)" }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="mt-4 rounded-[1.75rem] border border-fuchsia-400/20 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.14),rgba(13,18,32,0.96)_55%)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--app-accent-2)]">
                          Current Rizz
                        </p>
                        <span className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--app-text)]">
                          {currentCategoryLabel}
                        </span>
                      </div>

                      <div className="mt-4 min-h-[120px] rounded-[1.5rem] border border-[color:var(--app-border)] bg-[color:var(--app-bg)]/80 p-4">
                        <p className="whitespace-pre-wrap text-lg font-bold leading-8 text-[color:var(--app-text)] sm:text-xl">
                          {typedText}
                          {typedText.length < currentText.length ? (
                            <span className="ml-1 inline-block animate-pulse text-[color:var(--app-accent-2)]">|</span>
                          ) : null}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={copyCurrent}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-3 text-sm font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface)]"
                        >
                          <Copy size={16} />
                          Copy Rizz
                        </button>
                        <button
                          type="button"
                          onClick={() => generateRizz({ preferApi: true })}
                          disabled={isGenerating}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-3 text-sm font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RefreshCw size={16} />
                          New Rizz
                        </button>
                        <button
                          type="button"
                          onClick={toggleSaveCurrent}
                          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                            isCurrentSaved
                              ? "border-[color:var(--app-accent)]/30 bg-[color:var(--app-accent)]/10 text-[color:var(--app-text)] hover:bg-[color:var(--app-accent)]/20"
                              : "border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface)]"
                          }`}
                        >
                          <Heart
                            size={16}
                            className={isCurrentSaved ? "fill-[color:var(--app-accent)] text-[color:var(--app-accent)]" : ""}
                          />
                          {isCurrentSaved ? "Saved" : "Save"}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsLikedRizzOpen((current) => !current)}
                        className={`mt-3 inline-flex w-full items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                          isLikedRizzOpen
                            ? "border-[color:var(--app-accent)]/30 bg-[color:var(--app-accent)]/10 text-[color:var(--app-text)] hover:bg-[color:var(--app-accent)]/20"
                            : "border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface)]"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Heart
                            size={16}
                            className={isLikedRizzOpen ? "fill-[color:var(--app-accent)] text-[color:var(--app-accent)]" : ""}
                          />
                          Liked Rizz
                        </span>
                        <span className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-bg)]/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]">
                          {savedRizz.length}
                        </span>
                      </button>

                      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        <span>{currentRizz?.source === GENERATED_SOURCE ? "API line" : "Fallback line"}</span>
                        <span>{copyStatus || actionMessage || "Fresh"}</span>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <AnimatePresence initial={false}>
                  {isLikedRizzOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0, y: -8 }}
                      animate={{ height: "auto", opacity: 1, y: 0 }}
                      exit={{ height: 0, opacity: 0, y: -8 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="mt-4 overflow-hidden rounded-[1.75rem] border border-[color:var(--app-accent)]/20 bg-[color:var(--app-surface)] p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--app-accent-2)]">
                            Liked Rizz
                          </p>
                          <h3 className="mt-1 text-sm font-bold text-white">
                            Your saved lines
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsLikedRizzOpen(false)}
                          className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] p-2 text-[color:var(--app-muted)] transition hover:bg-[color:var(--app-surface)] hover:text-[color:var(--app-text)]"
                          aria-label="Close liked rizz"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3">
                        {savedRizz.length > 0 ? (
                          savedRizz.map((item, index) => (
                            <button
                              key={`${item.createdAt}-${index}`}
                              type="button"
                              onClick={() =>
                                setCurrentRizz({
                                  text: item.text,
                                  source: item.source || GENERATED_SOURCE,
                                  category: item.category || selectedCategory,
                                  createdAt: item.createdAt,
                                })
                              }
                              className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] p-4 text-left transition hover:border-[color:var(--app-accent)]/30 hover:bg-[color:var(--app-surface)]"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                                  {item.category || "all"} / {item.source === GENERATED_SOURCE ? "api" : "fallback"}
                                </span>
                                <Heart size={14} className="fill-[color:var(--app-accent)] text-[color:var(--app-accent)]" />
                              </div>
                              <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-200">
                                {item.text}
                              </p>
                            </button>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-bg)]/80 p-4 text-sm text-[color:var(--app-muted)]">
                            Save a rizz line first, then it will appear here.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className="mt-4 rounded-[1.75rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                        History
                      </p>
                      <h3 className="mt-1 text-sm font-bold text-white">
                        Last {HISTORY_LIMIT} lines
                      </h3>
                    </div>
                    <span className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--app-text)]">
                      {history.length}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {history.length > 0 ? (
                      history.map((item, index) => {
                        const saved = savedRizz.some(
                          (savedItem) =>
                            normalizeText(savedItem.text).toLowerCase() ===
                            normalizeText(item.text).toLowerCase()
                        );

                        return (
                          <button
                            key={`${item.createdAt}-${index}`}
                            type="button"
                            onClick={() =>
                              setCurrentRizz({
                                text: item.text,
                                source: item.source,
                                category: item.category,
                                createdAt: item.createdAt,
                              })
                            }
                            className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] p-4 text-left transition hover:border-[color:var(--app-accent)]/30 hover:bg-[color:var(--app-surface)]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                                {item.category || "all"} / {item.source === GENERATED_SOURCE ? "api" : "fallback"}
                              </span>
                              {saved ? (
                                <Heart size={14} className="fill-[color:var(--app-accent)] text-[color:var(--app-accent)]" />
                              ) : (
                                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--app-muted)]">
                                  tap to reuse
                                </span>
                              )}
                            </div>
                            <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-200">
                              {item.text}
                            </p>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-bg)]/80 p-4 text-sm text-[color:var(--app-muted)]">
                        Your recent rizz lines will appear here.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-[1.75rem] border border-[color:var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4 text-sm text-[color:var(--app-text)]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--app-accent-2)]">
                    Quick tip
                  </p>
                  <p className="mt-2 leading-6 text-[color:var(--app-muted)]">
                    Open the sidebar, generate a line, then copy or save the ones you like.
                    If the API is slow, the generator falls back to local rizz automatically.
                  </p>
                </div>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}



