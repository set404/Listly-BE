import { prisma } from "../db";
import { NotFoundError } from "../lib/errors";
import { assertMembership } from "./group.service";

async function getListOrThrow(listId: string) {
  const list = await prisma.list.findUnique({ where: { id: listId } });
  if (!list) throw new NotFoundError("List not found");
  return list;
}

export async function createList(userId: string, groupId: string, name: string) {
  await assertMembership(groupId, userId);
  const list = await prisma.list.create({ data: { groupId, name } });
  return { ...list, items: [] as const };
}

export async function addItem(userId: string, listId: string, text: string) {
  const list = await getListOrThrow(listId);
  await assertMembership(list.groupId, userId);
  return prisma.listItem.create({
    data: { listId, text, createdById: userId },
  });
}

export async function updateItem(
  userId: string,
  listId: string,
  itemId: string,
  changes: { completed?: boolean; text?: string },
) {
  const list = await getListOrThrow(listId);
  await assertMembership(list.groupId, userId);
  const item = await prisma.listItem.findFirst({ where: { id: itemId, listId } });
  if (!item) throw new NotFoundError("Item not found");

  return prisma.listItem.update({
    where: { id: itemId },
    data: {
      ...(changes.completed !== undefined && {
        completed: changes.completed,
        completedAt: changes.completed ? new Date() : null,
      }),
      ...(changes.text !== undefined && { text: changes.text }),
    },
  });
}
