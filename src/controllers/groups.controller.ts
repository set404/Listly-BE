import type { Request, Response } from "express";
import { z } from "zod";
import * as groupService from "../services/group.service";
import * as listService from "../services/list.service";
import { UnauthorizedError } from "../lib/errors";
import { imageUrlSchema } from "../lib/validation";

const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  emoji: z.string().trim().min(1).max(8).default("📋"),
});

const joinGroupSchema = z.object({
  inviteCode: z.string().trim().min(1),
});

const createListSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const addBonusCardSchema = z.object({
  name: z.string().trim().min(1).max(60),
  imageUrl: imageUrlSchema,
});

function uid(req: Request): string {
  if (!req.auth) throw new UnauthorizedError();
  return req.auth.userId;
}

export async function listGroupsHandler(req: Request, res: Response) {
  res.json(await groupService.listGroupsForUser(uid(req)));
}

export async function createGroupHandler(req: Request, res: Response) {
  const { name, emoji } = createGroupSchema.parse(req.body);
  res.status(201).json(await groupService.createGroup(uid(req), name, emoji));
}

export async function joinGroupHandler(req: Request, res: Response) {
  const { inviteCode } = joinGroupSchema.parse(req.body);
  res.status(201).json(await groupService.joinGroupByCode(uid(req), inviteCode));
}

export async function getGroupHandler(req: Request, res: Response) {
  res.json(await groupService.getGroupDetail(uid(req), req.params.id));
}

export async function leaveGroupHandler(req: Request, res: Response) {
  await groupService.leaveGroup(uid(req), req.params.id);
  res.status(204).end();
}

export async function listMembersHandler(req: Request, res: Response) {
  res.json(await groupService.listMembers(uid(req), req.params.id));
}

export async function removeMemberHandler(req: Request, res: Response) {
  await groupService.removeMember(req.params.id, uid(req), req.params.userId);
  res.status(204).end();
}

export async function regenerateInviteHandler(req: Request, res: Response) {
  res.json(await groupService.regenerateInvite(uid(req), req.params.id));
}

export async function addBonusCardHandler(req: Request, res: Response) {
  const { name, imageUrl } = addBonusCardSchema.parse(req.body);
  res.status(201).json(await groupService.addBonusCard(uid(req), req.params.id, name, imageUrl));
}

export async function deleteBonusCardHandler(req: Request, res: Response) {
  await groupService.deleteBonusCard(uid(req), req.params.id, req.params.cardId);
  res.status(204).end();
}

export async function createListHandler(req: Request, res: Response) {
  const { name } = createListSchema.parse(req.body);
  res.status(201).json(await listService.createList(uid(req), req.params.id, name));
}

export async function deleteListHandler(req: Request, res: Response) {
  await listService.deleteList(uid(req), req.params.id, req.params.listId);
  res.status(204).end();
}
