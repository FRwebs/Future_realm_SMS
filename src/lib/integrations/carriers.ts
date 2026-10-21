import nodemailer from "nodemailer";

import { identityFooter } from "@/lib/platform-identity";

/**
 * The two carriers a school message can leave through.
 *
 * A carrier is "configured" only when its keys are present. With none present the queue stays a queue, and says so —
 * a row is never marked sent because nothing tried to send it.
 */

export type SendResult = { ok: true; ref?: string } | { ok: false; error: string; retry: boolean };

/** A WhatsApp message to someone who has not written to us in the last day has to be an approved template, named and filled in. */
export type WhatsAppTemplate = { name: string; language?: string; params: string[] };

export type Carrier = {
  channel: "SMS" | "EMAIL" | "WHATSAPP";
  provider: string;
  configured: () => boolean;
  send: (to: string, subject: string, body: string, options?: { openPixelUrl?: string; template?: WhatsAppTemplate }) => Promise<SendResult>;
};

const env = (key: string) => (process.env[key] ?? "").trim();

/** Nigerian numbers arrive as 0803…, 803… or +234803…; carriers want 234803… */
export function msisdn(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (/^0\d{10}$/.test(digits)) return `234${digits.slice(1)}`;
  if (/^234\d{10}$/.test(digits)) return digits;
  if (/^\d{10}$/.test(digits)) return `234${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

const termii: Carrier = {
  channel: "SMS",
  provider: "Termii",
  configured: () => Boolean(env("TERMII_API_KEY") && env("TERMII_SENDER_ID")),
  async send(to, _subject, body) {
    const number = msisdn(to);
    if (!number) return { ok: false, error: `"${to}" is not a phone number a carrier can reach.`, retry: false };
    try {
      const response = await fetch(`${env("TERMII_BASE_URL") || "https://api.ng.termii.com"}/api/sms/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: number, from: env("TERMII_SENDER_ID"), sms: body, type: "plain", channel: env("TERMII_CHANNEL") || "generic", api_key: env("TERMII_API_KEY") }),
        signal: AbortSignal.timeout(15_000),
      });
      const payload = (await response.json().catch(() => ({}))) as { message_id?: string; message?: string; code?: string };
      if (response.ok && payload.message_id) return { ok: true, ref: payload.message_id };
      // A 4xx is the carrier refusing this message; a 5xx is worth another try.
      return { ok: false, error: payload.message ?? `Termii answered ${response.status}`, retry: response.status >= 500 || response.status === 429 };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Termii could not be reached", retry: true };
    }
  },
};

/**
 * WhatsApp Business (Meta Cloud API). Configured when WHATSAPP_TOKEN and WHATSAPP_PHONE_ID are set. Messages go out as the
 * approved templates they have to be; the status of each one comes back through the webhook.
 */
const whatsapp: Carrier = {
  channel: "WHATSAPP",
  provider: "WhatsApp Business",
  configured: () => Boolean(env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_ID")),
  async send(to, _subject, _body, options) {
    const number = msisdn(to);
    if (!number) return { ok: false, error: `"${to}" is not a phone number WhatsApp can reach.`, retry: false };
    const template = options?.template;
    if (!template?.name) return { ok: false, error: "A WhatsApp message must be sent from a template Meta has approved.", retry: false };
    try {
      const response = await fetch(`https://graph.facebook.com/${env("WHATSAPP_API_VERSION") || "v21.0"}/${env("WHATSAPP_PHONE_ID")}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env("WHATSAPP_TOKEN")}` },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: number,
          type: "template",
          template: { name: template.name, language: { code: template.language || env("WHATSAPP_LANGUAGE") || "en" }, ...(template.params.length ? { components: [{ type: "body", parameters: template.params.map((text) => ({ type: "text", text })) }] } : {}) }
        }),
        signal: AbortSignal.timeout(15_000)
      });
      const payload = (await response.json().catch(() => ({}))) as { messages?: Array<{ id?: string }>; error?: { message?: string; code?: number } };
      if (response.ok && payload.messages?.[0]?.id) return { ok: true, ref: payload.messages[0].id };
      // 4xx: Meta refused this message (not opted in, template not approved, number not on WhatsApp). 5xx and rate limits are worth another try.
      return { ok: false, error: payload.error?.message ?? `WhatsApp answered ${response.status}`, retry: response.status >= 500 || response.status === 429 || payload.error?.code === 130429 };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "WhatsApp could not be reached", retry: true };
    }
  }
};

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
const smtp: Carrier = {
  channel: "EMAIL",
  provider: "SMTP",
  configured: () => Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASSWORD")),
  async send(to, subject, body, options) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: `"${to}" is not an email address.`, retry: false };
    try {
      transport ??= nodemailer.createTransport({ host: env("SMTP_HOST"), port: Number(env("SMTP_PORT") || 587), secure: Number(env("SMTP_PORT") || 587) === 465, auth: { user: env("SMTP_USER"), pass: env("SMTP_PASSWORD") } });
      const escaped = `${body}${identityFooter()}`.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      // The text part always goes; with a public address configured an HTML part carries a one-pixel image whose fetch records the open.
      const html = options?.openPixelUrl ? `<div style="white-space:pre-wrap;font-family:sans-serif;font-size:14px;line-height:1.5">${escaped}</div><img src="${options.openPixelUrl}" width="1" height="1" alt="" style="display:none" />` : undefined;
      const info = await transport.sendMail({ from: env("SMTP_FROM") || env("SMTP_USER"), to, subject, text: `${body}${identityFooter()}`, ...(html ? { html } : {}) });
      return { ok: true, ref: info.messageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : "The mail server could not be reached";
      const code = (error as { responseCode?: number }).responseCode;
      return { ok: false, error: message, retry: !code || code >= 500 || code === 421 || code === 450 };
    }
  },
};

export const CARRIERS: Record<string, Carrier> = { SMS: termii, EMAIL: smtp, WHATSAPP: whatsapp };
