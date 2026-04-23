/* global process */

import { memes as localFallbackMemes } from "../src/data/memes.js";

const REDDIT_SEARCH_URL = "https://www.reddit.com/search.json";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 20;
const REDDIT_FETCH_TIMEOUT_MS = 8000;
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);
const ALLOWED_IMAGE_HOSTS = new Set([
  "i.redd.it",
  "preview.redd.it",
  "external-preview.redd.it",
  "i.imgur.com",
]);

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJsonResponse(response) {
  const rawText = await response.text();
  if (!rawText) return {};

  try {
    return JSON.parse(rawText);
  } catch {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      throw new Error("Live search source returned an unexpected response.");
    }

    throw new Error("Live search source returned an unexpected response.");
  }
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

function isAllowedImageUrl(url) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    if ([...ALLOWED_IMAGE_EXTENSIONS].some((extension) => pathname.endsWith(extension))) {
      return true;
    }

    return ALLOWED_IMAGE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractRedditImageUrl(post) {
  const candidates = [
    post?.url_overridden_by_dest,
    post?.preview?.images?.[0]?.source?.url,
    post?.preview?.images?.[0]?.resolutions?.slice(-1)?.[0]?.url,
    post?.secure_media?.oembed?.thumbnail_url,
    post?.thumbnail && String(post.thumbnail).startsWith("http") ? post.thumbnail : "",
    post?.url,
  ]
    .map((item) => decodeHtmlEntities(item))
    .filter(Boolean);

  return candidates.find((candidate) => isAllowedImageUrl(candidate)) || "";
}

function mapRedditPost(post) {
  if (post?.over_18) return null;
  const imageUrl = extractRedditImageUrl(post);

  return {
    id: String(post?.id || post?.name || `${post?.subreddit}-${post?.title}`),
    title: decodeHtmlEntities(post?.title || "Reddit meme"),
    imageUrl,
    subreddit: post?.subreddit_name_prefixed || `r/${post?.subreddit || "memes"}`,
    permalink: post?.permalink ? `https://www.reddit.com${post.permalink}` : "",
    postUrl: post?.permalink ? `https://www.reddit.com${post.permalink}` : "",
    source: "reddit",
  };
}

async function fetchRedditResults(query, limit, after) {
  const searchTerms = `${normalizeQuery(query)} meme`.trim();
  const searchUrl = new URL(REDDIT_SEARCH_URL);
  searchUrl.searchParams.set("q", searchTerms);
  searchUrl.searchParams.set("limit", String(limit));
  searchUrl.searchParams.set("sort", "relevance");
  searchUrl.searchParams.set("t", "all");
  searchUrl.searchParams.set("raw_json", "1");
  searchUrl.searchParams.set("restrict_sr", "0");
  searchUrl.searchParams.set("type", "link");
  if (after) searchUrl.searchParams.set("after", after);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REDDIT_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(searchUrl, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "RoastRiot.meme/1.0",
      },
    });

    const payload = await readJsonResponse(response);
    if (!response.ok) {
      const message = payload?.message || payload?.reason || `Reddit search failed (${response.status})`;
      throw new Error(message);
    }

    const posts = Array.isArray(payload?.data?.children) ? payload.data.children : [];
    const results = posts
      .map((item) => mapRedditPost(item?.data))
      .filter(Boolean)
      .slice(0, limit);

    return {
      source: "reddit",
      results,
      after: payload?.data?.after || null,
      hasMore: Boolean(payload?.data?.after),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildLocalFallbackResults(query, limit) {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];

  const ranked = localFallbackMemes
    .map((meme) => {
      const searchableText = [
        meme?.title || "",
        meme?.category || "",
        meme?.mood || "",
        ...(Array.isArray(meme?.keywords) ? meme.keywords : []),
      ]
        .join(" ")
        .toLowerCase();

      const score = tokens.reduce((total, token) => {
        if (!token) return total;
        return total + (searchableText.includes(token) ? 2 : 0);
      }, 0);

      return { meme, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return String(left.meme?.title || "").localeCompare(String(right.meme?.title || ""));
    })
    .slice(0, limit);

  return ranked.map(({ meme }, index) => ({
    id: `local-${meme?.id || index}`,
    title: meme?.title || "Local meme",
    imageUrl: meme?.image || meme?.imageUrl || "",
    subreddit: "r/memes",
    permalink: "",
    postUrl: "",
    source: "local",
  }));
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const url = new URL(req.url || "/api/keyword-meme-search", "http://localhost");
    const query = normalizeQuery(url.searchParams.get("q") || "");
    const limit = clampLimit(url.searchParams.get("limit") || DEFAULT_LIMIT);
    const after = normalizeQuery(url.searchParams.get("after") || "");
    if (!query) {
      return sendJson(res, 200, {
        ok: true,
        source: "empty",
        results: [],
        after: null,
        hasMore: false,
      });
    }

    try {
      const redditResults = await fetchRedditResults(query, limit, after || null);

      if (redditResults.results.length > 0) {
        return sendJson(res, 200, {
          ok: true,
          query,
          ...redditResults,
        });
      }

      const localResults = buildLocalFallbackResults(query, limit);
      if (localResults.length > 0) {
        return sendJson(res, 200, {
          ok: true,
          query,
          source: "local",
          reason: "Live search returned no matches. Showing local meme results instead.",
          results: localResults,
          after: null,
          hasMore: false,
        });
      }
    } catch (redditError) {
      const localResults = buildLocalFallbackResults(query, limit);
      if (localResults.length > 0) {
        return sendJson(res, 200, {
          ok: true,
          query,
          source: "local",
          reason:
            redditError.message || "Live search source returned an unexpected response.",
          results: localResults,
          after: null,
          hasMore: false,
        });
      }

      return sendJson(res, 200, {
        ok: true,
        query,
        source: "empty",
        reason:
          redditError.message || "Live search source returned an unexpected response.",
        results: [],
        after: null,
        hasMore: false,
      });
    }

    return sendJson(res, 200, {
      ok: true,
      query,
      source: "empty",
      reason: "No live matches were found.",
      results: [],
      after: null,
      hasMore: false,
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: error.message || "Keyword meme search failed",
    });
  }
}
