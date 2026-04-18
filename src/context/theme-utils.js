const THEME_STORAGE_KEY = "roastriot-theme";

export const THEME_OPTIONS = [
  {
    id: "light",
    name: "Light",
    description: "Bright, clean, and airy.",
    preview: "linear-gradient(135deg, #ffffff 0%, #dbeafe 100%)",
  },
  {
    id: "dark",
    name: "Dark",
    description: "Classic roast-mode default.",
    preview: "linear-gradient(135deg, #0f172a 0%, #111827 100%)",
  },
  {
    id: "neon",
    name: "Neon",
    description: "Electric green with a terminal vibe.",
    preview: "linear-gradient(135deg, #020617 0%, #062e14 100%)",
  },
  {
    id: "cyberpunk",
    name: "Cyberpunk",
    description: "Hot magenta, neon gold, full arcade energy.",
    preview: "linear-gradient(135deg, #0f0826 0%, #3b0a57 100%)",
  },
];

export function getInitialTheme() {
  if (typeof window === "undefined") return "dark";

  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (THEME_OPTIONS.some((option) => option.id === savedTheme)) {
    return savedTheme;
  }

  return "dark";
}

export function applyThemeToDocument(theme) {
  if (typeof document === "undefined") return;

  document.documentElement.className = theme;
  document.documentElement.dataset.theme = theme;
}

