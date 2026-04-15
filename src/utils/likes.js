const OWNER_LIKES_STORAGE_KEY = "owner-meme-likes-v1";

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
  localStorage.setItem(OWNER_LIKES_STORAGE_KEY, JSON.stringify(store));
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

export const isOwnerMeme = (meme) => !meme?.user_id;

export const getOwnerMemeLikeSnapshot = (memeId, userId) => {
  const store = readStore();
  const entry = normalizeEntry(store[getKey(memeId)]);
  const liked = Boolean(userId) && entry.likedBy.includes(userId);

  return {
    liked,
    count: entry.count,
  };
};

export const setOwnerMemeLike = (memeId, userId, shouldLike) => {
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

export const getAllOwnerLikeCounts = () => {
  const store = readStore();

  return Object.entries(store).reduce((acc, [memeId, entry]) => {
    acc[memeId] = normalizeEntry(entry).count;
    return acc;
  }, {});
};

export const getOwnerLikedMemeIdsForUser = (userId) => {
  if (!userId) return [];

  const store = readStore();

  return Object.entries(store).reduce((ids, [memeId, entry]) => {
    const { likedBy } = normalizeEntry(entry);
    if (likedBy.includes(userId)) ids.push(memeId);
    return ids;
  }, []);
};
