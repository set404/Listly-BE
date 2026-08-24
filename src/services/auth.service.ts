import { prisma } from "../db";
import { hashPassword, comparePassword } from "../lib/password";
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiryDate,
} from "../lib/jwt";
import { ConflictError, UnauthorizedError } from "../lib/errors";
import type { User } from "@prisma/client";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function issueTokenPair(userId: string, kind: "REGISTERED" | "GUEST"): Promise<TokenPair> {
  const accessToken = signAccessToken({ sub: userId, kind });
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiryDate(),
    },
  });
  return { accessToken, refreshToken };
}

export function publicUser(user: User) {
  return {
    id: user.id,
    kind: user.kind,
    email: user.email,
    name: user.name,
    avatarColor: user.avatarColor,
  };
}

export async function register(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ConflictError("An account with this email already exists");

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { kind: "REGISTERED", email, passwordHash, name },
  });
  const tokens = await issueTokenPair(user.id, "REGISTERED");
  return { user: publicUser(user), tokens };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) throw new UnauthorizedError("Invalid email or password");

  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) throw new UnauthorizedError("Invalid email or password");

  const tokens = await issueTokenPair(user.id, "REGISTERED");
  return { user: publicUser(user), tokens };
}

export async function refresh(rawRefreshToken: string) {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  const tokens = await issueTokenPair(stored.userId, stored.user.kind);
  return { user: publicUser(stored.user), tokens };
}

export async function logout(rawRefreshToken: string) {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
