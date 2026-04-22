/* global process */

import { createClient } from "@supabase/supabase-js";
import { memes as localFallbackMemes } from "../../src/data/memes.js";

const MEME_API_SOURCES = {
  all: {
    label: "All Memes",
    urls: ["https://meme-api.com/gimme/10"],
    originalSource: "meme-api",
  },
  gimme: {
    label: "Random Memes",
    urls: ["https://meme-api.com/gimme"],
    originalSource: "meme-api",
  },
  wholesomememes: {
    label: "Wholesome Memes",
    urls: ["https://meme-api.com/gimme/wholesomememes"],
    originalSource: "wholesomememes",
  },
  dankmemes: {
    label: "Dank Memes",
    urls: ["https://meme-api.com/gimme/dankmemes"],
    originalSource: "dankmemes",
  },
  indianDankMemes: {
    label: "Indian Dank Memes",
    urls: ["https://meme-api.com/gimme/IndianDankMemes"],
    originalSource: "IndianDankMemes",
  },
  desimemes: {
    label: "Desi Memes",
    urls: ["https://meme-api.com/gimme/desimemes"],
    originalSource: "desimemes",
  },
  bollywoodmemes: {
    label: "Bollywood Memes",
    urls: ["https://meme-api.com/gimme/bollywoodmemes"],
    originalSource: "bollywoodmemes",
  },
};
const OCR_API_URL = "https://api.ocr.space/parse/image";
const DEFAULT_LIMIT = 4;
const MAX_LIMIT = 5;
const MAX_CONCURRENCY = 2;
const REQUEST_TIMEOUT_MS = 20000;
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const STOPWORDS = new Set([
  "a",
  "about",
  "after",
  "again",
  "against",
  "all",
  "am",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "below",
  "between",
  "both",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "doing",
  "down",
  "during",
  "each",
  "few",
  "for",
  "from",
  "further",
  "had",
  "has",
  "have",
  "having",
  "he",
  "her",
  "here",
  "hers",
  "herself",
  "him",
  "himself",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "itself",
  "just",
  "let",
  "me",
  "more",
  "most",
  "my",
  "myself",
  "no",
  "nor",
  "not",
  "of",
  "off",
  "on",
  "once",
  "only",
  "or",
  "other",
  "our",
  "ours",
  "ourselves",
  "out",
  "over",
  "own",
  "same",
  "she",
  "should",
  "so",
  "some",
  "such",
  "than",
  "that",
  "the",
  "their",
  "theirs",
  "them",
  "themselves",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "to",
  "too",
  "under",
  "until",
  "up",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "whom",
  "why",
  "will",
  "with",
  "you",
  "your",
  "yours",
  "yourself",
  "yourselves",
  "hai",
  "hain",
  "ho",
  "haa",
  "haan",
  "h",
  "ka",
  "ki",
  "ke",
  "se",
  "ko",
  "mein",
  "main",
  "mai",
  "mera",
  "meri",
  "mere",
  "tera",
  "teri",
  "tere",
  "ye",
  "wo",
  "vo",
  "aur",
]);

function safeJsonParse(value) {
  if (typeof value !== "string") return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function stripCodeFences(value) {
  return String(value || "")
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function generateSlug(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildMemeSlug(title) {
  const baseSlug = generateSlug(title) || "meme";
  const suffix = Math.random().toString(36).substring(2, 7);
  return `${baseSlug}-${suffix}`;
}

function isMissingSlugColumnError(error) {
  return (
    error?.code === "PGRST204" &&
    typeof error?.message === "string" &&
    error.message.toLowerCase().includes("slug")
  );
}

function normalizeSourceKey(value) {
  const raw = normalizeWhitespace(value || "").toLowerCase();
  if (!raw) return "all";

  if (raw === "gimme" || raw === "random" || raw === "random-memes") return "gimme";
  if (raw === "wholesome" || raw === "wholesomememes" || raw === "wholesome-memes") return "wholesomememes";
  if (raw === "dank" || raw === "dankmemes" || raw === "dank-memes") return "dankmemes";
  if (raw === "indian" || raw === "indian-dank-memes" || raw === "indiandankmemes") return "indianDankMemes";
  if (raw === "desi" || raw === "desi-memes" || raw === "desimemes") return "desimemes";
  if (raw === "bollywood" || raw === "bollywood-memes" || raw === "bollywoodmemes") return "bollywoodmemes";
  return "all";
}

function getMemeApiSource(sourceKey) {
  return MEME_API_SOURCES[normalizeSourceKey(sourceKey)] || MEME_API_SOURCES.all;
}

function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));
}

