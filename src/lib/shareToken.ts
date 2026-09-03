import { randomBytes } from "crypto";

// Unlike the invite code (short, typed by hand), this is embedded in a URL
// and is the sole gate protecting a wishlist's read-only public view, so it
// needs real entropy rather than a small human-friendly alphabet.
export function generateShareToken(): string {
  return randomBytes(18).toString("base64url");
}
