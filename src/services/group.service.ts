import { prisma } from "../db";
import { generateInviteCode } from "../lib/inviteCode";
import { ConflictError, ForbiddenError, NotFoundError } from "../lib/errors";
import type { GroupMember, User } from "@prisma/client";

type MemberWithUser = GroupMember & { user: User };

const groupDetailInclude = {
  lists: { include: { items: true }, orderBy: { createdAt: "asc" as const } },
  bonusCards: { orderBy: { createdAt: "asc" as const } },
};

function serializeMember(m: MemberWithUser) {
  return {
    id: m.user.id,
    name: m.user.name,
    color: m.user.avatarColor,
    role: m.role,
  };
}

export async function assertMembership(groupId: string, userId: string): Promise<GroupMember> {
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!membership) throw new NotFoundError("Group not found");
  return membership;
}

// Wishlists are Group rows too (type: WISHLIST) — the /groups/* endpoints
// are for STANDARD groups only, so a wishlist can't be renamed, joined, or
// fetched through the wrong shape and fall out of sync with its dedicated
// /wishlists/* handling.
async function assertStandardGroup(groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.type !== "STANDARD") throw new NotFoundError("Group not found");
}

export async function listGroupsForUser(userId: string) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId, group: { type: "STANDARD" } },
    include: {
      group: {
        include: {
          members: { include: { user: true } },
          ...groupDetailInclude,
        },
      },
    },
  });

  return memberships.map(({ group, role }) => ({
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    inviteCode: group.inviteCode,
    bonusCards: group.bonusCards,
    myRole: role,
    members: group.members.map(serializeMember),
    lists: group.lists,
  }));
}

export async function createGroup(userId: string, name: string, emoji: string) {
  const group = await prisma.group.create({
    data: {
      name,
      emoji,
      inviteCode: generateInviteCode(),
      members: { create: { userId, role: "ADMIN" } },
    },
    include: { members: { include: { user: true } }, ...groupDetailInclude },
  });

  return {
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    inviteCode: group.inviteCode,
    bonusCards: group.bonusCards,
    myRole: "ADMIN" as const,
    members: group.members.map(serializeMember),
    lists: group.lists,
  };
}

export async function updateGroup(
  userId: string,
  groupId: string,
  changes: { name?: string; emoji?: string },
) {
  const membership = await assertMembership(groupId, userId);
  await assertStandardGroup(groupId);
  const group = await prisma.group.update({
    where: { id: groupId },
    data: {
      ...(changes.name !== undefined && { name: changes.name }),
      ...(changes.emoji !== undefined && { emoji: changes.emoji }),
    },
    include: { members: { include: { user: true } }, ...groupDetailInclude },
  });

  return {
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    inviteCode: group.inviteCode,
    bonusCards: group.bonusCards,
    myRole: membership.role,
    members: group.members.map(serializeMember),
    lists: group.lists,
  };
}

export async function joinGroupByCode(userId: string, inviteCode: string) {
  const group = await prisma.group.findFirst({
    where: { inviteCode: inviteCode.trim().toUpperCase(), type: "STANDARD" },
    include: { members: { include: { user: true } }, ...groupDetailInclude },
  });
  if (!group) throw new NotFoundError("Invalid invite code");

  const alreadyMember = group.members.some((m) => m.userId === userId);
  if (alreadyMember) throw new ConflictError("You're already in this group");

  await prisma.groupMember.create({ data: { groupId: group.id, userId, role: "MEMBER" } });

  const refreshed = await prisma.group.findUniqueOrThrow({
    where: { id: group.id },
    include: { members: { include: { user: true } }, ...groupDetailInclude },
  });

  return {
    id: refreshed.id,
    name: refreshed.name,
    emoji: refreshed.emoji,
    inviteCode: refreshed.inviteCode,
    bonusCards: refreshed.bonusCards,
    myRole: "MEMBER" as const,
    members: refreshed.members.map(serializeMember),
    lists: refreshed.lists,
  };
}

export async function getGroupDetail(userId: string, groupId: string) {
  const membership = await assertMembership(groupId, userId);
  await assertStandardGroup(groupId);
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    include: { members: { include: { user: true } }, ...groupDetailInclude },
  });

  return {
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    inviteCode: group.inviteCode,
    bonusCards: group.bonusCards,
    myRole: membership.role,
    members: group.members.map(serializeMember),
    lists: group.lists,
  };
}

export async function listMembers(userId: string, groupId: string) {
  await assertMembership(groupId, userId);
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true },
    orderBy: { joinedAt: "asc" },
  });
  return members.map(serializeMember);
}

// Only reachable via the requireGroupAdmin middleware, but re-checks the
// target exists and isn't the acting admin removing themselves (that's
// what /leave is for).
export async function removeMember(groupId: string, requestingUserId: string, targetUserId: string) {
  if (targetUserId === requestingUserId) {
    throw new ForbiddenError("Use \"leave group\" to remove yourself");
  }
  const target = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: targetUserId } },
  });
  if (!target) throw new NotFoundError("Member not found in this group");

  await prisma.groupMember.delete({ where: { id: target.id } });
}

export async function addBonusCard(userId: string, groupId: string, name: string, imageUrl: string) {
  await assertMembership(groupId, userId);
  return prisma.bonusCard.create({ data: { groupId, name, imageUrl } });
}

export async function deleteBonusCard(userId: string, groupId: string, cardId: string) {
  await assertMembership(groupId, userId);
  const card = await prisma.bonusCard.findFirst({ where: { id: cardId, groupId } });
  if (!card) throw new NotFoundError("Bonus card not found");
  await prisma.bonusCard.delete({ where: { id: cardId } });
}

export async function regenerateInvite(userId: string, groupId: string) {
  await assertMembership(groupId, userId);
  const group = await prisma.group.update({
    where: { id: groupId },
    data: { inviteCode: generateInviteCode() },
  });
  return { inviteCode: group.inviteCode };
}

// If the sole admin leaves a group with other members remaining, the
// earliest-joined remaining member is auto-promoted — there's no
// transfer-admin flow, so this avoids leaving the group adminless.
export async function leaveGroup(userId: string, groupId: string) {
  const membership = await assertMembership(groupId, userId);

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.delete({ where: { id: membership.id } });

    if (membership.role === "ADMIN") {
      const remaining = await tx.groupMember.findMany({
        where: { groupId },
        orderBy: { joinedAt: "asc" },
        take: 1,
      });
      if (remaining.length > 0) {
        await tx.groupMember.update({ where: { id: remaining[0].id }, data: { role: "ADMIN" } });
      } else {
        await tx.group.delete({ where: { id: groupId } });
      }
    }
  });
}
