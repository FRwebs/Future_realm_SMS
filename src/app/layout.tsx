import type { Metadata } from "next";

import ThemeEditor from "@/components/ThemeEditor/ThemeEditor";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ToastProvider } from "@/components/ui/toast-provider";

import "./globals.css";

const themeBootstrapScript = `
(() => {
  try {
    const storageKey = "sms-theme";
    const customThemeKey = "custom-theme";
    const stored = window.localStorage.getItem(storageKey);
    const theme = stored === "light" || stored === "dark" ? stored : "light";
    document.documentElement.setAttribute("data-theme", theme);

    const savedThemes = JSON.parse(window.localStorage.getItem(customThemeKey) ?? "{}");
    const themeValues = savedThemes && typeof savedThemes === "object" ? savedThemes[theme] : null;
    if (themeValues && typeof themeValues === "object") {
      for (const [name, value] of Object.entries(themeValues)) {
        if (name.startsWith("--") && typeof value === "string") {
          document.documentElement.style.setProperty(name, value);
        }
      }
    }
  } catch {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`;

export const metadata: Metadata = {
  title: "FutureRealm SMS",
  description: "Production-ready school management software for Nigerian schools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="app-body min-h-screen antialiased">
        <ThemeProvider>
          <ToastProvider>
            <ThemeEditor />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
