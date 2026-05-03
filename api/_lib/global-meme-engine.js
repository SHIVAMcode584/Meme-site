/* global process */

import { createClient } from "@supabase/supabase-js";
import { memes as localFallbackMemes } from "../../src/data/memes.js";

const DEFAULT_LIMIT = 16;
const MAX_LIMIT = 40;
const SUPABASE_ROW_LIMIT = 250;
const REDDIT_TIMEOUT_MS = 8000;
const REDDIT_SUBREDDITS = [
  "memes",
  "dankmemes",
  "wholesomememes",
  "funny",
  "me_irl",
  "IndianDankMemes",
  "ComedyCemetery",
];

function normalizeQuery(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeQuery(value) {
  return normalizeQuery(value)
    .toLowerCase()
    .split(/[\s-]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeKeywords(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeQuery(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .replace(/[\[\]"']/g, " ")
      .split(/[,|\n]+/)
      .map((item) => normalizeQuery(item))
      .filter(Boolean);
  }

  return [];
}

function normalizeRedditImageUrl(value) {
  const url = decodeHtmlEntities(String(value || "").trim());
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return "";
}

function normalizeRedditPost(post, subredditName = "") {
  const previewUrl = normalizeRedditImageUrl(post?.preview?.images?.[0]?.source?.url);
  const directUrl = normalizeRedditImageUrl(post?.url_overridden_by_dest || post?.url);
  const imageUrl = directUrl || previewUrl;
  if (!imageUrl) return null;

  const title = decodeHtmlEntities(String(post?.title || "Meme").trim());
  const permalink = post?.permalink ? `https://www.reddit.com${post.permalink}` : "";

  return {
    id: String(post?.id || post?.name || permalink || title),
    title,
    imageUrl,
    subreddit: post?.subreddit_name_prefixed || `r/${subredditName || post?.subreddit || "memes"}`,
    permalink,
    postUrl: permalink,
    category: post?.link_flair_text || "",
    mood: post?.link_flair_text || "",
    keywords: normalizeKeywords([
      post?.title || "",
      post?.link_flair_text || "",
      subredditName || post?.subreddit || "",
    ]),
    source: "reddit",
    created_at: post?.created_utc ? new Date(post.created_utc * 1000).toISOString() : "",
    score: Number(post?.score || 0),
    num_comments: Number(post?.num_comments || 0),
  };
}

function normalizeSupabaseRow(row) {
  const profileData = Array.isArray(row?.profiles) ? row.profiles[0] : row?.profiles;
  const imageUrl = String(row?.image_url || row?.imageUrl || row?.image || "").trim();
  if (!imageUrl) return null;

  return {
    id: String(row?.id || row?.slug || `supabase-${String(row?.title || "meme")}`),
    title: String(row?.title || row?.name || "Meme"),
    imageUrl,
    subreddit: profileData?.username ? `@${profileData.username}` : "r/memes",
    permalink: row?.slug ? `/meme/${encodeURIComponent(String(row.slug))}` : "",
    postUrl: row?.slug ? `/meme/${encodeURIComponent(String(row.slug))}` : "",
    category: row?.category || "",
    mood: row?.mood || "",
    keywords: normalizeKeywords(row?.keywords),
    source: "supabase",
    created_at: row?.created_at || "",
    score: Number(row?.score || 0),
  };
}

function normalizeLocalMeme(row) {
  const imageUrl = String(row?.image || row?.imageUrl || row?.url || "").trim();
  if (!imageUrl) return null;

  return {
    id: String(row?.id || row?.title || "local-meme"),
    title: String(row?.title || "Local meme"),
    imageUrl,
    subreddit: "r/memes",
    permalink: "",
    postUrl: "",
    category: row?.category || "",
    mood: row?.mood || "",
    keywords: normalizeKeywords(row?.keywords),
    source: "local",
    created_at: "",
    score: 0,
  };
}

function buildSearchText(item) {
  return [
    item?.title || "",
    item?.category || "",
    item?.mood || "",
    ...(Array.isArray(item?.keywords) ? item.keywords : []),
    item?.subreddit || "",
  ]
    .join(" ")
    .toLowerCase();
}

function scoreMatches(items, query) {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];

  return items
    .map((item) => {
      const text = buildSearchText(item);
      const score = tokens.reduce((total, token) => {
        if (!token) return total;
        return total + (text.includes(token) ? 1 : 0);
      }, 0);

      return { item, score: score + Number(item?.score || 0) / 1000 };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const leftTime = Date.parse(left.item?.created_at || "") || 0;
      const rightTime = Date.parse(right.item?.created_at || "") || 0;
      if (rightTime !== leftTime) return rightTime - leftTime;
      return String(left.item?.title || "").localeCompare(String(right.item?.title || ""));
    })
    .map(({ item }) => item);
}

function dedupeResults(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = String(item?.imageUrl || item?.id || item?.title || "").toLowerCase();
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clampLimit(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function clampPage(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

async function fetchJson(url, init = {}) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REDDIT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "user-agent": "RoastRiotMeme/1.0 (+https://roastriot.meme)",
        accept: "application/json,text/plain,*/*",
        ...(init.headers || {}),
      },
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(payload?.message || `Request failed with status ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return payload;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function resolveSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "";

  return {
    supabaseUrl: String(supabaseUrl || "").trim(),
    supabaseKey: String(supabaseKey || "").trim(),
  };
}

export function createSearchClient() {
  const { supabaseUrl, supabaseKey } = resolveSupabaseConfig();
  if (!supabaseUrl || !supabaseKey) return null;

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function loadSupabaseMemes(client) {
  if (!client) return [];

  const primary = await client
    .from("meme-table")
    .select("id, title, image_url, category, mood, keywords, slug, created_at, profiles(username)")
    .order("created_at", { ascending: false })
    .limit(SUPABASE_ROW_LIMIT);

  let rows = Array.isArray(primary.data) ? primary.data : [];

  if (primary.error) {
    const fallback = await client
      .from("meme-table")
      .select("id, title, image_url, category, mood, keywords, slug, created_at")
      .order("created_at", { ascending: false })
      .limit(SUPABASE_ROW_LIMIT);

    if (!fallback.error) {
      rows = Array.isArray(fallback.data) ? fallback.data : [];
    } else {
      rows = [];
    }
  }

  return rows.map(normalizeSupabaseRow).filter(Boolean);
}

async function fetchRedditSearchPool(query, perSubredditLimit = 25) {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];

  const requests = REDDIT_SUBREDDITS.map(async (subreddit) => {
    const url = new URL(`https://www.reddit.com/r/${subreddit}/search.json`);
    url.searchParams.set("q", query);
    url.searchParams.set("restrict_sr", "1");
    url.searchParams.set("sort", "relevance");
    url.searchParams.set("t", "all");
    url.searchParams.set("limit", String(perSubredditLimit));
    url.searchParams.set("include_over_18", "on");
    url.searchParams.set("raw_json", "1");

    try {
      const payload = await fetchJson(url.toString());
      const children = Array.isArray(payload?.data?.children) ? payload.data.children : [];
      return children
        .map((child) => normalizeRedditPost(child?.data, subreddit))
        .filter(Boolean);
    } catch {
      return [];
    }
  });

  const results = await Promise.all(requests);
  return dedupeResults(results.flat());
}

async function fetchRedditFeedPool(limit = 120) {
  const requests = REDDIT_SUBREDDITS.map(async (subreddit) => {
    const url = new URL(`https://www.reddit.com/r/${subreddit}/hot.json`);
    url.searchParams.set("limit", String(Math.max(25, Math.ceil(limit / REDDIT_SUBREDDITS.length))));
    url.searchParams.set("raw_json", "1");
    url.searchParams.set("include_over_18", "on");

    try {
      const payload = await fetchJson(url.toString());
      const children = Array.isArray(payload?.data?.children) ? payload.data.children : [];
      return children
        .map((child) => normalizeRedditPost(child?.data, subreddit))
        .filter(Boolean);
    } catch {
      return [];
    }
  });

  const results = await Promise.all(requests);
  return dedupeResults(results.flat()).slice(0, limit);
}

function buildLocalResults(query, limit) {
  const normalized = localFallbackMemes.map(normalizeLocalMeme).filter(Boolean);
  return scoreMatches(normalized, query).slice(0, limit);
}

function paginateResults(items, page, limit) {
  const start = (page - 1) * limit;
  const end = start + limit;
  return {
    results: items.slice(start, end),
    after: items.length > end ? String(end) : null,
    hasMore: items.length > end,
  };
}

export async function buildGlobalMemeSearchResponse({
  query,
  limit = DEFAULT_LIMIT,
  page = 1,
  after = null,
  includeLocalFallback = true,
}) {
  const normalizedQuery = normalizeQuery(query);
  const safeLimit = clampLimit(limit);
  const safePage = after && /^\d+$/.test(String(after))
    ? clampPage(Math.floor(Number(after) / safeLimit) + 1)
    : clampPage(page);

  if (!normalizedQuery) {
    return {
      ok: true,
      source: "empty",
      results: [],
      reason: "",
      after: null,
      hasMore: false,
    };
  }

  const supabaseClient = createSearchClient();
  const [redditSearchPool, redditFeedPool, supabasePool] = await Promise.all([
    fetchRedditSearchPool(normalizedQuery, Math.max(20, safeLimit)),
    fetchRedditFeedPool(Math.max(120, safeLimit * 4)),
    loadSupabaseMemes(supabaseClient),
  ]);

  const rankedResults = dedupeResults([
    ...scoreMatches(redditSearchPool, normalizedQuery),
    ...scoreMatches(supabasePool, normalizedQuery),
    ...scoreMatches(redditFeedPool, normalizedQuery),
    ...(includeLocalFallback ? scoreMatches(localFallbackMemes.map(normalizeLocalMeme).filter(Boolean), normalizedQuery) : []),
  ]);

  const paginated = paginateResults(rankedResults, safePage, safeLimit);

  if (paginated.results.length > 0) {
    const redditResults = paginated.results.some((item) => item.source === "reddit");
    const supabaseResults = paginated.results.some((item) => item.source === "supabase");
    return {
      ok: true,
      query: normalizedQuery,
      source: redditResults ? "reddit" : supabaseResults ? "supabase" : "local",
      reason:
        redditResults || supabaseResults
          ? "Showing live meme matches."
          : "Showing local meme matches.",
      results: paginated.results,
      after: paginated.after,
      hasMore: paginated.hasMore,
    };
  }

  const fallbackResults = includeLocalFallback ? buildLocalResults(normalizedQuery, safeLimit) : [];

  return {
    ok: true,
    query: normalizedQuery,
    source: fallbackResults.length > 0 ? "local" : "empty",
    reason: fallbackResults.length > 0 ? "Showing local meme matches." : "No meme matches found.",
    results: fallbackResults,
    after: null,
    hasMore: false,
  };
}

export async function buildGlobalMemeFeedResponse({ limit = DEFAULT_LIMIT, page = 1 }) {
  const safeLimit = clampLimit(limit);
  const safePage = clampPage(page);
  const supabaseClient = createSearchClient();

  const [redditFeedPool, supabasePool] = await Promise.all([
    fetchRedditFeedPool(Math.max(120, safeLimit * 4)),
    loadSupabaseMemes(supabaseClient),
  ]);

  const localPool = localFallbackMemes.map(normalizeLocalMeme).filter(Boolean);
  const combined = dedupeResults([
    ...redditFeedPool,
    ...supabasePool,
    ...localPool,
  ]);

  const paginated = paginateResults(combined, safePage, safeLimit);

  return {
    ok: true,
    source: paginated.results.some((item) => item.source === "reddit")
      ? "reddit"
      : paginated.results.some((item) => item.source === "supabase")
      ? "supabase"
      : "local",
    memes: paginated.results,
    results: paginated.results,
    after: paginated.after,
    hasMore: paginated.hasMore,
    reason:
      paginated.results.some((item) => item.source === "reddit") ||
      paginated.results.some((item) => item.source === "supabase")
        ? "Showing live meme matches."
        : "Showing local meme matches.",
  };
}

export { clampLimit, dedupeResults, normalizeQuery, scoreMatches };
