import { prisma } from "../db";
import { generateInviteCode } from "../lib/inviteCode";
import { generateShareToken } from "../lib/shareToken";
import { NotFoundError } from "../lib/errors";
import { assertMembership } from "./group.service";

const wishlistDetailInclude = {
  lists: { include: { items: true }, orderBy: { createdAt: "asc" as const } },
};

function serializeWishlist(group: {
  id: string;
  name: string;
  emoji: string;
  shareToken: string | null;
  lists: unknown[];
}) {
  return {
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    shareToken: group.shareToken,
    list: group.lists[0] ?? null,
  };
}

export async function createWishlist(userId: string, name: string, emoji: string) {
  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.group.create({
      data: {
        name,
        emoji,
        type: "WISHLIST",
        inviteCode: generateInviteCode(),
        shareToken: generateShareToken(),
        members: { create: { userId, role: "ADMIN" } },
      },
    });
    await tx.list.create({ data: { groupId: created.id, name } });
    return tx.group.findUniqueOrThrow({ where: { id: created.id }, include: wishlistDetailInclude });
  });

  return serializeWishlist(group);
}

export async function listWishlistsForUser(userId: string) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId, group: { type: "WISHLIST" } },
    include: { group: { include: wishlistDetailInclude } },
  });
  return memberships.map(({ group }) => serializeWishlist(group));
}

async function assertWishlistMembership(groupId: string, userId: string) {
  const membership = await assertMembership(groupId, userId);
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.type !== "WISHLIST") throw new NotFoundError("Wishlist not found");
  return { membership, group };
}

export async function getWishlistDetail(userId: string, groupId: string) {
  await assertWishlistMembership(groupId, userId);
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    include: wishlistDetailInclude,
  });
  return serializeWishlist(group);
}

export async function deleteWishlist(userId: string, groupId: string) {
  await assertWishlistMembership(groupId, userId);
  await prisma.group.delete({ where: { id: groupId } });
}

export async function regenerateShareLink(userId: string, groupId: string) {
  await assertWishlistMembership(groupId, userId);
  const group = await prisma.group.update({
    where: { id: groupId },
    data: { shareToken: generateShareToken() },
  });
  return { shareToken: group.shareToken };
}

// No auth — the share token itself is the trust boundary, same pattern as
// GuestRecovery.confirmRecovery. Deliberately omits inviteCode/shareToken/
// members from the response so a public viewer can't see or reuse them.
export async function getPublicWishlist(token: string) {
  const group = await prisma.group.findFirst({
    where: { shareToken: token, type: "WISHLIST" },
    include: wishlistDetailInclude,
  });
  if (!group) throw new NotFoundError("This wishlist link is no longer valid");
  return { name: group.name, emoji: group.emoji, list: group.lists[0] ?? null };
}
