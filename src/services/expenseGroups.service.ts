import { prisma } from "../db";
import { generateInviteCode } from "../lib/inviteCode";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors";
import { assertMembership, serializeMember, type MemberWithUser } from "./group.service";
import { emitToGroup } from "../realtime";
import { sendPushToUsers } from "../lib/push";
import type { Expense, ExpenseSplit, Settlement } from "@prisma/client";

const expenseGroupDetailInclude = {
  members: { include: { user: true } },
  expenses: {
    include: { splits: true },
    orderBy: { createdAt: "desc" as const },
  },
  settlements: {
    orderBy: { createdAt: "desc" as const },
  },
};

type ExpenseWithSplits = Expense & { splits: ExpenseSplit[] };
type ExpenseGroupRow = {
  id: string;
  name: string;
  emoji: string;
  inviteCode: string;
  defaultCurrency: string;
  members: MemberWithUser[];
  expenses: ExpenseWithSplits[];
  settlements: Settlement[];
};

function serializeExpense(e: ExpenseWithSplits) {
  return {
    id: e.id,
    description: e.description,
    amount: e.amount,
    currency: e.currency,
    paidById: e.paidById,
    createdAt: e.createdAt,
    createdById: e.createdById,
    splits: e.splits.map((s) => ({ userId: s.userId, amount: s.amount })),
  };
}

function serializeSettlement(s: Settlement) {
  return {
    id: s.id,
    fromUserId: s.fromUserId,
    toUserId: s.toUserId,
    amount: s.amount,
    currency: s.currency,
    createdAt: s.createdAt,
    createdById: s.createdById,
  };
}

function serializeExpenseGroup(group: ExpenseGroupRow, myRole: "ADMIN" | "MEMBER") {
  return {
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    inviteCode: group.inviteCode,
    defaultCurrency: group.defaultCurrency,
    myRole,
    members: group.members.map(serializeMember),
    expenses: group.expenses.map(serializeExpense),
    settlements: group.settlements.map(serializeSettlement),
  };
}

// Expense groups are Group rows too (type: EXPENSE) — mirrors
// group.service.ts's assertStandardGroup, keeping this resource from being
// reached through the wrong shape (STANDARD's /groups/* or WISHLIST's
// /wishlists/*) and vice versa.
async function assertExpenseGroup(groupId: string) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.type !== "EXPENSE") throw new NotFoundError("Expense group not found");
}

type BalanceSummary =
  | { kind: "owed"; amount: number; currency: string }
  | { kind: "owes"; amount: number; currency: string }
  | { kind: "settled" }
  | null;

// Mirrors computeExpenseBalances' per-currency net (paid + settlements sent,
// minus split shares + settlements received), but only for one member and
// without loading every other member's rows — the list endpoint only needs
// "am I owed, do I owe, or am I settled", not the full ledger.
async function computeMyBalanceSummary(groupId: string, userId: string): Promise<BalanceSummary> {
  const [paidExpenses, mySplits, sent, received] = await Promise.all([
    prisma.expense.findMany({ where: { groupId, paidById: userId }, select: { amount: true, currency: true } }),
    prisma.expenseSplit.findMany({
      where: { userId, expense: { groupId } },
      select: { amount: true, expense: { select: { currency: true } } },
    }),
    prisma.settlement.findMany({ where: { groupId, fromUserId: userId }, select: { amount: true, currency: true } }),
    prisma.settlement.findMany({ where: { groupId, toUserId: userId }, select: { amount: true, currency: true } }),
  ]);

  const balance: Record<string, number> = {};
  for (const e of paidExpenses) balance[e.currency] = (balance[e.currency] ?? 0) + e.amount;
  for (const s of mySplits) balance[s.expense.currency] = (balance[s.expense.currency] ?? 0) - s.amount;
  for (const s of sent) balance[s.currency] = (balance[s.currency] ?? 0) + s.amount;
  for (const s of received) balance[s.currency] = (balance[s.currency] ?? 0) - s.amount;

  const entry = Object.entries(balance).find(([, amt]) => Math.abs(amt) > 0.005);
  if (entry) {
    const [currency, amt] = entry;
    return amt > 0 ? { kind: "owed", amount: amt, currency } : { kind: "owes", amount: -amt, currency };
  }
  return paidExpenses.length > 0 || mySplits.length > 0 ? { kind: "settled" } : null;
}

