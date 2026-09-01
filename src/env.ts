import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  TRUST_PROXY: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  GUEST_RECOVERY_WINDOW_DAYS: z.coerce.number().default(30),
  // Push notifications are best-effort and optional: unset until a Firebase
  // project exists, at which point sendPush() below starts working with no
  // other code changes needed.
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
});

export const env = schema.parse(process.env);
