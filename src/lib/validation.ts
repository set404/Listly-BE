import { z } from "zod";

// Images travel as base64 data URLs; 2.5M chars (~1.8MB decoded) comfortably
// fits what the client sends after resizing/compressing, while still
// blocking arbitrarily large payloads.
export const imageUrlSchema = z
  .string()
  .max(2_500_000)
  .refine((v) => /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v), "Invalid image data");
