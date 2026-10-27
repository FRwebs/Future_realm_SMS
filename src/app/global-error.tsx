"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** The last line of defence: a failure so deep that the page itself could not draw. It is reported, and the person is given a way back. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#f7faf8", color: "#0d2315", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
        <main style={{ maxWidth: 440, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 10px" }}>Something went wrong</h1>
          <p style={{ color: "#435048", lineHeight: 1.6, margin: "0 0 22px" }}>
            The page could not be shown. Nothing you saved has been lost. Try again; if it keeps happening, tell your school office
            {error.digest ? ` and quote ${error.digest}` : ""}.
          </p>
          <button type="button" onClick={reset} style={{ background: "#0d2315", color: "#fff", border: 0, borderRadius: 11, padding: "12px 22px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
