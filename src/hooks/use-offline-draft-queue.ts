"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface UseOfflineDraftQueueOptions {
  storageKey: string;
  endpoint: string;
}

function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

export function useOfflineDraftQueue<TPayload>({
  storageKey,
  endpoint
}: UseOfflineDraftQueueOptions) {
  const [drafts, setDrafts] = useState<TPayload[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return;

    try {
      setDrafts(JSON.parse(stored) as TPayload[]);
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const persistDrafts = useCallback(
    (nextDrafts: TPayload[]) => {
      setDrafts(nextDrafts);
      localStorage.setItem(storageKey, JSON.stringify(nextDrafts));
    },
    [storageKey],
  );

  const saveDraft = useCallback((payload: TPayload) => persistDrafts([payload, ...drafts]), [drafts, persistDrafts]);

  const clearDrafts = useCallback(() => {
    setDrafts([]);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  const syncDrafts = useCallback(async () => {
    if (!drafts.length) return { synced: 0 };

    setSyncing(true);
    const csrfToken = getCookie("fr_csrf");
    let synced = 0;

    for (const draft of drafts) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken ?? ""
        },
        body: JSON.stringify(draft)
      });

      if (response.ok) {
        synced += 1;
      }
    }

    if (synced === drafts.length) {
      clearDrafts();
    } else {
      persistDrafts(drafts.slice(synced));
    }

    setSyncing(false);
    return { synced };
  }, [drafts, endpoint, clearDrafts, persistDrafts]);

  return useMemo(
    () => ({
      drafts,
      draftCount: drafts.length,
      syncing,
      saveDraft,
      clearDrafts,
      syncDrafts
    }),
    [drafts, syncing, saveDraft, clearDrafts, syncDrafts]
  );
}
