import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";

import { identityFooter, platformIdentity } from "@/lib/platform-identity";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let cachedTransporter: Transporter | null | undefined;

function buildTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!host || !port) {
    return null;
  }

  const options: SMTPTransport.Options = {
    host,
    port: Number(port),
    secure: Number(port) === 465,
    auth: user && password ? { user, pass: password } : undefined
  };

  return nodemailer.createTransport(options);
}

function getTransporter(): Transporter | null {
  if (cachedTransporter === undefined) {
    cachedTransporter = buildTransporter();
  }
  return cachedTransporter;
}

export async function sendEmail(input: SendEmailInput) {
  const transporter = getTransporter();
  const address = (process.env.SMTP_FROM ?? "").match(/<([^>]+)>/)?.[1] ?? (process.env.SMTP_FROM || "noreply@futurerealm.local");
  const from = `${platformIdentity().platformName} <${address}>`;
  const text = `${input.text}${identityFooter()}`;

  if (!transporter) {
    console.warn(
      `[mailer] SMTP is not configured (set SMTP_HOST/SMTP_PORT in .env) — email to ${input.to} was not sent. Subject: "${input.subject}"`
    );
    console.warn(`[mailer] Body:\n${input.text}`);
    return { delivered: false, provider: "console-fallback" as const };
  }

  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text,
    html: input.html
  });

  return { delivered: true, provider: "smtp" as const };
}
