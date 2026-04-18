import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const SUPABASE_ERROR_MESSAGE =
  "Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.";

const isSupabaseConfigured =
  Boolean(supabaseUrl) && Boolean(supabaseKey) && supabaseKey.startsWith("eyJ");

function createDisabledQueryBuilder() {
  const result = { data: null, error: new Error(SUPABASE_ERROR_MESSAGE) };
  let builder;

  builder = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);
        }

        if (prop === "catch" || prop === "finally") {
          return undefined;
        }

        return () => builder;
      },
    }
  );

  return builder;
}

function createDisabledSupabaseClient() {
  const errorResponse = () => ({ data: null, error: new Error(SUPABASE_ERROR_MESSAGE) });

  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: new Error(SUPABASE_ERROR_MESSAGE) }),
      getSession: async () => ({
        data: { session: null },
        error: new Error(SUPABASE_ERROR_MESSAGE),
      }),
      signInWithOtp: async () => errorResponse(),
      signInWithPassword: async () => errorResponse(),
      resetPasswordForEmail: async () => errorResponse(),
      signOut: async () => ({ error: new Error(SUPABASE_ERROR_MESSAGE) }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
    },
    from: () => createDisabledQueryBuilder(),
    rpc: async () => errorResponse(),
    channel: () => ({
      on() {
        return this;
      },
      subscribe() {
        return this;
      },
    }),
    removeChannel: async () => {},
    realtime: {
      setAuth: () => {},
    },
  }
}

if (!isSupabaseConfigured) {
  console.warn(SUPABASE_ERROR_MESSAGE);
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createDisabledSupabaseClient();

export const supabaseConfigured = isSupabaseConfigured;

export default supabase;
