import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ExternalLink,
  Flame,
  History,
  Image as ImageIcon,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";

const TRENDING_KEYWORDS = ["exam", "love", "coding", "gym", "relationship", "sad"];
const RECENT_KEYWORDS_STORAGE = "keyword-meme-search-recent-v1";
const SEARCH_LIMIT = 20;
const DEBOUNCE_MS = 420;
const MAX_RECENT = 6;

function normalizeQuery(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeKey(value) {
  return normalizeQuery(value).toLowerCase();
}

function dedupeByImage(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = normalizeKey(item?.imageUrl || item?.id || item?.postUrl || item?.title || "");
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function ResultCard({ item }) {
  const link = item.postUrl || item.imageUrl;

  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      className="group overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.03] text-left transition hover:-translate-y-0.5 hover:border-fuchsia-400/30 hover:bg-white/[0.05]"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={item.imageUrl}
          alt={item.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-md">
          {item.source === "reddit" ? item.subreddit || "r/memes" : "Fallback"}
        </div>
        <div className="absolute right-3 top-3 rounded-full border border-fuchsia-400/20 bg-fuchsia-500/15 p-2 text-fuchsia-100 backdrop-blur-md">
          <ExternalLink size={14} />
        </div>
      </div>

      <div className="p-4">
        <h3 className="line-clamp-2 text-sm font-bold leading-6 text-white sm:text-base">
          {item.title}
        </h3>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {item.source === "reddit" ? "Reddit meme" : "Local fallback"}
        </p>
      </div>
    </a>
  );
}

export default function KeywordMemeSearch() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [results, setResults] = useState([]);
  const [source, setSource] = useState("idle");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextAfter, setNextAfter] = useState(null);
  const [nextPage, setNextPage] = useState(1);
  const [recentKeywords, setRecentKeywords] = useState([]);
  const [manualMessage, setManualMessage] = useState("");
  const sentinelRef = useRef(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef(null);
  const cacheRef = useRef(new Map());

  const sourceLabel = useMemo(() => {
    if (source === "reddit") return "Reddit";
    if (source === "fallback") return "Local fallback";
    if (source === "empty") return "No query";
    return "Ready";
  }, [source]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_KEYWORDS_STORAGE);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setRecentKeywords(
          parsed
            .map((item) => normalizeQuery(item))
            .filter(Boolean)
            .slice(0, MAX_RECENT)
        );
      }
    } catch {
      setRecentKeywords([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(RECENT_KEYWORDS_STORAGE, JSON.stringify(recentKeywords));
    } catch {
      // Ignore localStorage write failures.
    }
  }, [recentKeywords]);

  useEffect(() => {
    if (query.trim().length === 0) {
      setActiveQuery("");
      setResults([]);
      setHasMore(false);
      setNextAfter(null);
      setNextPage(1);
      setSource("idle");
      setReason("");
      setManualMessage("");
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setActiveQuery(normalizeQuery(query));
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!activeQuery || activeQuery.length < 2) return undefined;

    const nextKey = normalizeKey(activeQuery);
    const cacheEntry = cacheRef.current.get(`${nextKey}|1|`);

    if (cacheEntry) {
      setResults(cacheEntry.results);
      setSource(cacheEntry.source);
      setReason(cacheEntry.reason || "");
      setHasMore(cacheEntry.hasMore);
      setNextAfter(cacheEntry.nextAfter || null);
      setNextPage(cacheEntry.nextPage || 1);
      setManualMessage(cacheEntry.reason || "");
      return undefined;
    }

    let ignore = false;
    const loadInitialResults = async () => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setLoadingMore(false);
      setReason("");
      setManualMessage("");

      try {
        const response = await fetch(
          `/api/keyword-meme-search?q=${encodeURIComponent(activeQuery)}&limit=${SEARCH_LIMIT}&page=1`,
          {
            signal: controller.signal,
          }
        );

        const payload = await response.json();

        if (ignore || requestId !== requestIdRef.current) return;

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || "Keyword meme search failed.");
        }

        const nextResults = dedupeByImage(Array.isArray(payload?.results) ? payload.results : []);
        const nextSource = payload?.source || "reddit";
        const nextReason = payload?.reason || "";
        const nextHasMore = Boolean(payload?.hasMore);
        const nextAfterValue = payload?.after || null;

        setResults(nextResults);
        setSource(nextSource);
        setReason(nextReason);
        setHasMore(nextHasMore);
        setNextAfter(nextAfterValue);
        setNextPage(2);
        setManualMessage(nextReason || "");

        cacheRef.current.set(`${nextKey}|1|`, {
          results: nextResults,
          source: nextSource,
          reason: nextReason,
          hasMore: nextHasMore,
          nextAfter: nextAfterValue,
          nextPage: 2,
        });

        setRecentKeywords((current) => {
          const merged = [activeQuery, ...current.filter((item) => normalizeKey(item) !== nextKey)];
          return merged.slice(0, MAX_RECENT);
        });
      } catch (error) {
        if (ignore || requestId !== requestIdRef.current) return;
        setResults([]);
        setSource("idle");
        setReason(error.message || "Keyword meme search failed.");
        setManualMessage(error.message || "Keyword meme search failed.");
        setHasMore(false);
        setNextAfter(null);
        setNextPage(1);
      } finally {
        if (ignore || requestId !== requestIdRef.current) return;
        setLoading(false);
      }
    };

    void loadInitialResults();

    return () => {
      ignore = true;
      controllerCleanup(abortRef);
    };
  }, [activeQuery]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading || loadingMore || !activeQuery) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) return;
        if (loading || loadingMore || !hasMore) return;

        void loadMoreResults();
      },
      { rootMargin: "280px" }
    );

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [activeQuery, hasMore, loading, loadingMore, nextAfter, nextPage, source]);

  async function loadMoreResults() {
    if (!activeQuery || loading || loadingMore || !hasMore) return;

    const key = normalizeKey(activeQuery);
    const cacheKey = `${key}|${nextPage}|${nextAfter || ""}`;
    const cached = cacheRef.current.get(cacheKey);

    if (cached) {
      setResults((current) => dedupeByImage([...current, ...cached.results]));
      setSource(cached.source);
      setReason(cached.reason || "");
      setHasMore(cached.hasMore);
      setNextAfter(cached.nextAfter || null);
      setNextPage(cached.nextPage || nextPage + 1);
      setManualMessage(cached.reason || "");
      return;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoadingMore(true);

    try {
      const url = new URL("/api/keyword-meme-search", window.location.origin);
      url.searchParams.set("q", activeQuery);
      url.searchParams.set("limit", String(SEARCH_LIMIT));
      url.searchParams.set("page", String(nextPage));
      if (source === "reddit" && nextAfter) {
        url.searchParams.set("after", nextAfter);
      }

      const response = await fetch(url, { signal: controller.signal });
      const payload = await response.json();

      if (requestId !== requestIdRef.current) return;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || "Could not load more meme results.");
      }

      const additionalResults = dedupeByImage(Array.isArray(payload?.results) ? payload.results : []);
      const nextSource = payload?.source || source;
      const nextReason = payload?.reason || "";
      const nextHasMore = Boolean(payload?.hasMore);
      const nextAfterValue = payload?.after || null;
      const nextPageValue = nextPage + 1;

      setResults((current) => dedupeByImage([...current, ...additionalResults]));
      setSource(nextSource);
      setReason(nextReason);
      setHasMore(nextHasMore);
      setNextAfter(nextAfterValue);
      setNextPage(nextPageValue);
      setManualMessage(nextReason || "");

      cacheRef.current.set(cacheKey, {
        results: additionalResults,
        source: nextSource,
        reason: nextReason,
        hasMore: nextHasMore,
        nextAfter: nextAfterValue,
        nextPage: nextPageValue,
      });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setReason(error.message || "Could not load more meme results.");
      setManualMessage(error.message || "Could not load more meme results.");
      setHasMore(false);
    } finally {
      if (requestId !== requestIdRef.current) return;
      setLoadingMore(false);
    }
  }

  function controllerCleanup(ref) {
    if (ref.current) {
      ref.current.abort();
      ref.current = null;
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const normalized = normalizeQuery(query);
    if (!normalized) return;
    setActiveQuery(normalized);
  }

  function handleRecentClick(item) {
    const normalized = normalizeQuery(item);
    setQuery(normalized);
    setActiveQuery(normalized);
  }

  function resetSearch() {
    setQuery("");
    setActiveQuery("");
    setResults([]);
    setSource("idle");
    setReason("");
    setHasMore(false);
    setNextAfter(null);
    setNextPage(1);
    setManualMessage("");
  }

  const showEmptyState = !loading && activeQuery && results.length === 0;

  return (
    <section className="mt-8 rounded-[2rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4 shadow-2xl shadow-black/15 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
            <Sparkles size={12} />
            Keyword Meme Search
          </div>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Search memes by keyword
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Try words like exam, love, coding, gym, or sad. Reddit results appear first, with a local meme fallback if the API is slow.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
            {sourceLabel}
          </span>
          {reason ? (
            <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-amber-200">
              {reason}
            </span>
          ) : null}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="group relative rounded-[1.5rem] border border-[color:var(--app-border)] bg-[color:var(--app-bg)] shadow-[0_18px_50px_var(--app-glow)] transition focus-within:border-[color:var(--app-accent)]/45 focus-within:shadow-[0_22px_70px_var(--app-glow)]">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--app-muted)] transition-colors group-focus-within:text-[color:var(--app-accent)]" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search memes (e.g., exam, love, coding...)"
            aria-label="Keyword meme search"
            className="h-14 w-full rounded-[1.5rem] bg-transparent pl-12 pr-4 text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-muted)] sm:h-16"
          />
          {query ? (
            <button
              type="button"
              onClick={resetSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/[0.04] p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Clear keyword search"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-[1.5rem] border border-cyan-400/20 bg-cyan-500/10 px-5 text-sm font-bold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60 sm:h-16"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Search
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {TRENDING_KEYWORDS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => handleRecentClick(item)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-fuchsia-400/30 hover:bg-white/[0.08] hover:text-white"
          >
            <Flame size={12} className="text-fuchsia-300" />
            {item}
          </button>
        ))}
        {recentKeywords.slice(0, MAX_RECENT).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => handleRecentClick(item)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-cyan-400/30 hover:bg-white/[0.08] hover:text-white"
          >
            <History size={12} className="text-cyan-300" />
            {item}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6 text-sm text-zinc-400"
          >
            <div className="flex items-center gap-3">
              <Loader2 size={18} className="animate-spin text-fuchsia-300" />
              Searching the meme multiverse...
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!loading && showEmptyState ? (
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
          <ImageIcon className="mx-auto h-12 w-12 text-zinc-500" />
          <h3 className="mt-4 text-xl font-bold text-white">No memes found 😢</h3>
          <p className="mt-2 text-sm text-zinc-400">Try another keyword or tap one of the suggestions above.</p>
        </div>
      ) : null}

      {!loading && results.length > 0 ? (
        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-sm text-zinc-400">
              Showing <span className="font-semibold text-zinc-200">{results.length}</span> result
              {results.length === 1 ? "" : "s"}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {source === "reddit" ? "Reddit first" : "Fallback results"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 sm:gap-4">
            {results.map((item, index) => (
              <motion.div
                key={`${item.id}-${index}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: (index % 6) * 0.03 }}
              >
                <ResultCard item={item} />
              </motion.div>
            ))}
          </div>

          <div ref={sentinelRef} className="h-8 w-full" />

          <div className="mt-4 flex items-center justify-center">
            {loadingMore ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-300">
                <Loader2 size={14} className="animate-spin text-fuchsia-300" />
                Loading more memes...
              </div>
            ) : hasMore ? (
              <button
                type="button"
                onClick={loadMoreResults}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
              >
                <ChevronDown size={14} />
                Load more
              </button>
            ) : (
              <p className="text-sm text-zinc-500">You reached the end of the results.</p>
            )}
          </div>
        </div>
      ) : null}

      {!loading && !results.length && activeQuery && manualMessage && !showEmptyState ? (
        <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 text-sm text-zinc-400">
          {manualMessage}
        </div>
      ) : null}
    </section>
  );
}
