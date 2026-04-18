/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { THEME_OPTIONS, applyThemeToDocument, getInitialTheme } from "./theme-utils";

const ThemeContext = createContext(null);

export function ThemeProvider({ children, initialTheme }) {
  const [theme, setThemeState] = useState(() => initialTheme || getInitialTheme());

  useEffect(() => {
    applyThemeToDocument(theme);
    window.localStorage.setItem("roastriot-theme", theme);
  }, [theme]);

  const setTheme = (nextTheme) => {
    if (!THEME_OPTIONS.some((option) => option.id === nextTheme)) {
      return;
    }

    setThemeState(nextTheme);
  };

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      themeOptions: THEME_OPTIONS,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return value;
}

