import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Palette } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeSwitcher() {
  const { theme, setTheme, themeOptions } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);
  const activeTheme = themeOptions.find((option) => option.id === theme) || themeOptions[1];

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-2.5 py-1.5 text-[11px] font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-2)] sm:gap-2 sm:px-4 sm:py-2 sm:text-xs"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <Palette size={14} className="text-[color:var(--app-accent)] sm:size-4" />
        <span className="hidden sm:inline">Theme</span>
        <span className="sm:hidden">UI</span>
        <span className="h-1 w-1 rounded-full bg-[color:var(--app-accent-2)] sm:h-1.5 sm:w-1.5" />
        <span className="min-w-0 max-w-[4.75rem] truncate sm:max-w-none">{activeTheme.name}</span>
        <ChevronDown size={12} className={`transition-transform sm:size-3.5 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[220] max-h-[calc(100dvh-7rem)] w-[calc(100vw-1rem)] max-w-[18rem] overflow-y-auto overflow-x-hidden rounded-[1.5rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] shadow-[0_24px_70px_var(--app-glow)] backdrop-blur-xl sm:w-[min(18rem,calc(100vw-1.5rem))]"
          role="menu"
          aria-label="Theme selector"
        >
          <div className="border-b border-[color:var(--app-border)] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--app-muted)]">
              Select theme
            </p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">Pick your vibe</p>
          </div>
          <div className="p-3">
            <div className="grid gap-2">
              {themeOptions.map((option) => {
                const isActive = option.id === theme;

                return (
                  <button
                    key={option.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    onClick={() => {
                      setTheme(option.id);
                      setIsOpen(false);
                    }}
                    className={`group flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition sm:py-3 ${
                      isActive
                        ? "border-[color:var(--app-accent)] bg-[color:var(--app-surface-2)]"
                        : "border-[color:var(--app-border)] bg-[color:var(--app-bg)] hover:border-[color:var(--app-accent)]/40 hover:bg-[color:var(--app-surface-2)]"
                    }`}
                  >
                    <span
                      className="h-9 w-9 shrink-0 rounded-xl border border-[color:var(--app-border)] shadow-inner sm:h-10 sm:w-10"
                      style={{ background: option.preview }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-[color:var(--app-text)]">
                          {option.name}
                        </span>
                        {isActive ? <Check size={14} className="text-emerald-400" /> : null}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-[color:var(--app-muted)] sm:text-xs sm:leading-5">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
