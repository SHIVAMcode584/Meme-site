import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Copy,
  ExternalLink,
  Heart,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from "lucide-react";

const RIZZ_API_URLS = [
  "https://rizzapi.vercel.app/random",
  "https://o1swy96l80.execute-api.ap-south-1.amazonaws.com/api/random",
  "https://rizz-api.vercel.app/api/random",
];
const STORAGE_KEY = "rizz-generator-saved-v1";
const HISTORY_LIMIT = 5;
const GENERATED_SOURCE = "api";
const FALLBACK_SOURCE = "local";
const KEYWORD_SEARCH_LIMIT = 20;
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

export default function RizzGeneratorSidebar({ isOpen, onOpenChange }) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentRizz, setCurrentRizz] = useState(null);
  const [history, setHistory] = useState([]);
  const [savedRizz, setSavedRizz] = useState([]);
  const [isKeywordSearchOpen, setIsKeywordSearchOpen] = useState(false);
  const [keywordQuery, setKeywordQuery] = useState("");
  const [keywordSearchResults, setKeywordSearchResults] = useState([]);
  const [keywordSearchActiveQuery, setKeywordSearchActiveQuery] = useState("");
  const [keywordSearchSource, setKeywordSearchSource] = useState("idle");
  const [keywordSearchReason, setKeywordSearchReason] = useState("");
  const [keywordSearchHasMore, setKeywordSearchHasMore] = useState(false);
  const [keywordSearchAfter, setKeywordSearchAfter] = useState(null);
  const [keywordSearchPage, setKeywordSearchPage] = useState(1);
  const [keywordSearchLoading, setKeywordSearchLoading] = useState(false);
  const [keywordSearchLoadingMore, setKeywordSearchLoadingMore] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [typedText, setTypedText] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [touchStartX, setTouchStartX] = useState(null);
  const [showIntroPulse, setShowIntroPulse] = useState(false);
  const keywordInputRef = useRef(null);
  const lastGenerateAtRef = useRef(0);
  const didOpenRef = useRef(false);
  const didShowIntroRef = useRef(false);
  const keywordSearchAbortRef = useRef(null);
  const keywordSearchRequestIdRef = useRef(0);
  const keywordSearchCacheRef = useRef(new Map());

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
    if (!isKeywordSearchOpen) return undefined;

    const timer = window.setTimeout(() => {
      keywordInputRef.current?.focus();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [isKeywordSearchOpen]);

  useEffect(() => {
    return () => {
      if (keywordSearchAbortRef.current) {
        keywordSearchAbortRef.current.abort();
        keywordSearchAbortRef.current = null;
      }
    };
  }, []);

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
          source: currentRizz?.source || GENERATED_SOURCE,
        },
        ...current,
      ];
    });
  };

  const openKeywordSearch = () => {
    setIsKeywordSearchOpen(true);
    setActionMessage("Search opened");
  };

  const closeKeywordSearch = () => {
    setIsKeywordSearchOpen(false);
  };

  async function loadKeywordMemeResults({ query, page = 1, after = null, append = false } = {}) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return;

    const cacheKey = `${normalizedQuery.toLowerCase()}|${page}|${after || ""}`;
    const cached = keywordSearchCacheRef.current.get(cacheKey);
    if (cached) {
      if (append) {
        setKeywordSearchResults((current) => dedupeByImage([...current, ...cached.results]));
      } else {
        setKeywordSearchResults(cached.results);
      }
      setKeywordSearchSource(cached.source);
      setKeywordSearchReason(cached.reason || "");
      setKeywordSearchHasMore(cached.hasMore);
      setKeywordSearchAfter(cached.after);
      setKeywordSearchPage(cached.nextPage);
      setKeywordSearchActiveQuery(normalizedQuery);
      setKeywordSearchLoading(false);
      setKeywordSearchLoadingMore(false);
      return;
    }

    keywordSearchRequestIdRef.current += 1;
    const requestId = keywordSearchRequestIdRef.current;

    if (keywordSearchAbortRef.current) {
      keywordSearchAbortRef.current.abort();
    }

    const controller = new AbortController();
    keywordSearchAbortRef.current = controller;

    if (append) {
      setKeywordSearchLoadingMore(true);
    } else {
      setKeywordSearchLoading(true);
    }
    setKeywordSearchReason("");
    let requestTimeoutId = null;

    try {
      const url = new URL("/api/keyword-meme-search", window.location.origin);
      url.searchParams.set("q", normalizedQuery);
      url.searchParams.set("limit", String(KEYWORD_SEARCH_LIMIT));
      url.searchParams.set("page", String(page));
      if (after) {
        url.searchParams.set("after", after);
      }

      if (requestId !== keywordSearchRequestIdRef.current) return;

      requestTimeoutId = window.setTimeout(() => controller.abort(), 12000);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
      });
      const payload = await response.json();

      if (requestId !== keywordSearchRequestIdRef.current) return;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Keyword meme search failed.");
      }

      const nextResults = dedupeByImage(Array.isArray(payload?.results) ? payload.results : []);
      const nextSource = payload?.source || "reddit";
      const nextReason = payload?.reason || "";
      const nextHasMore = Boolean(payload?.hasMore);
      const nextAfter = payload?.after || null;
      const nextPage = page + 1;

      setKeywordSearchResults((current) =>
        append ? dedupeByImage([...current, ...nextResults]) : nextResults
      );
      setKeywordSearchSource(nextSource);
      setKeywordSearchReason(nextReason);
      setKeywordSearchHasMore(nextHasMore);
      setKeywordSearchAfter(nextAfter);
      setKeywordSearchPage(nextPage);
      setKeywordSearchActiveQuery(normalizedQuery);
      setActionMessage(nextResults.length > 0 ? `Found ${nextResults.length} memes` : "No memes found");

      keywordSearchCacheRef.current.set(cacheKey, {
        results: nextResults,
        source: nextSource,
        reason: nextReason,
        hasMore: nextHasMore,
        after: nextAfter,
        nextPage,
      });
    } catch (error) {
      if (requestId !== keywordSearchRequestIdRef.current) return;
      setKeywordSearchResults([]);
      setKeywordSearchSource("idle");
      setKeywordSearchReason(
        error?.name === "AbortError"
          ? "Search timed out. Try another keyword."
          : error.message || "Keyword meme search failed."
      );
      setKeywordSearchHasMore(false);
      setKeywordSearchAfter(null);
      setKeywordSearchPage(1);
      setActionMessage(
        error?.name === "AbortError"
          ? "Search timed out"
          : error.message || "Keyword meme search failed."
      );
    } finally {
      if (requestTimeoutId) {
        window.clearTimeout(requestTimeoutId);
      }
      if (requestId !== keywordSearchRequestIdRef.current) return;
      if (append) {
        setKeywordSearchLoadingMore(false);
      } else {
        setKeywordSearchLoading(false);
      }
    }
  }

  function handleKeywordSearchSubmit(event) {
    event.preventDefault();
    void loadKeywordMemeResults({ query: keywordQuery, page: 1, after: null, append: false });
  }

  function handleLoadMoreKeywordMemes() {
    if (!keywordSearchActiveQuery || keywordSearchLoading || keywordSearchLoadingMore || !keywordSearchHasMore) {
      return;
    }

    void loadKeywordMemeResults({
      query: keywordSearchActiveQuery,
      page: keywordSearchPage,
      after: keywordSearchAfter,
      append: true,
    });
  }

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
              className="fixed inset-y-0 right-0 z-[185] flex h-[100dvh] w-full max-w-[460px] flex-col border-l border-[color:var(--app-border)] bg-[color:var(--app-bg)]/96 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:rounded-l-[2rem]"
            >
              <div className="relative overflow-hidden border-b border-[color:var(--app-border)] px-4 py-4 sm:px-6">
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

                    <button
                      type="button"
                      onClick={() => (isKeywordSearchOpen ? closeKeywordSearch() : openKeywordSearch())}
                      className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                        isKeywordSearchOpen
                          ? "border-cyan-400/30 bg-[color:var(--app-accent)]/10 text-[color:var(--app-text)] hover:bg-cyan-500/20"
                          : "border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface)]"
                      }`}
                    >
                      <Search size={16} />
                      Search by keyword
                      <ChevronDown
                        size={14}
                        className={`transition-transform ${isKeywordSearchOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                </div>

                <AnimatePresence initial={false}>
                  {isKeywordSearchOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0, y: -8 }}
                      animate={{ height: "auto", opacity: 1, y: 0 }}
                      exit={{ height: 0, opacity: 0, y: -8 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="mt-4 overflow-hidden rounded-[1.75rem] border border-cyan-400/20 bg-cyan-500/[0.06] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--app-accent-2)]">
                            Meme keyword search
                          </p>
                          <p className="mt-1 text-sm text-[color:var(--app-text)]">
                            Search Reddit memes by keyword and keep the results inside this sidebar.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={closeKeywordSearch}
                          className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-2 text-[color:var(--app-muted)] transition hover:bg-[color:var(--app-surface-2)] hover:text-[color:var(--app-text)]"
                          aria-label="Close keyword search"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <form className="mt-4 flex gap-2" onSubmit={handleKeywordSearchSubmit}>
                        <div className="group relative flex-1 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)]">
                          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 group-focus-within:text-[color:var(--app-accent)]" />
                          <input
                            ref={keywordInputRef}
                            type="text"
                            value={keywordQuery}
                            onChange={(event) => setKeywordQuery(event.target.value)}
                            placeholder="Search memes (e.g. exam, love, coding...)"
                            className="h-12 w-full rounded-2xl bg-transparent pl-11 pr-4 text-sm text-white outline-none placeholder:text-zinc-500"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={keywordSearchLoading}
                          className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-4 text-sm font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent)]/35 hover:bg-[color:var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {keywordSearchLoading ? "Searching..." : "Search"}
                        </button>
                        {keywordQuery ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (keywordSearchAbortRef.current) {
                                keywordSearchAbortRef.current.abort();
                                keywordSearchAbortRef.current = null;
                              }
                              setKeywordQuery("");
                              setKeywordSearchResults([]);
                              setKeywordSearchActiveQuery("");
                              setKeywordSearchSource("idle");
                              setKeywordSearchReason("");
                              setKeywordSearchHasMore(false);
                              setKeywordSearchAfter(null);
                              setKeywordSearchPage(1);
                              setKeywordSearchLoading(false);
                              setKeywordSearchLoadingMore(false);
                              setActionMessage("Keyword cleared");
                            }}
                            className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-4 text-sm font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface)]"
                          >
                            Clear
                          </button>
                        ) : null}
                      </form>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {["exam", "love", "coding", "gym"].map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => {
                              setKeywordQuery(item);
                              void loadKeywordMemeResults({ query: item, page: 1, after: null, append: false });
                            }}
                            className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent)]/30 hover:bg-[color:var(--app-surface)]"
                          >
                            #{item}
                          </button>
                        ))}
                      </div>

                      <div className="mt-4">
                        {keywordSearchLoading ? (
                          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)]/80 p-4 text-sm text-[color:var(--app-muted)]">
                            <div className="flex items-center gap-3">
                              <Loader2 size={16} className="animate-spin text-[color:var(--app-accent-2)]" />
                              Searching Reddit memes...
                            </div>
                          </div>
                        ) : null}

                        {!keywordSearchLoading && keywordSearchResults.length > 0 ? (
                          <div className="grid gap-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--app-muted)]">
                                {keywordSearchActiveQuery || "Results"}
                              </p>
                              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--app-accent-2)]">
                                {keywordSearchSource === "reddit" ? "Reddit" : "Fallback"}
                              </span>
                            </div>

                            {keywordSearchResults.map((item, index) => {
                              const link = item.postUrl || item.permalink || item.imageUrl;

                              return (
                                <a
                                  key={`${item.id}-${index}`}
                                  href={link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="group overflow-hidden rounded-[1.25rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] transition hover:border-[color:var(--app-accent)]/30 hover:bg-[color:var(--app-surface)]"
                                >
                                  <div className="flex gap-3 p-3">
                                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)]">
                                      {item.imageUrl ? (
                                        <img
                                          src={item.imageUrl}
                                          alt={item.title}
                                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                          loading="lazy"
                                          decoding="async"
                                        />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-zinc-600">
                                          <ImageIcon size={18} />
                                        </div>
                                      )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                                          {item.subreddit || "r/memes"}
                                        </span>
                                        <ExternalLink
                                          size={14}
                                          className="shrink-0 text-zinc-500 transition group-hover:text-[color:var(--app-accent-2)]"
                                        />
                                      </div>
                                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-white">
                                        {item.title}
                                      </p>
                                    </div>
                                  </div>
                                </a>
                              );
                            })}

                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[11px] text-zinc-500">
                                Tap a result to open the meme on Reddit.
                              </p>
                              {keywordSearchHasMore ? (
                                <button
                                  type="button"
                                  onClick={handleLoadMoreKeywordMemes}
                                  disabled={keywordSearchLoadingMore}
                                  className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface)] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {keywordSearchLoadingMore ? (
                                    <Loader2 size={12} className="animate-spin text-[color:var(--app-accent-2)]" />
                                  ) : null}
                                  {keywordSearchLoadingMore ? "Loading..." : "Load more"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        {!keywordSearchLoading && keywordSearchActiveQuery && keywordSearchResults.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-bg)]/80 p-4 text-sm text-[color:var(--app-muted)]">
                            <div className="flex items-center gap-3">
                              <ImageIcon size={16} className="text-[color:var(--app-muted)]" />
                              {keywordSearchReason || "No memes found. Try another keyword."}
                            </div>
                          </div>
                        ) : null}

                        {!keywordSearchLoading && !keywordSearchActiveQuery ? (
                          <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-bg)]/80 p-4 text-sm text-[color:var(--app-muted)]">
                            Enter a keyword and tap Search to pull memes from Reddit.
                          </div>
                        ) : null}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

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

                      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        <span>{currentRizz?.source === GENERATED_SOURCE ? "API line" : "Fallback line"}</span>
                        <span>{copyStatus || actionMessage || "Fresh"}</span>
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



