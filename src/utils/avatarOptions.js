export const AVATAR_PRESETS = [
  { id: "meme-hero", label: "Hero", style: "avataaars", seed: "meme-hero" },
  { id: "pixel-buddy", label: "Pixel", style: "bottts", seed: "pixel-buddy" },
  { id: "cool-cat", label: "Cool", style: "adventurer", seed: "cool-cat" },
  { id: "sunny-smile", label: "Sunny", style: "lorelei", seed: "sunny-smile" },
  { id: "night-owl", label: "Owl", style: "micah", seed: "night-owl" },
  { id: "retro-roast", label: "Retro", style: "notionists", seed: "retro-roast" },
  { id: "chaos-monkey", label: "Chaos", style: "fun-emoji", seed: "chaos-monkey" },
  { id: "meme-star", label: "Star", style: "thumbs", seed: "meme-star" },
  { id: "pixel-king", label: "King", style: "pixel-art", seed: "pixel-king" },
  { id: "vibe-shape", label: "Vibe", style: "shapes", seed: "vibe-shape" },
  { id: "iconic-one", label: "Icon", style: "icons", seed: "iconic-one" },
  { id: "meme-ghost", label: "Ghost", style: "croodles", seed: "meme-ghost" },
  { id: "smarty-face", label: "Smarty", style: "big-smile", seed: "smarty-face" },
  { id: "rage-bot", label: "Bot", style: "bottts-neutral", seed: "rage-bot" },
  { id: "roast-rider", label: "Rider", style: "open-peeps", seed: "roast-rider" },
  { id: "prime-memer", label: "Prime", style: "personas", seed: "prime-memer" },
];

export const DEFAULT_AVATAR_ID = AVATAR_PRESETS[0].id;

export function buildAvatarUrl(style = "avataaars", seed = "meme-fan") {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

export function getAvatarUrlById(avatarId) {
  const preset = AVATAR_PRESETS.find((option) => option.id === avatarId);

  if (!preset) return buildAvatarUrl("avataaars", avatarId || "meme-fan");

  return buildAvatarUrl(preset.style, preset.seed);
}

export function getAvatarChoiceFromMetadata(metadata) {
  const avatarChoice = metadata?.avatar_choice;

  if (avatarChoice && AVATAR_PRESETS.some((option) => option.id === avatarChoice)) {
    return avatarChoice;
  }

  const avatarUrl = metadata?.avatar_url;
  const matchedPreset = AVATAR_PRESETS.find((option) => getAvatarUrlById(option.id) === avatarUrl);

  return matchedPreset?.id || DEFAULT_AVATAR_ID;
}

export function resolveUserAvatar(user) {
  const metadata = user?.user_metadata || {};

  if (metadata.avatar_choice) return getAvatarUrlById(metadata.avatar_choice);
  if (metadata.avatar_url) return metadata.avatar_url;

  const fallbackSeed = user?.email || metadata?.username || "meme-fan";
  return buildAvatarUrl("avataaars", fallbackSeed);
}
