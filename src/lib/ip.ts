import type { Request } from "express";
import { env } from "../env";

// Returns the best-guess client IP. Only trusts X-Forwarded-For when
// TRUST_PROXY is enabled (i.e. we're actually behind a reverse proxy) —
// otherwise that header is client-supplied and trivially spoofable.
export function getClientIp(req: Request): string {
  if (env.TRUST_PROXY) {
    const forwarded = req.headers["x-forwarded-for"];
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (first) return first.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}
