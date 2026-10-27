"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { INK, MUTED, toneOf } from "@/lib/modules/tones";
import { flushOutbox, readOutbox, type OutboxEntry } from "@/lib/offline/outbox";

type Device = { online: boolean; queued: number; held: OutboxEntry[]; used: number | null; quota: number | null; persisted: boolean | null; checked: string };

const mb = (bytes: number) => (bytes >= 1_073_741_824 ? `${Math.round((bytes / 1_073_741_824) * 10) / 10} GB` : bytes >= 1_048_576 ? `${Math.round((bytes / 1_048_576) * 10) / 10} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Reads what only the device knows. Queued records are whatever a screen has set aside under an "offline:" key. */
function read(): Device {
  let queued = 0;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index) ?? "";
      if (!key.startsWith("offline:")) continue;
      const value = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
      queued += Array.isArray(value) ? value.length : 1;
    }
  } catch {
    // Storage can be blocked; a device that cannot say what it holds says nothing rather than zero.
  }
  return { online: navigator.onLine, queued, held: readOutbox(), used: null, quota: null, persisted: null, checked: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) };
}

/** The mockup's four questions, answered by the device in front of the person: connection, what is waiting here, storage, and whether the browser will keep it. */
export function DevicePanel({ title, sub }: { title?: string; sub?: string }) {
  const router = useRouter();
  const [device, setDevice] = useState<Device | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const check = useCallback(async () => {
    const next = read();
    try {
      const estimate = await navigator.storage?.estimate?.();
      next.used = estimate?.usage ?? null;
      next.quota = estimate?.quota ?? null;
      next.persisted = (await navigator.storage?.persisted?.()) ?? null;
    } catch {
      // An older browser has no storage API; the panel says so.
    }
    setDevice(next);
  }, []);

  useEffect(() => {
    void check();
    const onChange = () => void check();
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    return () => {
      window.removeEventListener("online", onChange);
      window.removeEventListener("offline", onChange);
    };
  }, [check]);

  if (!device) return null;
  const connection = toneOf(device.online ? "positive" : "attention");
  const cards = [
    { label: "This device", value: device.online ? "Online" : "Offline", sub: device.online ? "Everything saved goes straight to the school's record" : "Work is kept on this device until the connection returns", tone: connection },
    { label: "Waiting on this device", value: String(device.queued), sub: device.queued ? "Set aside offline, not yet sent" : "Nothing is held here", tone: toneOf(device.queued ? "attention" : "positive") },
    { label: "Storage held", value: device.used === null ? "—" : mb(device.used), sub: device.quota === null ? "This browser does not say how much it allows" : `of ${mb(device.quota)} this browser allows`, tone: toneOf("neutral") },
    { label: "Kept if space runs short", value: device.persisted === null ? "Not reported" : device.persisted ? "Yes" : "Not guaranteed", sub: device.persisted ? "The browser will not clear it on its own" : "The browser may clear it if the device runs short of space", tone: toneOf(device.persisted ? "positive" : "attention") },
  ];
  return (
    <section className="min-w-0 rounded-[14px] border bg-(--color-bg-surface) px-[18px] pb-[16px] pt-[14px]" style={{ borderColor: "#DEE8E2" }}>
      <header className="flex flex-wrap items-start justify-between gap-[12px]">
        <div>
          <h3 className="text-[12.5px] font-semibold" style={{ color: INK }}>{title ?? "This device"}</h3>
          <p className="mt-[3px] text-[10.5px]" style={{ color: MUTED }}>{sub ?? `Read from this device at ${device.checked}.`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setNote(null);
              const sent = await flushOutbox();
              await check();
              router.refresh();
              setNote(!sent.sent ? (readOutbox().length ? "This device could not reach the school. What it holds is kept, and goes when the connection returns." : "Nothing was waiting on this device. The figures above were re-read from the school's record.") : [sent.applied ? `${sent.applied} reached the school's record` : null, sent.conflicts ? `${sent.conflicts} changed on the record since and wait for a school administrator to choose` : null, sent.refused.length ? `${sent.refused.length} refused — ${sent.refused[0]}` : null].filter(Boolean).join(" · "));
              setBusy(false);
            }}
            className="rounded-[9px] px-[14px] py-[8px] text-[11.5px] font-semibold text-white disabled:opacity-60"
            style={{ background: INK }}
          >
            {busy ? "Syncing…" : "Sync now"}
          </button>
          {device.persisted === false ? (
            <button type="button" onClick={async () => { await navigator.storage?.persist?.(); await check(); }} className="rounded-[9px] border bg-white px-[14px] py-[8px] text-[11.5px] font-semibold" style={{ borderColor: "#CFDDD5", color: "#435048" }}>
              Ask the browser to keep it
            </button>
          ) : null}
        </div>
      </header>
      {note ? <p className="mt-[10px] rounded-[10px] border px-[12px] py-[8px] text-[11px]" style={{ borderColor: "#CFE4DB", background: "#F4FAF7", color: INK }}>{note}</p> : null}
      {device.held.length ? (
        <ul className="mt-[10px] grid gap-[6px]">
          {device.held.map((entry) => (
            <li key={entry.clientId} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border px-[12px] py-[8px] text-[11px]" style={{ borderColor: "#E7D9B4", background: "#FBF6E8", color: "#8A6410" }}>
              <span className="font-semibold">{entry.kind === "ATTENDANCE" ? `Register · ${String(entry.body.date ?? "")}` : "Scores"}</span>
              <span>Captured {new Date(entry.capturedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · waiting to be sent</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-[12px] grid gap-[10px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(176px, 1fr))" }}>
        {cards.map((card) => (
          <article key={card.label} className="rounded-[14px] border px-[14px] pb-[13px] pt-[12px]" style={{ borderColor: "#DEE8E2" }}>
            <p className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>{card.label}</p>
            <p className="mt-[8px] text-[20px] font-extrabold leading-none tracking-[-0.03em]" style={{ color: card.tone.fg }}>{card.value}</p>
            <p className="mt-[6px] text-pretty text-[10.5px] leading-[1.4]" style={{ color: MUTED }}>{card.sub}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
