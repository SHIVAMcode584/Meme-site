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

function extractMissingColumnNames(error) {
  const message = String(error?.message || "");
  if (!message) return [];

  const columnNames = new Set();
  const patterns = [
    /could not find(?: the)? (?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_]+)) column/i,
    /(?:'([^']+)'|"([^"]+)"|([A-Za-z0-9_]+))\s+column/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(message);
    if (!match) continue;

    const columnName = match[1] || match[2] || match[3];
    if (columnName) columnNames.add(columnName);
  }

  return [...columnNames];
}

function getColumnKeyVariants(columnName) {
  const value = String(columnName || "").trim();
  if (!value) return [];

  const snakeCase = value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
  const camelCase = value.replace(/[_-](\w)/g, (_, letter) => letter.toUpperCase());

  return [...new Set([value, value.toLowerCase(), snakeCase, camelCase])].filter(Boolean);
}

function stripPayloadColumns(payload, columnNames) {
  const nextPayload = { ...payload };
  const keysToRemove = new Set();

  for (const columnName of columnNames) {
    for (const key of getColumnKeyVariants(columnName)) {
      keysToRemove.add(key);
    }
  }

  for (const key of Object.keys(nextPayload)) {
    if (keysToRemove.has(key)) {
      delete nextPayload[key];
    }
  }

  return nextPayload;
}

function attachSlugIfMissing(result, payload) {
  if (!result?.data || !payload?.slug || result.data.slug) {
    return result;
  }

  return {
    ...result,
    data: {
      ...result.data,
      slug: payload.slug,
    },
  };
}

export async function insertMemeWithSlugFallback(client, payload, selectClause = "*") {
  const runInsert = async (nextPayload) =>
    client.from("meme-table").insert([nextPayload]).select(selectClause).single();

  let currentPayload = payload;
  const seenColumns = new Set();

  while (true) {
    const result = await runInsert(currentPayload);

    if (!result.error) {
      return attachSlugIfMissing(result, payload);
    }

    if (result.error?.code !== "PGRST204") {
      return result;
    }

    const missingColumns = extractMissingColumnNames(result.error).filter(
      (columnName) => columnName && !seenColumns.has(columnName)
    );

    if (missingColumns.length === 0) {
      return result;
    }

    missingColumns.forEach((columnName) => seenColumns.add(columnName));
    const nextPayload = stripPayloadColumns(currentPayload, missingColumns);

    if (Object.keys(nextPayload).length === Object.keys(currentPayload).length) {
      return result;
    }

    currentPayload = nextPayload;
  }
}
