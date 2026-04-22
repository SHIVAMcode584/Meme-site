/* global process */

import { createClient } from "@supabase/supabase-js";

function getTokenFromRequest(req) {
  const authHeader = String(req.headers.authorization || "").trim();
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return String(req.headers["x-supabase-access-token"] || "").trim();
}

function resolveSupabaseConfig(options = {}) {
  const supabaseUrl =
    String(options.supabaseUrl || "").trim() ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "";
  const supabaseAnonKey =
    String(options.supabaseAnonKey || "").trim() ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "";
  const supabaseServiceRoleKey =
    String(options.supabaseServiceRoleKey || "").trim() || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  return {
    supabaseUrl: String(supabaseUrl || "").trim(),
    supabaseAnonKey: String(supabaseAnonKey || "").trim(),
    supabaseServiceRoleKey: String(supabaseServiceRoleKey || "").trim(),
  };
}

export function createAdminSupabaseClient(options = {}) {
  const { supabaseUrl, supabaseServiceRoleKey } = resolveSupabaseConfig(options);
  const supabaseKey = supabaseServiceRoleKey;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase config. Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY if you are using the service-role path."
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createAdminUserClient(token, options = {}) {
  const { supabaseUrl, supabaseAnonKey } = resolveSupabaseConfig(options);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase config. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are available to the deployed frontend."
    );
  }

  const authToken = String(token || "").trim();
  if (!authToken) {
    throw new Error("Missing authorization token");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
  });
}

export async function requireAdminRequest(req) {
  const token = getTokenFromRequest(req);
  if (!token) {
    const error = new Error("Missing authorization token");
    error.statusCode = 401;
    throw error;
  }

  const supabase = createAdminUserClient(token, {
    supabaseUrl: req.headers["x-supabase-url"],
    supabaseAnonKey: req.headers["x-supabase-anon-key"],
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(token);

  if (userError || !userData?.user) {
    const error = new Error("Invalid or expired session");
    error.statusCode = 401;
    throw error;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile || profile.role !== "admin") {
    const error = new Error("Admin access required");
    error.statusCode = 403;
    throw error;
  }

  return {
    supabase,
    user: userData.user,
    profile,
    token,
  };
}
