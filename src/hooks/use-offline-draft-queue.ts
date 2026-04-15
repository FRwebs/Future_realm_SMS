"use client";

import { useEffect, useMemo, useState } from "react";

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

  const persistDrafts = (nextDrafts: TPayload[]) => {
    setDrafts(nextDrafts);
    localStorage.setItem(storageKey, JSON.stringify(nextDrafts));
  };

  const saveDraft = (payload: TPayload) => {
    persistDrafts([payload, ...drafts]);
  };

  const clearDrafts = () => {
    setDrafts([]);
    localStorage.removeItem(storageKey);
  };

  const syncDrafts = async () => {
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
  };

  return useMemo(
    () => ({
      drafts,
      draftCount: drafts.length,
      syncing,
      saveDraft,
      clearDrafts,
      syncDrafts
    }),
    [drafts, syncing]
  );
}
