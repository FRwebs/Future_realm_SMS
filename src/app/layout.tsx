import type { Metadata } from "next";

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
    <html lang="en">
      <body className="min-h-screen bg-[#f6f3ee] font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}