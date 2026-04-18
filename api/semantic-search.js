/* global process */

import { createClient } from "@supabase/supabase-js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const EMBEDDING_CACHE_TTL_MS = 1000 * 60 * 30;
const embeddingCache = new Map();

const sendJson = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

const buildSearchText = (meme) => {
  const keywordsText = Array.isArray(meme.keywords)
    ? meme.keywords.join(" ")
    : String(meme.keywords || "");

  return `${meme.title || ""} ${keywordsText} ${meme.mood || ""} ${meme.category || ""} ${
    meme.description || ""
  }`
    .toLowerCase()
    .trim();
};

const keywordFallback = async (supabase, query, limit, category) => {
  const normalizedQuery = query.replace(/[,%]/g, " ").trim();
  const ilikeQuery = `%${normalizedQuery}%`;

  let req = supabase
    .from("meme-table")
    .select("*, profiles(username)")
    .order("created_at", { ascending: false })
    .limit(Math.max(limit * 5, 50));

  if (category && category !== "All") req = req.eq("category", category);
  if (normalizedQuery) {
    req = req.or(
      `title.ilike.${ilikeQuery},mood.ilike.${ilikeQuery},category.ilike.${ilikeQuery},description.ilike.${ilikeQuery}`
    );
  }

  const { data, error } = await req;
  if (error) throw error;

  const words = query
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

  const matches = (data || []).filter((meme) => {
    const searchText = buildSearchText(meme);
    return words.every((word) => searchText.includes(word));
  });

  return matches.slice(0, limit);
};

const getCachedEmbedding = (query) => {
  const item = embeddingCache.get(query);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    embeddingCache.delete(query);
    return null;
  }
  return item.embedding;
};

const setCachedEmbedding = (query, embedding) => {
  embeddingCache.set(query, {
    embedding,
    expiresAt: Date.now() + EMBEDDING_CACHE_TTL_MS,
  });
};

const createEmbedding = async (input) => {
  const cached = getCachedEmbedding(input);
  if (cached) return cached;

  if (!OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBEDDING_MODEL,
      input,
    }),
  });

  const payload = await res.json();

  if (!res.ok || !payload?.data?.[0]?.embedding) {
    throw new Error(payload?.error?.message || "Embedding generation failed");
  }

  const embedding = payload.data[0].embedding;
  setCachedEmbedding(input, embedding);
  return embedding;
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return sendJson(res, 405, { error: "Method Not Allowed" });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return sendJson(res, 500, { error: "Supabase environment variables are missing." });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : typeof req.body === "object" && req.body
        ? req.body
        : {};
    const query = String(body?.query || "").trim();
    const limit = Math.min(Math.max(Number(body?.limit) || 10, 1), 30);
    const category = body?.category && body?.category !== "All" ? String(body.category) : null;

    if (!query) return sendJson(res, 200, { source: "empty", results: [] });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    try {
      const queryEmbedding = await createEmbedding(query);
      const vectorLiteral = `[${queryEmbedding.join(",")}]`;

      const { data, error } = await supabase.rpc("match_memes", {
        query_embedding: vectorLiteral,
        match_count: limit,
        match_threshold: 0.2,
        filter_category: category,
      });

      if (error) throw error;

      return sendJson(res, 200, { source: "semantic", results: data || [] });
    } catch (semanticError) {
      const fallbackResults = await keywordFallback(supabase, query, limit, category);
      return sendJson(res, 200, {
        source: "fallback",
        reason: semanticError.message,
        results: fallbackResults,
      });
    }
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Search failed" });
  }
}
