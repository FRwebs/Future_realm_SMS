"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { InlineNotice, useNotice } from "@/components/ui/inline-notice";
import { flushOutbox, readOutbox } from "@/lib/offline/outbox";

/**
 * Sends what this device held while it had no connection, the moment it has one again — and says what became of it,
 * so a teacher is never left wondering whether a register they marked on the bus reached the school.
 */
export function OutboxSync() {
  const banner = useNotice();
  const router = useRouter();
  const busy = useRef(false);

  useEffect(() => {
    async function run() {
      if (busy.current || !readOutbox().length) return;
      busy.current = true;
      try {
        const result = await flushOutbox();
        if (!result.sent) return;
        const parts = [result.applied ? `${result.applied} reached the school` : null, result.conflicts ? `${result.conflicts} changed on the record since — a school administrator will choose` : null, result.refused.length ? `${result.refused.length} refused: ${result.refused[0]}` : null].filter(Boolean);
        banner.show({ variant: result.conflicts || result.refused.length ? "warning" : "success", title: "Work from this device was sent", description: parts.join(" · ") });
        router.refresh();
      } finally {
        busy.current = false;
      }
    }
    void run();
    window.addEventListener("online", run);
    window.addEventListener("fr:outbox-flush", run);
    const timer = window.setInterval(run, 60_000);
    return () => {
      window.removeEventListener("online", run);
      window.removeEventListener("fr:outbox-flush", run);
      window.clearInterval(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the notice hook's setters never change
  }, [router]);

  // A strip above the page, in the shell's own flow, that stays until it is read and dismissed.
  return <InlineNotice notice={banner.notice} onDismiss={banner.clear} className="mx-4 mb-1 mt-2 md:mx-6" />;
}
