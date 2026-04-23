/* global process */

import { createClient } from "@supabase/supabase-js";
import { memes as localFallbackMemes } from "../src/data/memes.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 20;
const SUPABASE_ROW_LIMIT = 250;

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function clampLimit(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

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

function createSearchClient() {
  const { supabaseUrl, supabaseKey } = resolveSupabaseConfig();
  if (!supabaseUrl || !supabaseKey) return null;

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
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

function normalizeMemeRow(row, source) {
  const imageUrl = String(row?.image_url || row?.imageUrl || row?.image || "").trim();
  const title = decodeHtmlEntities(String(row?.title || row?.name || "Meme").trim());
  const keywords = normalizeKeywords(row?.keywords);

  return {
    id: String(row?.id || row?.slug || `${source}-${title}`),
    title,
    imageUrl,
    subreddit: row?.profiles?.username ? `@${row.profiles.username}` : "r/memes",
    permalink: row?.slug ? `/meme/${encodeURIComponent(String(row.slug))}` : "",
    postUrl: row?.slug ? `/meme/${encodeURIComponent(String(row.slug))}` : "",
    category: row?.category || "",
    mood: row?.mood || "",
    keywords,
    source,
    created_at: row?.created_at || "",
  };
}

function normalizeLocalMeme(row) {
  return {
    id: String(row?.id || row?.title || "local-meme"),
    title: String(row?.title || "Local meme"),
    imageUrl: String(row?.image || row?.imageUrl || row?.url || "").trim(),
    subreddit: "r/memes",
    permalink: "",
    postUrl: "",
    category: row?.category || "",
    mood: row?.mood || "",
    keywords: normalizeKeywords(row?.keywords),
    source: "local",
    created_at: "",
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

      return { item, score };
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

async function loadSupabaseMemes(client) {
  if (!client) return [];

  const primary = await client
    .from("meme-table")
    .select("id, title, image_url, category, mood, keywords, slug, created_at, profiles(username)")
    .order("created_at", { ascending: false })
    .limit(SUPABASE_ROW_LIMIT);

  if (!primary.error) {
    return Array.isArray(primary.data) ? primary.data : [];
  }

  const fallback = await client
    .from("meme-table")
    .select("id, title, image_url, category, mood, keywords, slug, created_at")
    .order("created_at", { ascending: false })
    .limit(SUPABASE_ROW_LIMIT);

  if (!fallback.error) {
    return Array.isArray(fallback.data) ? fallback.data : [];
  }

  return [];
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

function buildLocalResults(query, limit) {
  const normalized = localFallbackMemes.map(normalizeLocalMeme);
  return scoreMatches(normalized, query).slice(0, limit);
}

function buildSupabaseResults(rows, query, limit) {
  const normalized = rows.map((row) => normalizeMemeRow(row, "supabase"));
  return scoreMatches(normalized, query).slice(0, limit);
}

export default async function handler(req, res) {
  let query = "";
  let limit = DEFAULT_LIMIT;

  try {
    if (req.method !== "GET") {
      return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const url = new URL(req.url || "/api/keyword-meme-search", "http://localhost");
    query = normalizeQuery(url.searchParams.get("q") || "");
    limit = clampLimit(url.searchParams.get("limit") || DEFAULT_LIMIT);

    if (!query) {
      return sendJson(res, 200, {
        ok: true,
        source: "empty",
        results: [],
        reason: "",
        after: null,
        hasMore: false,
      });
    }

    const supabaseClient = createSearchClient();
    let combinedResults = [];
    let source = "local";
    let reason = "";

    if (supabaseClient) {
      const rows = await loadSupabaseMemes(supabaseClient);
      const supabaseResults = buildSupabaseResults(rows, query, limit);
      if (supabaseResults.length > 0) {
        combinedResults = supabaseResults;
        source = "supabase";
      }
    }

    if (combinedResults.length === 0) {
      combinedResults = buildLocalResults(query, limit);
      if (combinedResults.length > 0) {
        source = "local";
        reason = "Showing local meme matches.";
      } else {
        source = "empty";
        reason = "No meme matches found.";
      }
    }

    return sendJson(res, 200, {
      ok: true,
      query,
      source,
      reason,
      results: dedupeResults(combinedResults).slice(0, limit),
      after: null,
      hasMore: false,
    });
  } catch (error) {
    const fallbackResults = buildLocalResults(query, limit);
    const hasFallback = fallbackResults.length > 0;

    return sendJson(res, 200, {
      ok: true,
      query,
      source: hasFallback ? "local" : "empty",
      reason: hasFallback ? "Showing local meme matches." : "Search temporarily unavailable.",
      results: fallbackResults,
      after: null,
      hasMore: false,
    });
  }
}
