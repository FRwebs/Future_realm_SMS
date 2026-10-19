import type { PanelRow } from "@/lib/modules/panels";

export type DeliveryStatus = {
  enabled: boolean;
  since: string;
  carriers: Array<{ channel: string; provider: string; configured: boolean }>;
  queued: { SMS: number; EMAIL: number };
  sent: number;
  failed: number;
  held: number;
  lastRunAt: string | null;
  lastRun: { sent: number; failed: number; held: number } | null;
};

const TICK = "M5 12.5l4.5 4.5 9-10";
const WARN = "M12 8.2v4.6M12 16h.02M12 3.6 21 19.4H3z";

/**
 * Says what happens to a message after "Send" — it leaves through a carrier only when delivery is switched on and the
 * carrier has keys. Otherwise it waits in the queue, and this says so instead of letting "Sent" imply it left.
 */
export function deliveryRow(d: DeliveryStatus): PanelRow {
  const waiting = d.queued.SMS + d.queued.EMAIL;
  if (d.enabled) {
    const names = d.carriers.filter((carrier) => carrier.configured).map((carrier) => `${carrier.provider} (${carrier.channel === "SMS" ? "SMS" : "email"})`).join(" and ");
    return {
      cols: "1fr",
      panels: [{
        type: "note", tone: d.failed || d.held ? "attention" : "positive", icon: d.failed || d.held ? WARN : TICK,
        title: `Delivering through ${names}`,
        body: `${d.sent} sent since delivery was switched on${waiting ? ` · ${waiting} waiting` : ""}${d.failed ? ` · ${d.failed} failed (the reason is kept on each message)` : ""}${d.held ? ` · ${d.held} held because the SMS credits ran out` : ""}. A message is marked sent only after the carrier accepts it.`,
      }],
    };
  }
  const anyKeys = d.carriers.some((carrier) => carrier.configured);
  return {
    cols: "1fr",
    panels: [{
      type: "note", tone: "attention", icon: WARN,
      title: "Messages are queued, not yet leaving the system",
      body: anyKeys
        ? "A carrier is configured, but delivery is switched off. Switch DELIVERY_ENABLED on for the API and queued messages go out."
        : "No SMS or email carrier has its keys set on this system, so a send queues the message and records it. Guardians who use the app still see it in-app. Add the carrier keys (Termii for SMS, an SMTP login for email) and switch delivery on to send for real.",
    }],
  };
}
