import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.string().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(16).default("local-development-secret"),
  DEMO_MODE: z.preprocess(
    (value) => value ?? "true",
    z.enum(["true", "false"]).transform((value) => value === "true")
  ),
  DEFAULT_SCHOOL_SLUG: z.string().default("greenfield-college"),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ENDPOINT: z.string().optional()
});

export const env = envSchema.parse({
  APP_URL: process.env.APP_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  DEMO_MODE: process.env.DEMO_MODE,
  DEFAULT_SCHOOL_SLUG: process.env.DEFAULT_SCHOOL_SLUG,
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
  FLUTTERWAVE_SECRET_KEY: process.env.FLUTTERWAVE_SECRET_KEY,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_ENDPOINT: process.env.S3_ENDPOINT
});
