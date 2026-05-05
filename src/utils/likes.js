import { supabase, supabaseConfigured } from "../lib/supabase";

const OWNER_LIKES_STORAGE_KEY = "owner-meme-likes-v1";
const OWNER_LIKES_TABLE = "owner_meme_likes";

const getKey = (memeId) => String(memeId);

const readStore = () => {
  if (typeof window === "undefined") return {};

  try {
    const raw = localStorage.getItem(OWNER_LIKES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeStore = (store) => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(OWNER_LIKES_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage failures so likes still work for the current session.
  }
};

const normalizeEntry = (entry) => {
  const likedBy = Array.isArray(entry?.likedBy)
    ? [...new Set(entry.likedBy.filter(Boolean))]
    : [];

  return {
    likedBy,
    count: likedBy.length,
  };
};

const buildMergedOwnerLikeMap = (rows = null) => {
  const merged = new Map();
  const seenPairs = new Set();

  const addLike = (memeKey, userId) => {
    const key = getKey(memeKey);
    const normalizedUserId = String(userId || "");

    if (!key || !normalizedUserId) return;

    const pairKey = `${key}:${normalizedUserId}`;
    if (seenPairs.has(pairKey)) return;

    seenPairs.add(pairKey);

    if (!merged.has(key)) {
      merged.set(key, new Set());
    }

    merged.get(key).add(normalizedUserId);
  };

  if (Array.isArray(rows)) {
    rows.forEach((row) => addLike(row?.meme_key, row?.user_id));
  }

  const localStore = readStore();
  Object.entries(localStore).forEach(([memeKey, entry]) => {
    normalizeEntry(entry).likedBy.forEach((userId) => addLike(memeKey, userId));
  });

  return merged;
};

const getLocalOwnerLikeSnapshot = (memeId, userId) => {
  const store = readStore();
  const entry = normalizeEntry(store[getKey(memeId)]);
  const liked = Boolean(userId) && entry.likedBy.includes(userId);

  return {
    liked,
    count: entry.count,
  };
};

const getLocalAllOwnerLikeCounts = () => {
  const store = readStore();

  return Object.entries(store).reduce((acc, [memeId, entry]) => {
    acc[memeId] = normalizeEntry(entry).count;
    return acc;
  }, {});
};

const getLocalOwnerLikedMemeIdsForUser = (userId) => {
  if (!userId) return [];

  const store = readStore();

  return Object.entries(store).reduce((ids, [memeId, entry]) => {
    const { likedBy } = normalizeEntry(entry);
    if (likedBy.includes(userId)) ids.push(memeId);
    return ids;
  }, []);
};

const setLocalOwnerMemeLike = (memeId, userId, shouldLike) => {
  if (!userId) return { liked: false, count: 0 };

  const store = readStore();
  const key = getKey(memeId);
  const entry = normalizeEntry(store[key]);
  const hasLiked = entry.likedBy.includes(userId);

  if (shouldLike && !hasLiked) {
    entry.likedBy.push(userId);
  }

  if (!shouldLike && hasLiked) {
    entry.likedBy = entry.likedBy.filter((id) => id !== userId);
  }

  entry.count = entry.likedBy.length;

  if (entry.count === 0) {
    delete store[key];
  } else {
    store[key] = entry;
  }

  writeStore(store);

  return {
    liked: shouldLike,
    count: entry.count,
  };
};

async function fetchOwnerLikeRows() {
  if (!supabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from(OWNER_LIKES_TABLE)
      .select("meme_key, user_id");

    if (error) throw error;

    return Array.isArray(data) ? data : [];
  } catch {
    return null;
  }
}

export const isOwnerMeme = (meme) => !meme?.user_id;

export const getOwnerMemeLikeSnapshot = (memeId, userId) => {
  const merged = buildMergedOwnerLikeMap();
  const key = getKey(memeId);
  const likedBy = merged.get(key) || new Set();
  const normalizedUserId = String(userId || "");

  return {
    liked: Boolean(normalizedUserId) && likedBy.has(normalizedUserId),
    count: likedBy.size,
  };
};

export async function fetchOwnerMemeLikeSnapshot(memeId, userId) {
  if (!userId) return { liked: false, count: 0 };

  const key = getKey(memeId);
  const rows = await fetchOwnerLikeRows();
  const merged = buildMergedOwnerLikeMap(rows);
  const likedBy = merged.get(key) || new Set();

  return {
    liked: likedBy.has(String(userId)),
    count: likedBy.size,
  };
}

export function getAllOwnerLikeCounts() {
  const merged = buildMergedOwnerLikeMap();
  return Object.fromEntries(
    [...merged.entries()].map(([memeKey, likedBy]) => [memeKey, likedBy.size])
  );
}

export async function fetchAllOwnerLikeCounts() {
  const rows = await fetchOwnerLikeRows();
  const merged = buildMergedOwnerLikeMap(rows);

  return Object.fromEntries(
    [...merged.entries()].map(([memeKey, likedBy]) => [memeKey, likedBy.size])
  );
}

export function getOwnerLikedMemeIdsForUser(userId) {
  return getLocalOwnerLikedMemeIdsForUser(userId);
}

export async function fetchOwnerLikedMemeIdsForUser(userId) {
  if (!userId) return [];

  const rows = await fetchOwnerLikeRows();
  const merged = buildMergedOwnerLikeMap(rows);
  const normalizedUserId = String(userId);

  return [...merged.entries()]
    .filter(([, likedBy]) => likedBy.has(normalizedUserId))
    .map(([memeKey]) => memeKey)
    .filter(Boolean);
}

export async function setOwnerMemeLike(memeId, userId, shouldLike) {
  if (!userId) return { liked: false, count: 0 };

  const key = getKey(memeId);

  if (!supabaseConfigured) {
    return setLocalOwnerMemeLike(key, userId, shouldLike);
  }

  try {
    if (shouldLike) {
      const { error } = await supabase.from(OWNER_LIKES_TABLE).upsert(
        {
          user_id: userId,
          meme_key: key,
        },
        { onConflict: "user_id,meme_key" }
      );

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from(OWNER_LIKES_TABLE)
        .delete()
        .eq("user_id", userId)
        .eq("meme_key", key);

      if (error) throw error;
    }

    const snapshot = await fetchOwnerMemeLikeSnapshot(key, userId);
    setLocalOwnerMemeLike(key, userId, shouldLike);
    return snapshot;
  } catch {
    return setLocalOwnerMemeLike(key, userId, shouldLike);
  }
}
