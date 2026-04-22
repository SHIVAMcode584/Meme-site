import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import {
  Check,
  CheckSquare,
  Loader2,
  RefreshCw,
  ChevronDown,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";

function getMemeKey(meme) {
  return String(meme?.imageUrl || meme?.image_url || meme?.title || "");
}

function isBrokenRefreshTokenError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found") ||
    message.includes("refresh token")
  );
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    if (isBrokenRefreshTokenError(error)) {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // Ignore cleanup errors and surface the session problem to the user.
      }

      throw new Error("Your session expired. Please sign in again.");
    }

    throw error;
  }

  const token = data?.session?.access_token || "";
  if (!token) {
    throw new Error("Please sign in again to publish memes.");
  }

  return token;
}

async function readJsonResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();

  if (contentType.includes("application/json")) {
    try {
      return { payload: JSON.parse(rawText), rawText };
    } catch (error) {
      return { payload: null, rawText, parseError: error };
    }
  }

  try {
    return { payload: JSON.parse(rawText), rawText };
  } catch (error) {
    return { payload: null, rawText, parseError: error };
  }
}

export default function AdminMemePublisher({ user, onPublishedMemes, pushToast }) {
  const [candidates, setCandidates] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const [fetchCount, setFetchCount] = useState(5);
  const [previewKey, setPreviewKey] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCountMenuOpen, setIsCountMenuOpen] = useState(false);
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);
  const [sourceKey, setSourceKey] = useState("all");
  const fetchPickerRef = useRef(null);
  const sourcePickerRef = useRef(null);

  const selectedCount = selectedKeys.size;

  const selectedCandidates = useMemo(() => {
    return candidates.filter((meme) => selectedKeys.has(getMemeKey(meme)));
  }, [candidates, selectedKeys]);

  const activePreviewCandidate = useMemo(() => {
    return (
      candidates.find((meme) => getMemeKey(meme) === previewKey) ||
      selectedCandidates[0] ||
      candidates[0] ||
      null
    );
  }, [candidates, previewKey, selectedCandidates]);

  const toggleCandidate = (meme) => {
    const key = getMemeKey(meme);

    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

    setPreviewKey(key);
  };

  const openPreview = (meme) => {
    if (!meme) return;
    setPreviewKey(getMemeKey(meme));
    setIsPreviewOpen(true);
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
  };

  useEffect(() => {
    if (!isCountMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!fetchPickerRef.current?.contains(event.target)) {
        setIsCountMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsCountMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCountMenuOpen]);

  useEffect(() => {
    if (!isSourceMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!sourcePickerRef.current?.contains(event.target)) {
        setIsSourceMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsSourceMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSourceMenuOpen]);

  const fetchCandidates = async () => {
    if (!user) {
      pushToast?.({
        type: "error",
        title: "Sign in required",
        message: "Please sign in before fetching memes.",
      });
      return;
    }

    setIsCountMenuOpen(false);
    setIsSourceMenuOpen(false);
    setLoadingCandidates(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(
        `/api/admin/meme-publisher?limit=${fetchCount}&source=${encodeURIComponent(sourceKey)}`,
        {
          headers: {
            authorization: `Bearer ${token}`,
          },
        }
      );

      const { payload, rawText } = await readJsonResponse(response);
      if (!payload && rawText) {
        throw new Error(
          `Server returned non-JSON response: ${rawText.slice(0, 120).replace(/\s+/g, " ").trim()}`
        );
      }
      if (!response.ok) {
        throw new Error(payload?.error || "Could not load meme suggestions.");
      }

      const nextCandidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
      setCandidates(nextCandidates);
      setSelectedKeys(new Set());
      setPreviewKey(nextCandidates[0] ? getMemeKey(nextCandidates[0]) : "");
      setLastFetchedAt(new Date().toISOString());

      pushToast?.({
        type: "success",
        title: "Memes loaded",
        message: `Fetched ${nextCandidates.length} meme suggestion${nextCandidates.length === 1 ? "" : "s"} for review.`,
      });
    } catch (error) {
      pushToast?.({
        type: "error",
        title: "Load failed",
        message: error.message || "Could not fetch meme suggestions.",
      });
    } finally {
      setLoadingCandidates(false);
    }
  };

  const publishSelected = async () => {
    if (selectedCandidates.length === 0) {
      pushToast?.({
        type: "error",
        title: "Nothing selected",
        message: "Choose at least one meme to publish.",
      });
      return;
    }

    setPublishing(true);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/admin/meme-publisher", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          memes: selectedCandidates,
        }),
      });

      const { payload, rawText } = await readJsonResponse(response);
      if (!payload && rawText) {
        throw new Error(
          `Server returned non-JSON response: ${rawText.slice(0, 120).replace(/\s+/g, " ").trim()}`
        );
      }
      if (!response.ok) {
        throw new Error(payload?.error || "Could not publish the selected memes.");
      }

      const insertedRows = Array.isArray(payload?.insertedRows) ? payload.insertedRows : [];
      const insertedCount = Number(payload?.inserted) || insertedRows.length;
      const skippedCount = Array.isArray(payload?.skipped) ? payload.skipped.length : 0;
      const errorCount = Array.isArray(payload?.errors) ? payload.errors.length : 0;

      if (insertedCount === 0) {
        const errorDetails =
          errorCount > 0
            ? payload.errors.map((item) => item?.error || item?.reason).filter(Boolean).join(" | ")
            : "";
        throw new Error(errorDetails || "The server did not publish any memes.");
      }

      if (insertedRows.length > 0) {
        onPublishedMemes?.(insertedRows);
      }

      setCandidates((current) =>
        current.filter((meme) => !selectedKeys.has(getMemeKey(meme)) || !insertedRows.length)
      );
      setSelectedKeys(new Set());

      pushToast?.({
        type: "success",
        title: "Meme published",
        message:
          skippedCount > 0
            ? `${insertedCount} meme${insertedCount === 1 ? "" : "s"} published, ${skippedCount} skipped.`
            : `${insertedCount} meme${insertedCount === 1 ? "" : "s"} published successfully.`,
      });
    } catch (error) {
      pushToast?.({
        type: "error",
        title: "Publish failed",
        message: error.message || "Could not publish the selected memes.",
      });
    } finally {
      setPublishing(false);
    }
  };

  const selectAll = () => {
    setSelectedKeys(new Set(candidates.map((meme) => getMemeKey(meme))));
  };

  const clearSelection = () => {
    setSelectedKeys(new Set());
  };

  const fetchCountOptions = [1, 2, 3, 4, 5];
  const sourceOptions = [
    { key: "all", label: "All Memes", hint: "Mixed feed" },
    { key: "gimme", label: "Random Memes", hint: "meme-api.com/gimme" },
    { key: "wholesomememes", label: "Wholesome Memes", hint: "wholesomememes" },
    { key: "dankmemes", label: "Dank Memes", hint: "dankmemes" },
    { key: "indianDankMemes", label: "Indian Dank Memes", hint: "IndianDankMemes" },
    { key: "desimemes", label: "Desi Memes", hint: "desimemes" },
    { key: "bollywoodmemes", label: "Bollywood Memes", hint: "bollywoodmemes" },
  ];
  const activeSourceOption = sourceOptions.find((option) => option.key === sourceKey) || sourceOptions[0];
  const activePreviewTitle = activePreviewCandidate?.title || "No meme selected";
  const activePreviewUrl = activePreviewCandidate?.imageUrl || activePreviewCandidate?.image_url || "";
  const activePreviewSelected = Boolean(activePreviewCandidate && selectedKeys.has(getMemeKey(activePreviewCandidate)));

  return (
    <div className="rounded-[2rem] border border-white/10 bg-[#0d1220] p-4 shadow-2xl shadow-black/20 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Meme API publisher
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-white">
            Fetch, choose, publish
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Pull a random batch from the external API, preview the meme before publishing, then publish one or more into the site feed.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div ref={sourcePickerRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setIsCountMenuOpen(false);
                setIsSourceMenuOpen((current) => !current);
              }}
              disabled={loadingCandidates || publishing}
              className="admin-fetch-picker inline-flex min-w-[190px] items-center justify-between gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-4 py-3 text-sm font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
              aria-expanded={isSourceMenuOpen}
              aria-haspopup="listbox"
            >
              <span className="flex min-w-0 flex-col items-start text-left">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-muted)]">
                  Source
                </span>
                <span className="truncate text-sm">{activeSourceOption.label}</span>
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 text-[color:var(--app-muted)] transition-transform ${isSourceMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {isSourceMenuOpen ? (
                <Motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-56 overflow-hidden rounded-[1.25rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-2 shadow-[0_20px_50px_var(--app-glow)]"
                  role="listbox"
                  aria-label="Meme source"
                >
                  <div className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--app-muted)]">
                    Meme API source
                  </div>
                  <div className="grid gap-1">
                    {sourceOptions.map((option) => {
                      const isActive = option.key === sourceKey;

                      return (
                        <button
                          key={option.key}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onClick={() => {
                            setSourceKey(option.key);
                            setIsSourceMenuOpen(false);
                          }}
                          className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                            isActive
                              ? "border-[color:var(--app-accent)] bg-[color:var(--app-surface-2)] text-[color:var(--app-text)]"
                              : "border-[color:var(--app-border)] bg-[color:var(--app-bg)] text-[color:var(--app-text)] hover:border-[color:var(--app-accent)]/40 hover:bg-[color:var(--app-surface-2)]"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{option.label}</span>
                            <span className="mt-0.5 block text-[11px] text-[color:var(--app-muted)]">
                              {option.hint}
                            </span>
                          </span>
                          {isActive ? <Check size={14} className="text-emerald-400" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </Motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <div ref={fetchPickerRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setIsSourceMenuOpen(false);
                setIsCountMenuOpen((current) => !current);
              }}
              disabled={loadingCandidates || publishing}
              className="admin-fetch-picker inline-flex min-w-[150px] items-center justify-between gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-4 py-3 text-sm font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
              aria-expanded={isCountMenuOpen}
              aria-haspopup="listbox"
            >
              <span className="flex items-center gap-2">
                <span className="text-[color:var(--app-muted)]">Fetch</span>
                <span>{fetchCount}</span>
              </span>
              <ChevronDown
                size={16}
                className={`shrink-0 text-[color:var(--app-muted)] transition-transform ${isCountMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            <AnimatePresence>
              {isCountMenuOpen ? (
                <Motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-44 overflow-hidden rounded-[1.25rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-2 shadow-[0_20px_50px_var(--app-glow)]"
                  role="listbox"
                  aria-label="Fetch amount"
                >
                  <div className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--app-muted)]">
                    Memes to fetch
                  </div>
                  <div className="grid gap-1">
                    {fetchCountOptions.map((value) => {
                      const isActive = value === fetchCount;

                      return (
                        <button
                          key={value}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onClick={() => {
                            setFetchCount(value);
                            setIsCountMenuOpen(false);
                          }}
                          className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
                            isActive
                              ? "border-[color:var(--app-accent)] bg-[color:var(--app-surface-2)] text-[color:var(--app-text)]"
                              : "border-[color:var(--app-border)] bg-[color:var(--app-bg)] text-[color:var(--app-text)] hover:border-[color:var(--app-accent)]/40 hover:bg-[color:var(--app-surface-2)]"
                          }`}
                        >
                          <span>{value}</span>
                          {isActive ? <Check size={14} className="text-emerald-400" /> : null}
                        </button>
                      );
                    })}
                  </div>
                </Motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={fetchCandidates}
            disabled={loadingCandidates || publishing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingCandidates ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {loadingCandidates ? "Loading" : `Fetch ${fetchCount} meme${fetchCount === 1 ? "" : "s"}`}
          </button>
          <button
            type="button"
            onClick={selectAll}
            disabled={candidates.length === 0 || publishing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckSquare size={16} />
            Select all
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={selectedCount === 0 || publishing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={16} />
            Clear
          </button>
          <button
            type="button"
            onClick={publishSelected}
            disabled={selectedCount === 0 || publishing}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {publishing ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            {publishing
              ? "Publishing"
              : selectedCount === 1
              ? "Publish 1 meme"
              : `Publish ${selectedCount} memes`}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-semibold uppercase tracking-[0.18em] text-zinc-300">
          {candidates.length} candidate{candidates.length === 1 ? "" : "s"}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-semibold uppercase tracking-[0.18em] text-zinc-300">
          {selectedCount} selected
        </span>
        {lastFetchedAt ? <span className="text-zinc-500">Last loaded {new Date(lastFetchedAt).toLocaleString()}</span> : null}
      </div>

      {candidates.length === 0 ? (
        <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] p-8 text-sm text-zinc-400">
          Click <span className="font-semibold text-zinc-200">Fetch {fetchCount} memes</span> to load a fresh set of random memes.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {candidates.map((meme) => {
              const key = getMemeKey(meme);
              const selected = selectedKeys.has(key);

              return (
                <div
                  key={key}
                  className={`group overflow-hidden rounded-[1.75rem] border text-left transition hover:-translate-y-0.5 ${
                    selected
                      ? "border-cyan-400/30 bg-cyan-500/[0.07] shadow-lg shadow-cyan-500/10"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleCandidate(meme)}
                    className="block w-full text-left"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img
                        src={meme.imageUrl}
                        alt={meme.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute left-3 top-3 rounded-full border border-cyan-400/20 bg-cyan-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100 backdrop-blur-md">
                        Candidate
                      </div>
                      <div
                        className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition ${
                          selected
                            ? "border-cyan-300/30 bg-cyan-500 text-white"
                            : "border-white/15 bg-black/35 text-white"
                        }`}
                      >
                        <Check size={16} />
                      </div>
                    </div>

                    <div className="p-4">
                      <h3 className="line-clamp-2 text-base font-bold text-white">{meme.title}</h3>
                      <p className="mt-1 break-all text-xs text-zinc-500">{meme.imageUrl}</p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-300">
                          <Sparkles size={12} />
                          API source
                        </span>
                        <span className="text-xs font-semibold text-zinc-400">
                          {selected ? "Selected" : "Click to select"}
                        </span>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openPreview(meme)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300 transition hover:bg-white/10"
                    >
                      Preview
                    </button>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      {selected ? "Ready" : "Unselected"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-400">
            Tap <span className="font-semibold text-zinc-200">Preview</span> on any meme to open the full phone-style popup.
          </div>
        </div>
      )}

      <AnimatePresence>
        {isPreviewOpen && activePreviewCandidate ? (
          <div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/80 px-0 backdrop-blur-md sm:items-center sm:px-4 lg:pl-72 lg:pr-8">
            <Motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePreview}
              className="absolute inset-0"
              aria-label="Close preview"
            />

            <Motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="relative z-10 flex h-[92dvh] w-full max-w-[560px] flex-col overflow-hidden border border-white/10 bg-[#0d1220] shadow-2xl shadow-black/50 sm:rounded-[2rem]"
            >
              <div className="absolute inset-x-0 top-0 z-10 flex justify-center pt-3 sm:hidden">
                <div className="h-1.5 w-14 rounded-full bg-white/15" />
              </div>

              <button
                type="button"
                onClick={closePreview}
                className="absolute right-3 top-3 z-20 rounded-full border border-white/15 bg-black/40 p-2 text-white transition hover:bg-black/60"
                aria-label="Close preview"
              >
                <X size={20} />
              </button>

              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 pr-14 sm:px-6">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
                    Meme preview
                  </p>
                  <h3 className="mt-1 truncate text-lg font-black tracking-tight text-white sm:text-xl">
                    {activePreviewTitle}
                  </h3>
                </div>
                <div className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-violet-200">
                  {selectedCount} selected
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="relative flex min-h-[38vh] select-none items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#312e81_0%,#0b1020_55%,#05070d_100%)] px-4 pb-4 pt-10 sm:min-h-[42vh] sm:px-6 sm:pb-6 sm:pt-12">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(236,72,153,0.18),transparent_45%)]" />
                  <div className="relative flex max-h-full w-full items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/35 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-3">
                    <img
                      src={activePreviewUrl}
                      alt={activePreviewTitle}
                      draggable="false"
                      className="max-h-[32vh] w-auto max-w-full rounded-[1.25rem] object-contain sm:max-h-[40vh]"
                    />
                  </div>
                  <div className="absolute left-4 top-4 rounded-full border border-cyan-400/20 bg-cyan-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100 backdrop-blur-md">
                    {activePreviewSelected ? "Selected for publish" : "Preview only"}
                  </div>
                </div>

                <div className="space-y-4 px-4 pb-5 pt-4 sm:px-6 sm:pb-6">
                  <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-4 shadow-lg shadow-black/20 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-200/90">
                      <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1">
                        {activePreviewCandidate.category || "Meme"}
                      </span>
                      <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-fuchsia-200">
                        {activePreviewCandidate.mood || "Reaction"}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-zinc-200">
                        {activePreviewCandidate.originalSource || activePreviewCandidate.original_source || "meme-api"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">
                        <Sparkles size={12} />
                        Preview tab
                      </span>
                    </div>

                    <div className="mt-4 space-y-2">
                      <h4 className="text-2xl font-black tracking-tight text-white">{activePreviewTitle}</h4>
                      <p className="break-all text-xs leading-5 text-zinc-500">{activePreviewUrl}</p>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Selected</p>
                        <p className="mt-1 text-lg font-bold text-white">{selectedCount}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Batch size</p>
                        <p className="mt-1 text-lg font-bold text-white">{candidates.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => toggleCandidate(activePreviewCandidate)}
                      disabled={publishing}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckSquare size={16} />
                      {activePreviewSelected ? "Unselect" : "Select"}
                    </button>

                    <button
                      type="button"
                      onClick={publishSelected}
                      disabled={selectedCount === 0 || publishing}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {publishing ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                      {publishing
                        ? "Publishing"
                        : selectedCount === 1
                        ? "Publish 1 meme"
                        : `Publish ${selectedCount} memes`}
                    </button>
                  </div>
                </div>
              </div>
            </Motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