function isAllowedImageUrl(imageUrl) {
  if (!imageUrl) return false;

  try {
    const url = new URL(imageUrl);
    const pathname = url.pathname.toLowerCase();
    return [...ALLOWED_EXTENSIONS].some((extension) => pathname.endsWith(extension));
  } catch {
    return false;
  }
}

function asMemeList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.memes)) return payload.memes;
  if (Array.isArray(payload.posts)) return payload.posts;
  if (payload.meme) return [payload.meme];
  return [payload];
}

function extractImageUrl(item) {
  return normalizeWhitespace(item?.url || item?.image || item?.image_url || item?.imageUrl || "");
}

function extractTitle(item) {
  return normalizeWhitespace(item?.title || item?.name || "");
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function normalizeMemeBatch(payload, sourceKey = "all") {
  const source = getMemeApiSource(sourceKey);
  return asMemeList(payload)
    .map((item) => ({
      title: decodeHtmlEntities(extractTitle(item)),
      imageUrl: extractImageUrl(item),
      nsfw: Boolean(item?.nsfw),
      originalSource: source.originalSource,
    }))
    .filter((item) => item.title && item.imageUrl);
}

function buildLocalFallbackBatch(requestedLimit, sourceKey = "all") {
  const shuffled = [...localFallbackMemes].sort(() => Math.random() - 0.5);
  const localPayload = shuffled
    .slice(0, Math.max(1, requestedLimit))
    .map((item) => ({
      title: item?.title || item?.name || "",
      image: item?.image || item?.imageUrl || item?.url || "",
      nsfw: false,
    }));

  return normalizeMemeBatch(localPayload, sourceKey).map((item) => ({
    ...item,
    originalSource: "local-library",
  }));
}

function tokenizeForKeywords(value) {
  return normalizeWhitespace(String(value || "").toLowerCase())
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s-]+/g, " ")
    .split(/[\s-]+/)
    .map((word) => word.trim())
    .filter((word) => word && word.length > 1 && !STOPWORDS.has(word) && !/^\d+$/.test(word));
}

function mergeKeywords(...groups) {
  const seen = new Set();
  const merged = [];

  for (const group of groups) {
    for (const keyword of group || []) {
      const normalized = normalizeWhitespace(String(keyword || "").toLowerCase());
      if (!normalized || normalized.length < 2) continue;
      if (STOPWORDS.has(normalized)) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      merged.push(normalized);
    }
  }

  return merged;
}

