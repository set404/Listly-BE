import { prisma } from "../db";
import { hashFingerprint } from "../lib/fingerprint";
import { issueTokenPair, publicUser } from "./auth.service";
import { env } from "../env";
import { NotFoundError } from "../lib/errors";

function recoveryWindowCutoff(): Date {
  return new Date(Date.now() - env.GUEST_RECOVERY_WINDOW_DAYS * 86_400_000);
}

export async function createGuest(name: string | undefined, fingerprint: string, ip: string) {
  const user = await prisma.user.create({
    data: { kind: "GUEST", name: name?.trim() || "Guest" },
  });
  await prisma.guestRecovery.create({
    data: { userId: user.id, fingerprintHash: hashFingerprint(fingerprint), lastIp: ip },
  });
  const tokens = await issueTokenPair(user.id, "GUEST");
  return { user: publicUser(user), tokens };
}

export async function checkRecovery(fingerprint: string, ip: string) {
  const match = await prisma.guestRecovery.findFirst({
    where: {
      fingerprintHash: hashFingerprint(fingerprint),
      lastIp: ip,
      lastSeenAt: { gte: recoveryWindowCutoff() },
    },
    include: { user: true },
    orderBy: { lastSeenAt: "desc" },
  });

  if (!match) return null;

  return {
    recoveryId: match.id,
    name: match.user.name,
    lastSeenAt: match.lastSeenAt,
  };
}

// Requires no auth — the recoveryId alone plus a fresh window re-check is
// the trust boundary here (the id isn't guessable, and it's re-validated
// against staleness so a stale link can't resurrect an old identity).
export async function confirmRecovery(recoveryId: string, ip: string) {
  const recovery = await prisma.guestRecovery.findFirst({
    where: { id: recoveryId, lastSeenAt: { gte: recoveryWindowCutoff() } },
    include: { user: true },
  });
  if (!recovery) throw new NotFoundError("Recovery session expired or not found");

  await prisma.guestRecovery.update({
    where: { id: recovery.id },
    data: { lastIp: ip, lastSeenAt: new Date() },
  });

  const tokens = await issueTokenPair(recovery.userId, "GUEST");
  return { user: publicUser(recovery.user), tokens };
}