// Card-level summary for the expense groups tab — the viewer's own net
// balance only, not every expense/split/settlement for every member (see
// getExpenseGroupDetail below for the full ledger, fetched once a specific
// group is actually opened).
export async function listExpenseGroupsForUser(userId: string) {
  const memberships = await prisma.groupMember.findMany({
    where: { userId, group: { type: "EXPENSE" } },
    include: { group: { include: { members: { include: { user: true } } } } },
  });
  return Promise.all(memberships.map(async ({ group, role }) => ({
    id: group.id,
    name: group.name,
    emoji: group.emoji,
    inviteCode: group.inviteCode,
    defaultCurrency: group.defaultCurrency,
    myRole: role,
    members: group.members.map(serializeMember),
    balanceSummary: await computeMyBalanceSummary(group.id, userId),
  })));
}

export async function createExpenseGroup(
  userId: string,
  name: string,
  emoji: string,
  defaultCurrency: string,
) {
  const group = await prisma.group.create({
    data: {
      name,
      emoji,
      defaultCurrency,
      type: "EXPENSE",
      inviteCode: generateInviteCode(),
      members: { create: { userId, role: "ADMIN" } },
    },
    include: expenseGroupDetailInclude,
  });
  return serializeExpenseGroup(group, "ADMIN");
}

export async function joinExpenseGroupByCode(userId: string, inviteCode: string) {
  const group = await prisma.group.findFirst({
    where: { inviteCode: inviteCode.trim().toUpperCase(), type: "EXPENSE" },
    include: expenseGroupDetailInclude,
  });
  if (!group) throw new NotFoundError("Invalid invite code");

  const alreadyMember = group.members.some((m) => m.userId === userId);
  if (alreadyMember) throw new ConflictError("You're already in this group");

  await prisma.groupMember.create({ data: { groupId: group.id, userId, role: "MEMBER" } });

  const refreshed = await prisma.group.findUniqueOrThrow({
    where: { id: group.id },
    include: expenseGroupDetailInclude,
  });
  return serializeExpenseGroup(refreshed, "MEMBER");
}

export async function getExpenseGroupDetail(userId: string, groupId: string) {
  const membership = await assertMembership(groupId, userId);
  await assertExpenseGroup(groupId);
  const group = await prisma.group.findUniqueOrThrow({
    where: { id: groupId },
    include: expenseGroupDetailInclude,
  });
  return serializeExpenseGroup(group, membership.role);
}

export async function updateExpenseGroup(
  userId: string,
  groupId: string,
  changes: { name?: string; emoji?: string; defaultCurrency?: string },
) {
  const membership = await assertMembership(groupId, userId);
  await assertExpenseGroup(groupId);
  const group = await prisma.group.update({
    where: { id: groupId },
    data: {
      ...(changes.name !== undefined && { name: changes.name }),
      ...(changes.emoji !== undefined && { emoji: changes.emoji }),
      ...(changes.defaultCurrency !== undefined && { defaultCurrency: changes.defaultCurrency }),
    },
    include: expenseGroupDetailInclude,
  });
  return serializeExpenseGroup(group, membership.role);
}

// Only reachable via the requireGroupAdmin middleware (same as
// group.service.deleteGroup). Cascades to its expenses/splits at the DB level.
export async function deleteExpenseGroup(groupId: string) {
  await assertExpenseGroup(groupId);
  await prisma.group.delete({ where: { id: groupId } });
}

// Divides `amount` evenly across `participantIds`, in cents, with any
// leftover cent from the division absorbed into the payer's own share (or
// the last participant if the payer isn't one of them) — so shares always
// sum exactly back to `amount` regardless of rounding, and a group that
// rotates who pays for identical recurring expenses still nets to zero
// instead of one fixed participant quietly absorbing every odd cent.
function splitEvenly(amount: number, participantIds: string[], paidById: string): number[] {
  const totalCents = Math.round(amount * 100);
  const baseShare = Math.floor(totalCents / participantIds.length);
  const remainder = totalCents - baseShare * participantIds.length;
  const remainderIndex = participantIds.includes(paidById)
    ? participantIds.indexOf(paidById)
    : participantIds.length - 1;
  return participantIds.map((_, i) => (i === remainderIndex ? baseShare + remainder : baseShare) / 100);
}

