export function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildMemeSlug(title) {
  const baseSlug = generateSlug(title) || "meme";
  const suffix = Math.random().toString(36).substring(2, 7);
  return `${baseSlug}-${suffix}`;
}

function isMissingSlugColumnError(error) {
  return (
    error?.code === "PGRST204" &&
    typeof error?.message === "string" &&
    error.message.includes("slug")
  );
}

export async function insertMemeWithSlugFallback(client, payload, selectClause = "*") {
  const runInsert = async (nextPayload) =>
    client.from("meme-table").insert([nextPayload]).select(selectClause).single();

  let result = await runInsert(payload);

  if (!result.error || !isMissingSlugColumnError(result.error)) {
    return result;
  }

  const { slug: _slug, ...payloadWithoutSlug } = payload;
  result = await runInsert(payloadWithoutSlug);

  if (result.error) {
    return result;
  }

  return {
    ...result,
    data: result.data
      ? {
          ...result.data,
          slug: payload.slug,
        }
      : result.data,
  };
}
