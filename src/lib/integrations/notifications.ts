import { CARRIERS, msisdn } from "@/lib/integrations/carriers";
import { sendEmail } from "@/lib/integrations/mailer";

export interface NotificationPayload {
  channel: "SMS" | "EMAIL" | "PUSH" | "IN_APP";
  recipient: string;
  title: string;
  body: string;
}

export type NotificationResult = { delivered: boolean; provider: string; reason?: string; payload: NotificationPayload };

/**
 * Sends one message now, and reports what actually happened.
 *
 * `delivered` is true only when a carrier accepted it. A recipient that is not an address ("All families", "parent"), a
 * channel with no carrier set up, or a carrier that refused, all say so in `reason` — nothing here claims a delivery
 * that did not take place. Messages the school queues for its own people go through the delivery worker instead.
 */
export async function sendNotification(payload: NotificationPayload): Promise<NotificationResult> {
  if (payload.channel === "EMAIL" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.recipient)) {
    const sent = await sendEmail({ to: payload.recipient, subject: payload.title, text: payload.body });
    return { delivered: sent.delivered, provider: sent.provider, ...(sent.delivered ? {} : { reason: "No mail server is configured, so it was logged, not sent." }), payload };
  }
  if (payload.channel === "SMS" && msisdn(payload.recipient)) {
    const carrier = CARRIERS.SMS;
    if (!carrier.configured()) return { delivered: false, provider: "none", reason: "No SMS carrier is configured.", payload };
    const outcome = await carrier.send(payload.recipient, payload.title, payload.body);
    return outcome.ok ? { delivered: true, provider: carrier.provider, payload } : { delivered: false, provider: carrier.provider, reason: outcome.error, payload };
  }
  return { delivered: false, provider: "not-addressed", reason: payload.channel === "IN_APP" || payload.channel === "PUSH" ? "In-app and push messages are delivered through the notification log, not sent from here." : "The recipient is not an address a carrier can reach.", payload };
}
