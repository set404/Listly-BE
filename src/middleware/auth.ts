import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt";
import { UnauthorizedError } from "../lib/errors";
import { prisma } from "../db";
import { getClientIp } from "../lib/ip";

// Verifies the bearer JWT and attaches req.auth. Works identically for
// registered and guest users — both are User rows with the same token
// shape, so downstream handlers don't need to branch on `kind` except
// where admin/ownership checks matter.
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    next(new UnauthorizedError("Missing access token"));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.auth = { userId: payload.sub, kind: payload.kind };
  } catch {
    next(new UnauthorizedError("Invalid or expired access token"));
    return;
  }

  if (req.auth.kind === "GUEST") {
    // Keep the recovery window sliding for active guests. Best-effort —
    // never blocks or fails the request.
    const ip = getClientIp(req);
    prisma.guestRecovery
      .updateMany({ where: { userId: req.auth.userId }, data: { lastIp: ip, lastSeenAt: new Date() } })
      .catch(() => {});
  }

  next();
}
