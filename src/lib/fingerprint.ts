import crypto from "crypto";

export function hashFingerprint(rawFingerprint: string): string {
  return crypto.createHash("sha256").update(rawFingerprint.trim()).digest("hex");
}
