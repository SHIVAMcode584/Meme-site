import {
  getMemeSuggestions,
  parseMemeApiSource,
  parseRunLimit,
  publishSelectedMemes,
} from "../_lib/meme-ingest.js";
import { createAdminSupabaseClient, requireAdminRequest } from "../_lib/admin-auth.js";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  if (typeof req.body === "string") {
    return JSON.parse(req.body || "{}");
  }

  if (typeof req.body === "object" && req.body) {
    return req.body;
  }

  return {};
}

export default async function handler(req, res) {
  try {
    const { user } = await requireAdminRequest(req);
    const serviceClient = createAdminSupabaseClient();

    if (req.method === "GET") {
      const url = new URL(req.url || "/api/admin/meme-publisher", "http://localhost");
      const limit = parseRunLimit(url.searchParams.get("limit") || 5);
      const source = parseMemeApiSource(url.searchParams.get("source") || "all");
      const candidates = await getMemeSuggestions({ supabase: serviceClient, limit, source });

      return sendJson(res, 200, {
        ok: true,
        candidates,
      });
    }

    if (req.method === "POST") {
      const body = readJsonBody(req);
      const memes = Array.isArray(body?.memes) ? body.memes : [];

      if (memes.length === 0) {
        return sendJson(res, 400, {
          ok: false,
          error: "No memes were selected.",
        });
      }

      const result = await publishSelectedMemes({
        supabase: serviceClient,
        memes,
        userId: user?.id || null,
        openAiApiKey: "",
      });

      if (result.inserted === 0 && (result.errors || []).length > 0) {
        return sendJson(res, 400, {
          ok: false,
          ...result,
          error:
            result.errors
              .map((item) => item?.error || item?.reason)
              .filter(Boolean)
              .join(" | ") || "No memes were published.",
        });
      }

      return sendJson(res, 200, {
        ok: true,
        ...result,
      });
    }

    return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      ok: false,
      error: error.message || "Meme publishing failed",
    });
  }
}
