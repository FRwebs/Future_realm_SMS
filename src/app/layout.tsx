import type { Metadata } from "next";

import { WarmApi } from "@/components/layout/warm-api";
import { ThemeProvider } from "@/components/theme/theme-provider";

import "./globals.css";

const themeBootstrapScript = `
(() => {
  try {
    const storageKey = "sms-theme";
    const stored = window.localStorage.getItem(storageKey);
    const theme = stored === "light" || stored === "dark" ? stored : "light";
    document.documentElement.setAttribute("data-theme", theme);
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
          <WarmApi />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
