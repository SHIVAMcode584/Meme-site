import { useEffect, useState } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Search } from "lucide-react";

const FALLBACK_PLACEHOLDERS = [
  "friend ignored me",
  "awkward reply",
  "overthinking at 2am",
];

export default function SearchBar({ search, setSearch, placeholderTitles = [] }) {
  const placeholders = placeholderTitles.length > 0 ? placeholderTitles : FALLBACK_PLACEHOLDERS;
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (placeholders.length <= 1) return undefined;

    const intervalId = window.setInterval(() => {
      setPlaceholderIndex((currentIndex) => (currentIndex + 1) % placeholders.length);
    }, 4200);

    return () => window.clearInterval(intervalId);
  }, [placeholders]);

  useEffect(() => {
    const updateIsMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };

    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);

    return () => window.removeEventListener("resize", updateIsMobile);
  }, []);

  const activePlaceholder = placeholders[placeholderIndex % placeholders.length] || FALLBACK_PLACEHOLDERS[0];
  const mobilePrompt = `Search (e.g. ${activePlaceholder})`;
  const desktopPrompt = `Type your situation (e.g. ${activePlaceholder})`;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="group relative rounded-[1.75rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface)]/95 shadow-[0_18px_50px_var(--app-glow)] backdrop-blur-xl transition focus-within:border-[color:var(--app-accent)]/45 focus-within:shadow-[0_22px_70px_var(--app-glow)]">
        <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--app-muted)] transition-colors group-focus-within:text-[color:var(--app-accent)]" />
        {!search ? (
          <div className="pointer-events-none absolute inset-y-0 left-14 right-5 flex items-center overflow-hidden">
            <AnimatePresence mode="wait">
              <Motion.span
                key={isMobile ? mobilePrompt : desktopPrompt}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="truncate whitespace-nowrap text-[color:var(--app-muted)] opacity-85"
              >
                {isMobile ? mobilePrompt : desktopPrompt}
              </Motion.span>
            </AnimatePresence>
          </div>
        ) : null}
        <input
          type="text"
          value={search}
          placeholder=""
          aria-label="Search memes by situation"
          onChange={(e) => setSearch(e.target.value)}
          className="h-14 w-full rounded-[1.75rem] bg-transparent pl-14 pr-5 text-[color:var(--app-text)] outline-none transition placeholder:text-[color:var(--app-muted)] sm:h-16"
        />
      </div>
    </div>
  );
}
