import { z } from "zod";

// Images travel as base64 data URLs; 2.5M chars (~1.8MB decoded) comfortably
// fits what the client sends after resizing/compressing, while still
// blocking arbitrarily large payloads.
export const imageUrlSchema = z
  .string()
  .max(2_500_000)
  .refine((v) => /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v), "Invalid image data");

// Keep in sync with Listly-FE's src/app/lib/currencies.ts — there's no
// shared package between the two apps, so this list is duplicated.
export const CURRENCY_CODES = ["USD", "EUR", "AMD"] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];
export const currencyCodeSchema = z.enum(CURRENCY_CODES);
