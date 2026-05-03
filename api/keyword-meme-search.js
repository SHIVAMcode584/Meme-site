/* global process */

import { buildGlobalMemeSearchResponse } from "./_lib/global-meme-engine.js";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const url = new URL(req.url || "/api/keyword-meme-search", "http://localhost");
    const query = url.searchParams.get("q") || "";
    const limit = url.searchParams.get("limit") || 20;
    const page = url.searchParams.get("page") || 1;
    const after = url.searchParams.get("after");

    const payload = await buildGlobalMemeSearchResponse({
      query,
      limit,
      page,
      after,
    });

    return sendJson(res, 200, payload);
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: error.message || "Keyword meme search failed",
    });
  }
}