export async function addExpense(
  userId: string,
  groupId: string,
  input: { description: string; amount: number; currency?: string; paidById: string; participantIds: string[] },
) {
  await assertMembership(groupId, userId);
  const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
  if (group.type !== "EXPENSE") throw new NotFoundError("Expense group not found");

  const uniqueParticipantIds = [...new Set(input.participantIds)];
  if (uniqueParticipantIds.length === 0) {
    throw new ValidationError("An expense must be split between at least one member");
  }
  const members = await prisma.groupMember.findMany({ where: { groupId } });
  const memberIds = new Set(members.map((m) => m.userId));
  if (!memberIds.has(input.paidById) || uniqueParticipantIds.some((id) => !memberIds.has(id))) {
    throw new ValidationError("paidById and participantIds must all be members of this group");
  }

  const shares = splitEvenly(input.amount, uniqueParticipantIds, input.paidById);
  const currency = input.currency ?? group.defaultCurrency;

  const expense = await prisma.expense.create({
    data: {
      groupId,
      description: input.description,
      amount: input.amount,
      currency,
      paidById: input.paidById,
      createdById: userId,
      splits: {
        create: uniqueParticipantIds.map((participantId, i) => ({ userId: participantId, amount: shares[i] })),
      },
    },
    include: { splits: true },
  });
  const result = serializeExpense(expense);
  emitToGroup(groupId, "expense:created", { groupId, expense: result });
  notifySharersOfNewExpense(groupId, userId, uniqueParticipantIds, input.description).catch(() => {});
  return result;
}

// Best-effort — a push failure (or Firebase not being configured yet)
// should never affect expense creation itself. Only participants the
// expense is actually split between ("sharers") are notified, not the
// whole group, and never the person who added it.
async function notifySharersOfNewExpense(
  groupId: string,
  creatorId: string,
  participantIds: string[],
  description: string,
) {
  const sharerIds = participantIds.filter((id) => id !== creatorId);
  if (sharerIds.length === 0) return;
  const [group, creator] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: creatorId }, select: { name: true } }),
  ]);
  if (!group || !creator) return;
  await sendPushToUsers(sharerIds, {
    title: group.name,
    body: `${creator.name} added an expense: "${description}"`,
    data: { type: "expense:created", groupId },
  });
}

// Any group member may edit an expense (same trust model as delete, below).
// Amount/currency/paidById always get re-written (falling back to the
// existing value when not part of `changes`) because a changed amount or
// participant list means the splits need recomputing regardless of which
// field the caller actually touched.
export async function updateExpense(
  userId: string,
  groupId: string,
  expenseId: string,
  changes: {
    description?: string;
    amount?: number;
    currency?: string;
    paidById?: string;
    participantIds?: string[];
  },
) {
  await assertMembership(groupId, userId);
  const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
  if (group.type !== "EXPENSE") throw new NotFoundError("Expense group not found");

  const existing = await prisma.expense.findFirst({ where: { id: expenseId, groupId }, include: { splits: true } });
  if (!existing) throw new NotFoundError("Expense not found");

  const paidById = changes.paidById ?? existing.paidById;
  const amount = changes.amount ?? existing.amount;
  const currency = changes.currency ?? existing.currency;
  const participantIds = changes.participantIds ?? existing.splits.map((s) => s.userId);

  const uniqueParticipantIds = [...new Set(participantIds)];
  if (uniqueParticipantIds.length === 0) {
    throw new ValidationError("An expense must be split between at least one member");
  }
  const members = await prisma.groupMember.findMany({ where: { groupId } });
  const memberIds = new Set(members.map((m) => m.userId));
  if (!memberIds.has(paidById) || uniqueParticipantIds.some((id) => !memberIds.has(id))) {
    throw new ValidationError("paidById and participantIds must all be members of this group");
  }

  const shares = splitEvenly(amount, uniqueParticipantIds, paidById);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.expenseSplit.deleteMany({ where: { expenseId } });
    return tx.expense.update({
      where: { id: expenseId },
      data: {
        ...(changes.description !== undefined && { description: changes.description }),
        amount,
        currency,
        paidById,
        splits: { create: uniqueParticipantIds.map((participantId, i) => ({ userId: participantId, amount: shares[i] })) },
      },
      include: { splits: true },
    });
  });

  const result = serializeExpense(updated);
  emitToGroup(groupId, "expense:updated", { groupId, expense: result, updatedById: userId });
  return result;
}

