import { z } from "zod";

function normalizeUrl(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

const inferredAppUrl =
  normalizeUrl(process.env.APP_URL) ??
  normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
  normalizeUrl(process.env.VERCEL_URL) ??
  "http://localhost:3000";

const envSchema = z.object({
  APP_URL: z.string().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(16).default("local-development-secret"),
  DEMO_MODE: z.preprocess(
    (value) => value ?? "true",
    z.enum(["true", "false"]).transform((value) => value === "true")
  ),
  DEFAULT_SCHOOL_SLUG: z.string().default("greenfield-college"),
  PAYSTACK_PUBLIC_KEY: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  FLUTTERWAVE_PUBLIC_KEY: z.string().optional(),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_SECRET: z.string().optional(),
  REMITA_MERCHANT_ID: z.string().optional(),
  REMITA_SERVICE_TYPE_ID: z.string().optional(),
  REMITA_API_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ENDPOINT: z.string().optional()
});

export const env = envSchema.parse({
  APP_URL: inferredAppUrl,
  JWT_SECRET: process.env.JWT_SECRET,
  DEMO_MODE: process.env.DEMO_MODE,
  DEFAULT_SCHOOL_SLUG: process.env.DEFAULT_SCHOOL_SLUG,
  PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY,
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
  PAYSTACK_WEBHOOK_SECRET: process.env.PAYSTACK_WEBHOOK_SECRET,
  FLUTTERWAVE_PUBLIC_KEY: process.env.FLUTTERWAVE_PUBLIC_KEY,
  FLUTTERWAVE_SECRET_KEY: process.env.FLUTTERWAVE_SECRET_KEY,
  FLUTTERWAVE_WEBHOOK_SECRET: process.env.FLUTTERWAVE_WEBHOOK_SECRET,
  REMITA_MERCHANT_ID: process.env.REMITA_MERCHANT_ID,
  REMITA_SERVICE_TYPE_ID: process.env.REMITA_SERVICE_TYPE_ID,
  REMITA_API_KEY: process.env.REMITA_API_KEY,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_ENDPOINT: process.env.S3_ENDPOINT
});
