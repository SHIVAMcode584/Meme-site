/* global process */

import { createSupabaseServiceClient, parseRunLimit, runMemeIngestion } from "./_lib/meme-ingest.js";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function isCronRequest(req) {
  return String(req.headers["x-vercel-cron"] || "") === "1";
}

function isManualRequestAllowed(req) {
  const configuredToken = String(process.env.INGEST_MANUAL_TOKEN || "").trim();
  if (!configuredToken) {
    return process.env.NODE_ENV !== "production";
  }

  const headerToken = String(req.headers["x-ingest-token"] || "").trim();
  const queryToken = String(new URL(req.url || "", "http://localhost").searchParams.get("token") || "").trim();
  const requestToken = headerToken || queryToken;

  return requestToken && requestToken === configuredToken;
}

export default async function handler(req, res) {
  try {
    if (!["GET", "POST"].includes(req.method || "")) {
      return sendJson(res, 405, { error: "Method Not Allowed" });
    }

    const manualAllowed = isManualRequestAllowed(req);

    if (process.env.NODE_ENV === "production" && !isCronRequest(req) && !manualAllowed) {
      return sendJson(res, 403, {
        error: "Forbidden. This endpoint is intended for scheduled cron requests or an authorized manual trigger.",
      });
    }

    const url = new URL(req.url || "/api/ingest-memes", "http://localhost");
    const limit = parseRunLimit(url.searchParams.get("limit") || 4);

    const supabase = createSupabaseServiceClient();
    const result = await runMemeIngestion({ supabase, limit });

    return sendJson(res, 200, {
      ok: true,
      mode: isCronRequest(req) ? "cron" : manualAllowed ? "manual" : "local",
      ...result,
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: error.message || "Meme ingestion failed",
    });
  }
}
