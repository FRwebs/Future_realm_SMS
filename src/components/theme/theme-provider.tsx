"use client";

import {
  createContext,
  useContext,
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
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(resolveInitialTheme);

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