// Any group member may delete an expense (matches the trust model already
// used for list items/lists/bonus cards elsewhere in the app).
export async function deleteExpense(userId: string, groupId: string, expenseId: string) {
  await assertMembership(groupId, userId);
  const expense = await prisma.expense.findFirst({ where: { id: expenseId, groupId } });
  if (!expense) throw new NotFoundError("Expense not found");
  await prisma.expense.delete({ where: { id: expenseId } });
  emitToGroup(groupId, "expense:deleted", { groupId, expenseId, deletedById: userId });
}

// Records a real-world payment (cash, bank transfer, etc.) from one member to
// another — not tied to a specific expense, just a standalone credit that
// shifts both members' overall balance, the same way sendings a bill payment
// would. Both members just need to belong to the group; the recorder doesn't
// have to be either of them (mirrors addExpense letting paidById be anyone).
export async function addSettlement(
  userId: string,
  groupId: string,
  input: { fromUserId: string; toUserId: string; amount: number; currency?: string },
) {
  await assertMembership(groupId, userId);
  const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
  if (group.type !== "EXPENSE") throw new NotFoundError("Expense group not found");

  if (input.fromUserId === input.toUserId) {
    throw new ValidationError("A settlement must be between two different members");
  }
  const members = await prisma.groupMember.findMany({ where: { groupId } });
  const memberIds = new Set(members.map((m) => m.userId));
  if (!memberIds.has(input.fromUserId) || !memberIds.has(input.toUserId)) {
    throw new ValidationError("fromUserId and toUserId must both be members of this group");
  }

  const settlement = await prisma.settlement.create({
    data: {
      groupId,
      fromUserId: input.fromUserId,
      toUserId: input.toUserId,
      amount: input.amount,
      currency: input.currency ?? group.defaultCurrency,
      createdById: userId,
    },
  });
  const result = serializeSettlement(settlement);
  emitToGroup(groupId, "settlement:created", { groupId, settlement: result });
  notifyOfSettlement(groupId, userId, input.fromUserId, input.toUserId, result.amount, result.currency).catch(() => {});
  return result;
}

// Best-effort — mirrors notifySharersOfNewExpense. Notifies whichever side
// of the settlement isn't the person recording it, since that's the one who
// wouldn't otherwise know a payment was logged on their behalf.
async function notifyOfSettlement(
  groupId: string,
  recorderId: string,
  fromUserId: string,
  toUserId: string,
  amount: number,
  currency: string,
) {
  const notifyUserId = recorderId === fromUserId ? toUserId : recorderId === toUserId ? fromUserId : null;
  if (!notifyUserId) return;
  const [group, fromUser, toUser] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: fromUserId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: toUserId }, select: { name: true } }),
  ]);
  if (!group || !fromUser || !toUser) return;
  await sendPushToUsers([notifyUserId], {
    title: group.name,
    body: `${fromUser.name} paid ${toUser.name} ${amount} ${currency}`,
    data: { type: "settlement:created", groupId },
  });
}

// Any group member may delete a settlement (matches the trust model already
// used for expenses).
export async function deleteSettlement(userId: string, groupId: string, settlementId: string) {
  await assertMembership(groupId, userId);
  const settlement = await prisma.settlement.findFirst({ where: { id: settlementId, groupId } });
  if (!settlement) throw new NotFoundError("Settlement not found");
  await prisma.settlement.delete({ where: { id: settlementId } });
  emitToGroup(groupId, "settlement:deleted", { groupId, settlementId, deletedById: userId });
}
