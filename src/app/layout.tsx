import type { Metadata } from "next";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { ToastProvider } from "@/components/ui/toast-provider";

import "./globals.css";

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
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className="app-body min-h-screen antialiased">
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
