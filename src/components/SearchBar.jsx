import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";

const FALLBACK_PLACEHOLDERS = [
  "friend ignored me",
  "awkward reply",
  "overthinking at 2am",
];

export default function SearchBar({ search, setSearch, placeholderTitles = [] }) {
  const placeholders = placeholderTitles.length > 0 ? placeholderTitles : FALLBACK_PLACEHOLDERS;
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    setPlaceholderIndex(0);

    if (placeholders.length <= 1) return undefined;

    const intervalId = window.setInterval(() => {
      setPlaceholderIndex((currentIndex) => (currentIndex + 1) % placeholders.length);
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [placeholders]);

  const activePlaceholder = placeholders[placeholderIndex] || FALLBACK_PLACEHOLDERS[0];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
        {!search ? (
          <div className="pointer-events-none absolute inset-y-0 left-14 right-5 flex items-center overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.span
                key={activePlaceholder}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="truncate text-zinc-500"
              >
                Type your situation (e.g. {activePlaceholder})
              </motion.span>
            </AnimatePresence>
          </div>
        ) : null}
        <input
          type="text"
          value={search}
          placeholder=""
          aria-label="Search memes by situation"
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-14 sm:h-16 pl-14 pr-5 rounded-2xl bg-[#101624] border border-white/10 text-white placeholder:text-zinc-500 outline-none focus:border-violet-400/40 focus:ring-2 focus:ring-violet-500/20 transition"
        />
      </div>
    </div>
  );
}
