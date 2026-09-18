import type { Request, Response } from "express";
import { z } from "zod";
import * as expenseGroupService from "../services/expenseGroups.service";
import * as groupService from "../services/group.service";
import { UnauthorizedError } from "../lib/errors";
import { currencyCodeSchema } from "../lib/validation";

const createExpenseGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  emoji: z.string().trim().min(1).max(8).default("💰"),
  defaultCurrency: currencyCodeSchema.default("USD"),
});

const updateExpenseGroupSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  emoji: z.string().trim().min(1).max(8).optional(),
  defaultCurrency: currencyCodeSchema.optional(),
});

const joinExpenseGroupSchema = z.object({
  inviteCode: z.string().trim().min(1),
});

const addExpenseSchema = z.object({
  description: z.string().trim().min(1).max(140),
  amount: z.number().positive().finite().max(999999999),
  currency: currencyCodeSchema.optional(),
  paidById: z.string().min(1),
  participantIds: z.array(z.string().min(1)).min(1),
});

const updateExpenseSchema = z
  .object({
    description: z.string().trim().min(1).max(140).optional(),
    amount: z.number().positive().finite().max(999999999).optional(),
    currency: currencyCodeSchema.optional(),
    paidById: z.string().min(1).optional(),
    participantIds: z.array(z.string().min(1)).min(1).optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "At least one field must be provided" },
  );

function uid(req: Request): string {
  if (!req.auth) throw new UnauthorizedError();
  return req.auth.userId;
}

export async function listExpenseGroupsHandler(req: Request, res: Response) {
  res.json(await expenseGroupService.listExpenseGroupsForUser(uid(req)));
}

export async function createExpenseGroupHandler(req: Request, res: Response) {
  const { name, emoji, defaultCurrency } = createExpenseGroupSchema.parse(req.body);
  res.status(201).json(await expenseGroupService.createExpenseGroup(uid(req), name, emoji, defaultCurrency));
}

export async function joinExpenseGroupHandler(req: Request, res: Response) {
  const { inviteCode } = joinExpenseGroupSchema.parse(req.body);
  res.status(201).json(await expenseGroupService.joinExpenseGroupByCode(uid(req), inviteCode));
}

export async function getExpenseGroupHandler(req: Request, res: Response) {
  res.json(await expenseGroupService.getExpenseGroupDetail(uid(req), req.params.id));
}

export async function updateExpenseGroupHandler(req: Request, res: Response) {
  const changes = updateExpenseGroupSchema.parse(req.body);
  res.json(await expenseGroupService.updateExpenseGroup(uid(req), req.params.id, changes));
}

export async function deleteExpenseGroupHandler(req: Request, res: Response) {
  await expenseGroupService.deleteExpenseGroup(req.params.id);
  res.status(204).end();
}

// Membership management is identical for every group type, so these just
// call straight through to group.service's already type-agnostic functions
// (same ones STANDARD groups use) instead of duplicating them.

export async function leaveExpenseGroupHandler(req: Request, res: Response) {
  await groupService.leaveGroup(uid(req), req.params.id);
  res.status(204).end();
}

export async function listExpenseGroupMembersHandler(req: Request, res: Response) {
  res.json(await groupService.listMembers(uid(req), req.params.id));
}

export async function removeExpenseGroupMemberHandler(req: Request, res: Response) {
  await groupService.removeMember(req.params.id, uid(req), req.params.userId);
  res.status(204).end();
}

export async function regenerateExpenseGroupInviteHandler(req: Request, res: Response) {
  res.json(await groupService.regenerateInvite(uid(req), req.params.id));
}

export async function addExpenseHandler(req: Request, res: Response) {
  const input = addExpenseSchema.parse(req.body);
  res.status(201).json(await expenseGroupService.addExpense(uid(req), req.params.id, input));
}

export async function updateExpenseHandler(req: Request, res: Response) {
  const changes = updateExpenseSchema.parse(req.body);
  res.json(await expenseGroupService.updateExpense(uid(req), req.params.id, req.params.expenseId, changes));
}

export async function deleteExpenseHandler(req: Request, res: Response) {
  await expenseGroupService.deleteExpense(uid(req), req.params.id, req.params.expenseId);
  res.status(204).end();
}
