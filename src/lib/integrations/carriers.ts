import nodemailer from "nodemailer";

/**
 * The two carriers a school message can leave through.
 *
 * A carrier is "configured" only when its keys are present. With none present the queue stays a queue, and says so —
 * a row is never marked sent because nothing tried to send it.
 */

export type SendResult = { ok: true; ref?: string } | { ok: false; error: string; retry: boolean };

export type Carrier = {
  channel: "SMS" | "EMAIL";
  provider: string;
  configured: () => boolean;
  send: (to: string, subject: string, body: string) => Promise<SendResult>;
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

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
const smtp: Carrier = {
  channel: "EMAIL",
  provider: "SMTP",
  configured: () => Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASSWORD")),
  async send(to, subject, body) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: `"${to}" is not an email address.`, retry: false };
    try {
      transport ??= nodemailer.createTransport({ host: env("SMTP_HOST"), port: Number(env("SMTP_PORT") || 587), secure: Number(env("SMTP_PORT") || 587) === 465, auth: { user: env("SMTP_USER"), pass: env("SMTP_PASSWORD") } });
      const info = await transport.sendMail({ from: env("SMTP_FROM") || env("SMTP_USER"), to, subject, text: body });
      return { ok: true, ref: info.messageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : "The mail server could not be reached";
      const code = (error as { responseCode?: number }).responseCode;
      return { ok: false, error: message, retry: !code || code >= 500 || code === 421 || code === 450 };
    }
  },
};

export const CARRIERS: Record<string, Carrier> = { SMS: termii, EMAIL: smtp };
