import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Palette, X } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const POPOVER_GAP = 12;
const VIEWPORT_EDGE_GAP = 12;
const MAX_MENU_WIDTH = 320;

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

export default function ThemeSwitcher({ isOpen, onOpenChange }) {
  const { theme, setTheme, themeOptions } = useTheme();
  const [menuStyle, setMenuStyle] = useState(null);
  const [placement, setPlacement] = useState("below");
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const activeTheme = useMemo(
    () => themeOptions.find((option) => option.id === theme) || themeOptions[1],
    [theme, themeOptions]
  );

  const updateMenuPosition = () => {
    const root = rootRef.current;
    if (!root || typeof window === "undefined") return null;

    const rect = root.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = Math.min(MAX_MENU_WIDTH, Math.max(0, viewportWidth - POPOVER_GAP * 2));
    const measuredHeight = menuRef.current?.offsetHeight || 356;
    const maxAllowedHeight = Math.max(0, viewportHeight - VIEWPORT_EDGE_GAP * 2);
    const menuHeight = Math.min(measuredHeight, maxAllowedHeight);

    const fitsBelow = rect.bottom + POPOVER_GAP + menuHeight <= viewportHeight - VIEWPORT_EDGE_GAP;
    const fitsAbove = rect.top - POPOVER_GAP - menuHeight >= VIEWPORT_EDGE_GAP;
    const placementNext = fitsBelow || !fitsAbove ? "below" : "above";

    let top =
      placementNext === "below"
        ? rect.bottom + POPOVER_GAP
        : rect.top - POPOVER_GAP - menuHeight;

    top = clamp(top, VIEWPORT_EDGE_GAP, viewportHeight - VIEWPORT_EDGE_GAP - menuHeight);

    const left = clamp(
      rect.right - menuWidth,
      POPOVER_GAP,
      viewportWidth - POPOVER_GAP - menuWidth
    );

    setPlacement(placementNext);
    setMenuStyle({
      position: "fixed",
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${Math.round(menuWidth)}px`,
      maxHeight: `${Math.round(maxAllowedHeight)}px`,
    });

    return {
      top,
      left,
      width: menuWidth,
      maxHeight: maxAllowedHeight,
      placement: placementNext,
    };
  };

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return undefined;
    }

    updateMenuPosition();

    const onResize = () => updateMenuPosition();
    const onScroll = () => updateMenuPosition();
    const frame = window.requestAnimationFrame(updateMenuPosition);

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);

    const observers = [];
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => updateMenuPosition());
      if (rootRef.current) observer.observe(rootRef.current);
      if (menuRef.current) observer.observe(menuRef.current);
      observers.push(observer);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      observers.forEach((observer) => observer.disconnect());
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const onPointerDown = (event) => {
      const root = rootRef.current;
      const menu = menuRef.current;
      const target = event.target;

      if (root?.contains(target) || menu?.contains(target)) {
        return;
      }

      onOpenChange(false);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onOpenChange]);

  const menu = (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          ref={menuRef}
          role="menu"
          aria-label="Theme selector"
          initial={{ opacity: 0, y: 10, scale: 0.98, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 8, scale: 0.98, filter: "blur(6px)" }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="fixed z-[280] overflow-hidden rounded-[1.75rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
          style={
            menuStyle || {
              position: "fixed",
              top: "0px",
              left: "0px",
              width: "0px",
              maxHeight: "0px",
              opacity: 0,
              pointerEvents: "none",
            }
          }
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_60%),radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_45%)]" />

          <div className="relative border-b border-[color:var(--app-border)] px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--app-muted)]">
                  Theme Studio
                </p>
                <h3 className="mt-1 text-base font-black tracking-tight text-[color:var(--app-text)]">
                  Pick your vibe
                </h3>
                <p className="mt-1 text-sm leading-5 text-[color:var(--app-muted)]">
                  Switch the whole app palette instantly.
                </p>
              </div>

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-bg)] text-[color:var(--app-muted)] transition hover:bg-[color:var(--app-surface-2)] hover:text-[color:var(--app-text)]"
                aria-label="Close theme menu"
              >
                <X size={16} />
              </button>

              <div className="shrink-0 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] p-2">
                <div
                  className="h-10 w-10 rounded-xl border border-[color:var(--app-border)] shadow-inner"
                  style={{ background: activeTheme.preview }}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          <div className="relative p-3">
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
                      onOpenChange(false);
                    }}
                    className={`group flex items-center gap-3 rounded-[1.25rem] border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[color:var(--app-accent)]/40 ${
                      isActive
                        ? "border-[color:var(--app-accent)] bg-[color:var(--app-surface-2)] shadow-[0_0_0_1px_rgba(168,85,247,0.12)]"
                        : "border-[color:var(--app-border)] bg-[color:var(--app-bg)] hover:border-[color:var(--app-accent)]/35 hover:bg-[color:var(--app-surface-2)]"
                    }`}
                  >
                    <span
                      className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-[color:var(--app-border)] shadow-inner"
                      style={{ background: option.preview }}
                    >
                      {isActive ? (
                        <span className="absolute inset-0 bg-white/10" />
                      ) : null}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-[color:var(--app-text)]">
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

            <div className="mt-3 rounded-[1.1rem] border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2 text-[11px] leading-5 text-[color:var(--app-muted)]">
              <span className="font-semibold text-[color:var(--app-text)]">Tip:</span> press
              <span className="mx-1 rounded-md border border-[color:var(--app-border)] bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--app-text)]">
                Esc
              </span>
              to close.
            </div>
          </div>

          <div
            className={`pointer-events-none absolute right-6 h-3 w-3 rotate-45 border border-[color:var(--app-border)] bg-[color:var(--app-surface)] ${
              placement === "above" ? "bottom-[-6px] border-t-0 border-l-0" : "top-[-6px] border-b-0 border-r-0"
            }`}
            aria-hidden="true"
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
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

      {typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </div>
  );
}
