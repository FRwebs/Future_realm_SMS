import type { Metadata, Viewport } from "next";

import { ServiceWorker } from "@/components/layout/service-worker";
import { WarmApi } from "@/components/layout/warm-api";
import { WebVitals } from "@/components/layout/web-vitals";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { QueryProvider } from "@/components/providers/query-provider";
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

export const viewport: Viewport = {
  themeColor: "#0d2315",
};

export const metadata: Metadata = {
  title: "FutureRealm SMS",
  description: "Production-ready school management software for Nigerian schools.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="app-body min-h-screen antialiased">
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <NuqsAdapter>
              <QueryProvider>
                <WarmApi />
                <ServiceWorker />
                <WebVitals />
                {children}
              </QueryProvider>
            </NuqsAdapter>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
