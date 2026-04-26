import { supabase } from "../lib/supabase";

const usernameCache = new Map();

export function getSafeTimestamp(value) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function formatRelativeTime(value, now) {
  const timestamp = getSafeTimestamp(value);
  if (timestamp === null) return "Just now";

  const diffSeconds = Math.round((timestamp - now) / 1000);
  if (diffSeconds >= -15) return "Just now";

  const absSeconds = Math.abs(diffSeconds);
  if (absSeconds < 60) return `${absSeconds}s ago`;

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return `${Math.abs(diffMinutes)}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return `${Math.abs(diffHours)}h ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${Math.abs(diffDays)}d ago`;
}

export async function resolveSenderUsernames(senderIds, client = supabase) {
  const ids = [...new Set((senderIds || []).filter(Boolean))];
  const missingIds = ids.filter((id) => !usernameCache.has(id));

  if (missingIds.length > 0) {
    const { data, error } = await client.from("profiles").select("id, username").in("id", missingIds);
    if (error) throw error;

    (data || []).forEach((profile) => {
      usernameCache.set(profile.id, profile.username || "Meme fan");
    });

    missingIds.forEach((id) => {
      if (!usernameCache.has(id)) usernameCache.set(id, "Meme fan");
    });
  }

  return ids.reduce((lookup, id) => {
    lookup[id] = usernameCache.get(id) || "Meme fan";
    return lookup;
  }, {});
}

export async function resolveMemePreviewsByIds(memeIds, client = supabase) {
  const ids = [...new Set((memeIds || []).filter(Boolean).map((id) => String(id)))];
  if (ids.length === 0) return {};

  const { data, error } = await client
    .from("meme-table")
    .select("id, title, image_url, image, slug")
    .in("id", ids);

  if (error) throw error;

  return (data || []).reduce((lookup, meme) => {
    lookup[String(meme.id)] = {
      title: meme.title || "Meme",
      image_url: meme.image_url || meme.image || "",
      slug: meme.slug || "",
    };
    return lookup;
  }, {});
}

export async function notifyUsersAboutNewMemes({
  client = supabase,
  memes = [],
  senderId = null,
  senderUsername = "Meme fan",
}) {
  const validMemes = (Array.isArray(memes) ? memes : [memes]).filter(
    (meme) => meme?.id !== undefined && meme?.id !== null
  );

  if (!senderId || validMemes.length === 0) {
    return { inserted: 0, recipients: 0 };
  }

  const { data: profileRows, error: profileError } = await client
    .from("profiles")
    .select("id")
    .neq("id", senderId);

  if (profileError) {
    return { inserted: 0, recipients: 0, error: profileError };
  }

  const recipientIds = (profileRows || []).map((row) => row.id).filter(Boolean);
  if (recipientIds.length === 0) {
    return { inserted: 0, recipients: 0 };
  }

  const payloads = [];

  validMemes.forEach((meme) => {
    const memeTitle = String(meme.title || "new meme").trim() || "new meme";
    const message = `New meme from ${senderUsername || "a creator"}: ${memeTitle}`;

    recipientIds.forEach((recipientId) => {
      payloads.push({
        user_id: recipientId,
        sender_id: senderId,
        meme_id: meme.id,
        type: "meme",
        message,
        is_read: false,
      });
    });
  });

  const { error } = await client.from("notifications").insert(payloads);

  if (error) {
    return { inserted: 0, recipients: recipientIds.length, error };
  }

  return { inserted: payloads.length, recipients: recipientIds.length };
}
