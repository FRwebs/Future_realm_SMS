"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type ThemeMode = "dark" | "light";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = "sms-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const attributeTheme = document.documentElement.getAttribute("data-theme");
  if (attributeTheme === "dark" || attributeTheme === "light") return attributeTheme;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always start at the server-rendered default ("light") so the client's
  // first render matches SSR output exactly. resolveInitialTheme() reads
  // window/localStorage, which already exist by the time React hydrates —
  // calling it as the useState initializer would make the client's first
  // render diverge from the server's, producing a hydration mismatch. The
  // inline bootstrap script in <head> already sets data-theme on <html>
  // before paint, so this only affects React-state-driven variants (e.g.
  // the theme toggle icon), not the CSS itself.
  const [theme, setThemeState] = useState<ThemeMode>("light");

  useEffect(() => {
    setThemeState(resolveInitialTheme());
  }, []);

  const setTheme = (nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("data-theme", nextTheme);
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    }
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }
  return context;
}
