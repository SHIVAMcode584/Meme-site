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