function parseKeywordsFromAiResponse(rawValue) {
  const sanitized = stripCodeFences(rawValue);
  const parsed = safeJsonParse(sanitized);

  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.keywords)) return parsed.keywords;
  if (parsed && typeof parsed.keywords === "string") {
    return parsed.keywords.split(/[,|\n]+/);
  }

  const listMatch = sanitized.match(/\[[\s\S]*\]/);
  if (listMatch) {
    const parsedList = safeJsonParse(listMatch[0]);
    if (Array.isArray(parsedList)) return parsedList;
  }

  return sanitized
    .split(/[,|\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

async function fetchJson(url, options = {}, label = "request") {
  const response = await fetchWithTimeout(url, options);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMessage =
      typeof payload === "string"
        ? payload
        : payload?.error || payload?.message || `${label} failed with ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload;
}

async function fetchMemeBatch(sourceKey = "all", requestedLimit = DEFAULT_LIMIT) {
  const normalizedSourceKey = normalizeSourceKey(sourceKey);
  const source = getMemeApiSource(normalizedSourceKey);
  const label = `Meme API (${source.label})`;

  if (normalizedSourceKey === "all") {
    try {
      const payload = await fetchJson(source.urls[0], {}, label);
      const batch = normalizeMemeBatch(payload, normalizedSourceKey);
      return batch.length > 0 ? batch : buildLocalFallbackBatch(requestedLimit, normalizedSourceKey);
    } catch (error) {
      return buildLocalFallbackBatch(requestedLimit, normalizedSourceKey);
    }
  }

  const fetchCount = Math.max(1, requestedLimit);
  const fetches = Array.from({ length: fetchCount }, () =>
    fetchJson(source.urls[0], {}, label).catch((error) => ({ __error: error }))
  );
  const payloads = await Promise.all(fetches);
  const batch = payloads
    .filter((item) => !item?.__error)
    .flatMap((payload) => normalizeMemeBatch(payload, normalizedSourceKey));

  return batch.length > 0 ? batch : buildLocalFallbackBatch(requestedLimit, normalizedSourceKey);
}

async function fetchOcrText(imageUrl, ocrApiKey) {
  const params = new URLSearchParams();
  params.set("language", "eng");
  params.set("isOverlayRequired", "false");
  params.set("url", imageUrl);

  const response = await fetchWithTimeout(OCR_API_URL, {
    method: "POST",
    headers: {
      apikey: ocrApiKey || "helloworld",
    },
    body: params,
  });

  const payload = await response.json();
  const parsedText = Array.isArray(payload?.ParsedResults)
    ? payload.ParsedResults.map((item) => item?.ParsedText || "").join("\n").trim()
    : String(payload?.ParsedText || "").trim();

  if (!response.ok || payload?.IsErroredOnProcessing || !parsedText) {
    const errorMessage =
      (Array.isArray(payload?.ErrorMessage) && payload.ErrorMessage.filter(Boolean).join(" ")) ||
      payload?.ErrorMessage ||
      payload?.ErrorDetails ||
      "No OCR text detected";
    throw new Error(errorMessage);
  }

  return parsedText;
}

async function enhanceKeywordsWithOpenAi({ title, ocrText, keywords, apiKey, model }) {
  if (!apiKey) return keywords;

  const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You generate concise meme keywords. Return only JSON in the form {\"keywords\":[\"keyword1\",\"keyword2\"]}. Use lowercase keywords only.",
        },
        {
          role: "user",
          content: [
            `Title: ${title}`,
            `OCR text: ${ocrText || "(none)"}`,
            `Existing keywords: ${keywords.join(", ") || "(none)"}`,
            "Create 5-10 relevant keywords. Prefer short, searchable terms. Avoid duplicates and keep phrases concise.",
          ].join("\n"),
        },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.error || "OpenAI keyword enhancement failed");
  }

  const content = payload?.choices?.[0]?.message?.content || "";
  const aiKeywords = parseKeywordsFromAiResponse(content);
  return mergeKeywords(keywords, aiKeywords);
}

function buildStorageKeywords(title, ocrText) {
  return mergeKeywords(tokenizeForKeywords(title), tokenizeForKeywords(ocrText));
}

function clampLimit(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, parsed));
}

function buildPreparedMemes(fetchedMemes, requestedLimit) {
  const preparedMemes = [];
  const seenUrls = new Set();

  for (const meme of fetchedMemes) {
    if (preparedMemes.length >= requestedLimit) break;
    if (!meme?.title || !meme?.imageUrl) continue;
    if (meme.nsfw) continue;
    if (!isAllowedImageUrl(meme.imageUrl)) continue;

    const normalizedUrl = meme.imageUrl.trim();
    if (seenUrls.has(normalizedUrl)) continue;
    seenUrls.add(normalizedUrl);
    preparedMemes.push({
      title: meme.title,
      imageUrl: normalizedUrl,
      originalSource: normalizeWhitespace(meme.originalSource || "meme-api") || "meme-api",
    });
  }

  return preparedMemes;
}

async function loadExistingImageUrls(supabase, imageUrls) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase
    .from("meme-table")
    .select("image_url")
    .in("image_url", imageUrls);

  if (error) {
    throw error;
  }

  return new Set((data || []).map((row) => String(row.image_url || "").trim()));
}

async function loadExistingImageUrlsSafely(supabase, imageUrls) {
  try {
    return await loadExistingImageUrls(supabase, imageUrls);
  } catch {
    return new Set();
  }
}

async function processPreparedMeme({
  supabase,
  meme,
  existingUrls,
  ocrApiKey,
  openAiApiKey,
  openAiModel,
  category = "Auto",
  mood = "Reaction",
  originalSource = "meme-api",
  userId = null,
}) {
  if (existingUrls.has(meme.imageUrl)) {
    return {
      inserted: 0,
      insertedRows: [],
      skipped: [{ title: meme.title, imageUrl: meme.imageUrl, reason: "duplicate" }],
      errors: [],
    };
  }

  const result = {
    inserted: 0,
    insertedRows: [],
    skipped: [],
    errors: [],
  };

  let ocrText = "";

  try {
    ocrText = await fetchOcrText(meme.imageUrl, ocrApiKey);
  } catch (error) {
    result.errors.push({
      title: meme.title,
      imageUrl: meme.imageUrl,
      reason: "ocr-failed",
      error: error.message || "OCR failed",
    });
  }

  const baseKeywords = buildStorageKeywords(meme.title, ocrText);
  if (baseKeywords.length === 0) {
    result.skipped.push({
      title: meme.title,
      imageUrl: meme.imageUrl,
      reason: "no-keywords",
    });
    return result;
  }

  let keywords = baseKeywords;

  try {
    keywords = await enhanceKeywordsWithOpenAi({
      title: meme.title,
      ocrText,
      keywords,
      apiKey: openAiApiKey,
      model: openAiModel,
    });
  } catch (error) {
    result.errors.push({
      title: meme.title,
      imageUrl: meme.imageUrl,
      reason: "ai-enhancement-failed",
      error: error.message || "AI enhancement failed",
    });
  }

  keywords = mergeKeywords(keywords);
  if (keywords.length === 0) {
    result.skipped.push({
      title: meme.title,
      imageUrl: meme.imageUrl,
      reason: "empty-keywords",
    });
    return result;
  }

  const payload = {
    title: meme.title,
    slug: buildMemeSlug(meme.title),
    image_url: meme.imageUrl,
    category,
    mood,
    keywords: keywords.join(", "),
    is_auto: true,
    original_source: normalizeWhitespace(meme.originalSource || originalSource || "meme-api") || "meme-api",
    created_at: new Date().toISOString(),
    user_id: userId,
  };

  const runInsert = async (nextPayload) =>
    supabase
      .from("meme-table")
      .insert(nextPayload)
      .select("id, title, image_url, keywords, is_auto, original_source, created_at")
      .single();

  let { data, error } = await runInsert(payload);

  if (error && isMissingSlugColumnError(error)) {
    const { slug: _slug, ...payloadWithoutSlug } = payload;
    const retry = await runInsert(payloadWithoutSlug);
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    if (error.code === "23505") {
      result.skipped.push({
        title: meme.title,
        imageUrl: meme.imageUrl,
        reason: "duplicate-race",
      });
      return result;
    }

    result.errors.push({
      title: meme.title,
      imageUrl: meme.imageUrl,
      reason: "insert-failed",
      error: error.message || "Insert failed",
    });
    return result;
  }

  result.inserted = 1;
  result.insertedRows.push(data);
  return result;
}

export function createSupabaseServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing Supabase server env vars. Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in Vercel."
    );
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function parseRunLimit(value) {
  return clampLimit(value);
}

export function getMemeApiSourceOptions() {
  return Object.entries(MEME_API_SOURCES).map(([key, value]) => ({
    key,
    label: value.label,
    originalSource: value.originalSource,
  }));
}

export function parseMemeApiSource(value) {
  return normalizeSourceKey(value);
}

export async function getMemeSuggestions({ supabase, limit = 5, source = "all" } = {}) {
  const requestedLimit = clampLimit(limit);
  const fetchedMemes = await fetchMemeBatch(source, requestedLimit);
  const preparedMemes = buildPreparedMemes(fetchedMemes, requestedLimit);
  const existingUrls = await loadExistingImageUrlsSafely(
    supabase,
    preparedMemes.map((item) => item.imageUrl)
  );

  return preparedMemes.filter((item) => !existingUrls.has(item.imageUrl));
}

export async function publishSelectedMemes({
  supabase,
  memes = [],
  userId = null,
  ocrApiKey = process.env.OCR_SPACE_API_KEY || "helloworld",
  openAiApiKey = process.env.OPENAI_API_KEY || "",
  openAiModel = process.env.OPENAI_KEYWORD_MODEL || "",
} = {}) {
  const normalizedMemes = Array.isArray(memes)
    ? memes
        .map((meme) => ({
          title: normalizeWhitespace(meme?.title || ""),
          imageUrl: normalizeWhitespace(meme?.imageUrl || meme?.image_url || ""),
          category: normalizeWhitespace(meme?.category || "Auto") || "Auto",
          mood: normalizeWhitespace(meme?.mood || "Reaction") || "Reaction",
          originalSource:
            normalizeWhitespace(meme?.originalSource || meme?.original_source || "meme-api") || "meme-api",
        }))
        .filter((meme) => meme.title && meme.imageUrl && isAllowedImageUrl(meme.imageUrl))
    : [];

  const existingUrls = await loadExistingImageUrlsSafely(
    supabase,
    normalizedMemes.map((item) => item.imageUrl)
  );
  const safeExistingUrls = existingUrls instanceof Set ? existingUrls : new Set();

  const results = {
    ok: true,
    requested: normalizedMemes.length,
    inserted: 0,
    insertedRows: [],
    skipped: [],
    errors: [],
  };

  for (const meme of normalizedMemes) {
    const batchResult = await processPreparedMeme({
      supabase,
      meme,
      existingUrls: safeExistingUrls,
      ocrApiKey,
      openAiApiKey,
      openAiModel,
      category: meme.category,
      mood: meme.mood,
      originalSource: meme.originalSource,
      userId,
    });

    results.inserted += batchResult.inserted;
    results.insertedRows.push(...batchResult.insertedRows);
    results.skipped.push(...batchResult.skipped);
    results.errors.push(...batchResult.errors);
  }

  return results;
}

export async function runMemeIngestion({
  supabase,
  limit = DEFAULT_LIMIT,
  source = "all",
  ocrApiKey = process.env.OCR_SPACE_API_KEY || "helloworld",
  openAiApiKey = process.env.OPENAI_API_KEY || "",
  openAiModel = process.env.OPENAI_KEYWORD_MODEL || "",
} = {}) {
  const requestedLimit = clampLimit(limit);
  const fetchedMemes = await fetchMemeBatch(source, requestedLimit);
  const preparedMemes = buildPreparedMemes(fetchedMemes, requestedLimit);

  if (preparedMemes.length === 0) {
    return {
      ok: true,
      fetched: fetchedMemes.length,
      prepared: 0,
      existing: 0,
      inserted: 0,
      skipped: [],
      errors: [],
    };
  }

  const imageUrls = preparedMemes.map((item) => item.imageUrl);
  const existingUrls = await loadExistingImageUrlsSafely(supabase, imageUrls);
  const results = {
    ok: true,
    fetched: fetchedMemes.length,
    prepared: preparedMemes.length,
    existing: existingUrls.size,
    inserted: 0,
    insertedRows: [],
    skipped: [],
    errors: [],
  };

  for (let i = 0; i < preparedMemes.length; i += MAX_CONCURRENCY) {
    const batch = preparedMemes.slice(i, i + MAX_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((meme) =>
        processPreparedMeme({
          supabase,
          meme,
          existingUrls,
          ocrApiKey,
          openAiApiKey,
          openAiModel,
        })
      )
    );

    for (const batchResult of batchResults) {
      results.inserted += batchResult.inserted;
      results.insertedRows.push(...batchResult.insertedRows);
      results.skipped.push(...batchResult.skipped);
      results.errors.push(...batchResult.errors);
    }
  }

  return results;
}
