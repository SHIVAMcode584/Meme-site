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

const RIZZ_API_URL = "https://rizz-api.vercel.app/api/random";
const STORAGE_KEY = "rizz-generator-saved-v1";
const HISTORY_LIMIT = 5;
const GENERATED_SOURCE = "api";
const FALLBACK_SOURCE = "local";
const GENERATE_COOLDOWN_MS = 900;
const TYPE_SPEED_MS = 18;

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

function extractRizzText(payload, rawText) {
  if (typeof payload === "string") {
    return normalizeText(payload);
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
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(RIZZ_API_URL, {
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
      throw new Error(`Rizz API returned ${response.status}`);
    }

    const rizzText = extractRizzText(payload, rawText);
    if (!rizzText) {
      throw new Error("Empty rizz response");
    }

    return {
      text: rizzText,
      source: GENERATED_SOURCE,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function buildFallbackLine(categoryKey = "all") {
  const safeKey = CATEGORY_OPTIONS.some((item) => item.key === categoryKey) ? categoryKey : "all";
  const pool = safeKey === "all" ? FALLBACK_LINES.all : FALLBACK_LINES[safeKey] || FALLBACK_LINES.all;

  return {
    text: pickRandomItem(pool) || pickRandomItem(FALLBACK_LINES.all),
    source: FALLBACK_SOURCE,
  };
}

export default function RizzGeneratorSidebar({ isOpen, onOpenChange }) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentRizz, setCurrentRizz] = useState(null);
  const [history, setHistory] = useState([]);
  const [savedRizz, setSavedRizz] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [typedText, setTypedText] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [touchStartX, setTouchStartX] = useState(null);
  const lastGenerateAtRef = useRef(0);
  const didOpenRef = useRef(false);

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
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setSavedRizz(
          parsed
            .map((item) => ({
              text: normalizeText(item?.text || ""),
              category: item?.category || "all",
              createdAt: item?.createdAt || new Date().toISOString(),
            }))
            .filter((item) => item.text)
        );
      }
    } catch {
      setSavedRizz([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedRizz));
    } catch {
      // Keep the feature usable even if storage is blocked.
    }
  }, [savedRizz]);

  useEffect(() => {
    if (!isOpen) {
      didOpenRef.current = false;
      return undefined;
    }

    if (didOpenRef.current) return undefined;
    didOpenRef.current = true;

    void generateRizz({ preferApi: true });
    return undefined;
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

  const toggleSaveCurrent = () => {
    if (!currentText) return;

    const normalizedCurrent = normalizeText(currentText).toLowerCase();

    setSavedRizz((current) => {
      const exists = current.some((item) => normalizeText(item.text).toLowerCase() === normalizedCurrent);

      if (exists) {
        setActionMessage("Removed from saved");
        return current.filter((item) => normalizeText(item.text).toLowerCase() !== normalizedCurrent);
      }

      setActionMessage("Saved");
      return [
        {
          text: normalizeText(currentText),
          category: selectedCategory,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ];
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
    setTouchStartX(event.touches?.[0]?.clientX ?? null);
  };

  const handleTouchEnd = (event) => {
    if (touchStartX == null) return;

    const endX = event.changedTouches?.[0]?.clientX ?? touchStartX;
    const deltaX = endX - touchStartX;

    if (deltaX > 70) {
      handleClose();
    }

    setTouchStartX(null);
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen ? (
          <motion.button
            type="button"
            onClick={() => onOpenChange?.(true)}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-4 right-4 z-[180] inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-[#0d1220]/95 px-4 py-3 text-sm font-bold text-fuchsia-100 shadow-2xl shadow-fuchsia-500/20 backdrop-blur-xl transition hover:scale-[1.03] hover:bg-[#121a2f] sm:bottom-6 sm:right-6"
          >
            <Sparkles size={16} className="text-fuchsia-300" />
            Rizz
            <span className="text-base">😏</span>
          </motion.button>
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
              initial={{ x: 420, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 420, opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              drag="x"
              dragDirectionLock
              dragElastic={0.08}
              dragMomentum={false}
              onDragEnd={(_, info) => {
                if (info.offset.x > 90 || info.velocity.x > 700) {
                  handleClose();
                }
              }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="fixed inset-y-0 right-0 z-[185] flex h-[100dvh] w-full max-w-[440px] flex-col border-l border-white/10 bg-[#0b1020]/96 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:rounded-l-[2rem]"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 sm:px-6">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-fuchsia-300">
                    Sidebar tool
                  </p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-white">
                    Rizz Generator 😏
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close rizz sidebar"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 custom-scrollbar">
                <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500">
                        Auto mode
                      </p>
                      <p className="mt-1 text-sm text-zinc-300">
                        A fresh line loads when the sidebar opens.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-100">
                      <Sparkles size={12} />
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
                          className="w-full appearance-none rounded-2xl border border-white/10 bg-[#0d1220] px-4 py-3 pr-10 text-sm font-semibold text-white outline-none transition focus:border-fuchsia-400/40 focus:ring-2 focus:ring-fuchsia-500/20"
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

                    <button
                      type="button"
                      onClick={() => generateRizz({ preferApi: true })}
                      disabled={isGenerating}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-fuchsia-400/20 bg-gradient-to-r from-fuchsia-500/15 to-violet-500/15 px-4 py-3 text-sm font-semibold text-fuchsia-100 transition hover:from-fuchsia-500/25 hover:to-violet-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isGenerating ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <RefreshCw size={16} />
                      )}
                      {isGenerating ? "Generating..." : "Generate Rizz"}
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
                        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-fuchsia-200">
                          Current Rizz
                        </p>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-300">
                          {currentCategoryLabel}
                        </span>
                      </div>

                      <div className="mt-4 min-h-[120px] rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
                        <p className="whitespace-pre-wrap text-lg font-bold leading-8 text-white sm:text-xl">
                          {typedText}
                          {typedText.length < currentText.length ? (
                            <span className="ml-1 inline-block animate-pulse text-fuchsia-300">|</span>
                          ) : null}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={copyCurrent}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
                        >
                          <Copy size={16} />
                          Copy Rizz
                        </button>
                        <button
                          type="button"
                          onClick={() => generateRizz({ preferApi: true })}
                          disabled={isGenerating}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RefreshCw size={16} />
                          New Rizz
                        </button>
                        <button
                          type="button"
                          onClick={toggleSaveCurrent}
                          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-semibold transition ${
                            isCurrentSaved
                              ? "border-pink-400/30 bg-pink-500/10 text-pink-100 hover:bg-pink-500/20"
                              : "border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/10"
                          }`}
                        >
                          <Heart
                            size={16}
                            className={isCurrentSaved ? "fill-pink-500 text-pink-400" : ""}
                          />
                          {isCurrentSaved ? "Saved" : "Save"}
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        <span>{currentRizz?.source === GENERATED_SOURCE ? "API line" : "Fallback line"}</span>
                        <span>{copyStatus || actionMessage || "Fresh"}</span>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className="mt-4 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                        History
                      </p>
                      <h3 className="mt-1 text-sm font-bold text-white">
                        Last {HISTORY_LIMIT} lines
                      </h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-300">
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
                            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-fuchsia-400/30 hover:bg-white/[0.06]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                                {item.category || "all"} / {item.source === GENERATED_SOURCE ? "api" : "fallback"}
                              </span>
                              {saved ? (
                                <Heart size={14} className="fill-pink-500 text-pink-400" />
                              ) : (
                                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
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
                      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-400">
                        Your recent rizz lines will appear here.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-cyan-500/10 via-transparent to-fuchsia-500/10 p-4 text-sm text-zinc-300">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
                    Quick tip
                  </p>
                  <p className="mt-2 leading-6">
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
