/* global process */

import { createClient } from "@supabase/supabase-js";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function resolveSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "";

  return {
    supabaseUrl: String(supabaseUrl || "").trim(),
    supabaseServiceRoleKey: String(supabaseServiceRoleKey || "").trim(),
  };
}

function createMemesClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = resolveSupabaseConfig();

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing Supabase config. Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in Vercel."
    );
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function fetchMemes(supabase) {
  const primary = await supabase
    .from("meme-table")
    .select("*, profiles(username)")
    .order("created_at", { ascending: false });

  if (!primary.error) {
    return {
      memes: Array.isArray(primary.data) ? primary.data : [],
      source: "profiles",
    };
  }

  const fallback = await supabase
    .from("meme-table")
    .select("*")
    .order("created_at", { ascending: false });

  if (fallback.error) {
    throw primary.error;
  }

  return {
    memes: Array.isArray(fallback.data) ? fallback.data : [],
    source: "fallback",
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    const supabase = createMemesClient();
    const { memes, source } = await fetchMemes(supabase);

    return sendJson(res, 200, {
      ok: true,
      memes,
      source,
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: error.message || "Failed to load memes",
    });
  }
}
