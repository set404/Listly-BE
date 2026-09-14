import { prisma } from "../db";
import { ConflictError, NotFoundError } from "../lib/errors";
import { assertMembership } from "./group.service";
import { emitToGroup } from "../realtime";
import { sendPushToUsers } from "../lib/push";

async function getListOrThrow(listId: string) {
  const list = await prisma.list.findUnique({ where: { id: listId } });
  if (!list) throw new NotFoundError("List not found");
  return list;
}

// Wishlist groups always have exactly one list, created alongside the
// group itself (see wishlist.service.ts) — the frontend never exposes an
// "add another list" action for them, but this stops it being reachable
// via a direct API call too.
async function assertNotWishlistListMutation(groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (group?.type === "WISHLIST") {
    throw new ConflictError("A wishlist can only contain one list");
  }
}

export async function createList(userId: string, groupId: string, name: string) {
  await assertMembership(groupId, userId);
  await assertNotWishlistListMutation(groupId);
  const list = await prisma.list.create({ data: { groupId, name } });
  const result = { ...list, items: [] as const };
  emitToGroup(groupId, "list:created", { list: result });
  notifyMembersOfNewList(groupId, userId, name).catch(() => {});
  return result;
}

// Best-effort — a push failure (or Firebase not being configured yet)
// should never affect list creation itself.
async function notifyMembersOfNewList(groupId: string, creatorId: string, listName: string) {
  const [group, creator, otherMembers] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: creatorId }, select: { name: true } }),
    prisma.groupMember.findMany({ where: { groupId, userId: { not: creatorId } }, select: { userId: true } }),
  ]);
  if (!group || !creator || otherMembers.length === 0) return;
  await sendPushToUsers(
    otherMembers.map((m) => m.userId),
    {
      title: group.name,
      body: `${creator.name} created "${listName}"`,
      data: { type: "list:created", groupId },
    },
  );
}

export async function addItem(userId: string, listId: string, text: string, imageUrl?: string) {
  const list = await getListOrThrow(listId);
  await assertMembership(list.groupId, userId);
  const item = await prisma.$transaction(async (tx) => {
    const { _max } = await tx.listItem.aggregate({ where: { listId }, _max: { order: true } });
    return tx.listItem.create({
      data: { listId, text, imageUrl, createdById: userId, order: (_max.order ?? -1) + 1 },
    });
  });
  emitToGroup(list.groupId, "item:created", { listId, item });
  return item;
}

export async function updateItem(
  userId: string,
  listId: string,
  itemId: string,
  changes: { completed?: boolean; text?: string; imageUrl?: string },
) {
  const list = await getListOrThrow(listId);
  await assertMembership(list.groupId, userId);
  const item = await prisma.listItem.findFirst({ where: { id: itemId, listId } });
  if (!item) throw new NotFoundError("Item not found");

  const updated = await prisma.listItem.update({
    where: { id: itemId },
    data: {
      ...(changes.completed !== undefined && {
        completed: changes.completed,
        completedAt: changes.completed ? new Date() : null,
      }),
      ...(changes.text !== undefined && { text: changes.text }),
      ...(changes.imageUrl !== undefined && { imageUrl: changes.imageUrl }),
    },
  });
  emitToGroup(list.groupId, "item:updated", { listId, item: updated });
  return updated;
}

// itemIds may be any subset of the list's items (the client only reorders
// the active/incomplete ones — completed items keep sorting by completedAt
// and don't need an explicit order) — just no duplicates, and every id must
// actually belong to this list.
export async function reorderItems(userId: string, listId: string, itemIds: string[]) {
  const list = await getListOrThrow(listId);
  await assertMembership(list.groupId, userId);

  const existing = await prisma.listItem.findMany({ where: { listId }, select: { id: true } });
  const existingIds = new Set(existing.map((i) => i.id));
  const uniqueIds = new Set(itemIds);
  if (uniqueIds.size !== itemIds.length || itemIds.some((id) => !existingIds.has(id))) {
    throw new ConflictError("itemIds must be items belonging to this list, with no duplicates");
  }

  await prisma.$transaction(
    itemIds.map((id, order) => prisma.listItem.update({ where: { id }, data: { order } })),
  );
  emitToGroup(list.groupId, "items:reordered", { listId, itemIds });
}

export async function deleteItem(userId: string, listId: string, itemId: string) {
  const list = await getListOrThrow(listId);
  await assertMembership(list.groupId, userId);
  const item = await prisma.listItem.findFirst({ where: { id: itemId, listId } });
  if (!item) throw new NotFoundError("Item not found");
  await prisma.listItem.delete({ where: { id: itemId } });
  emitToGroup(list.groupId, "item:deleted", { listId, itemId });
}

// Any group member may delete a list (symmetric with creating one) — its
// items cascade-delete at the DB level (ListItem.list is onDelete: Cascade).
export async function deleteList(userId: string, groupId: string, listId: string) {
  await assertMembership(groupId, userId);
  await assertNotWishlistListMutation(groupId);
  const list = await prisma.list.findFirst({ where: { id: listId, groupId } });
  if (!list) throw new NotFoundError("List not found");
  await prisma.list.delete({ where: { id: listId } });
  emitToGroup(groupId, "list:deleted", { listId });
}
