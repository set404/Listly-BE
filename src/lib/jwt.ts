import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../env";

export interface AccessTokenPayload {
  sub: string;
  kind: "REGISTERED" | "GUEST";
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload & jwt.JwtPayload;
}

// Opaque refresh tokens: a random string is given to the client, only its
// sha256 hash is ever persisted, so a leaked DB row can't be replayed.
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

export function hashRefreshToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function refreshTokenExpiryDate(): Date {
  const ttl = env.REFRESH_TOKEN_TTL;
  const match = /^(\d+)([smhd])$/.exec(ttl);
  const amount = match ? Number(match[1]) : 7;
  const unit = match ? match[2] : "d";
  const unitMs: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return new Date(Date.now() + amount * (unitMs[unit] ?? unitMs.d));
}
