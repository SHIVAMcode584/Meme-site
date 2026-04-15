import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const FORCE = process.argv.includes("--force");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error(
    "Missing required env vars: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const toText = (value) => {
  if (Array.isArray(value)) return value.join(" ");
  if (value == null) return "";
  return String(value);
};

const buildEmbeddingText = (meme) => {
  return [meme.title, toText(meme.keywords), meme.mood, meme.category, meme.description]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" | ");
};

const createEmbedding = async (input) => {
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

  const data = await res.json();

  if (!res.ok || !data?.data?.[0]?.embedding) {
    throw new Error(data?.error?.message || "Embedding API failed");
  }

  return data.data[0].embedding;
};

const main = async () => {
  console.log("Fetching memes...");

  const { data: memes, error } = await supabase
    .from("meme-table")
    .select("id, title, keywords, mood, category, description, embedding")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const targets = (memes || []).filter((meme) => FORCE || !meme.embedding);
  console.log(`Found ${targets.length} meme(s) to embed.`);

  let completed = 0;

  for (const meme of targets) {
    const input = buildEmbeddingText(meme);
    if (!input) continue;

    try {
      const embedding = await createEmbedding(input);
      const vectorLiteral = `[${embedding.join(",")}]`;

      const { error: updateError } = await supabase
        .from("meme-table")
        .update({ embedding: vectorLiteral })
        .eq("id", meme.id);

      if (updateError) throw updateError;

      completed += 1;
      console.log(`[${completed}/${targets.length}] Embedded meme ${meme.id}`);
    } catch (err) {
      console.error(`Failed for meme ${meme.id}:`, err.message);
    }
  }

  console.log(`Done. Updated ${completed} meme(s).`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
