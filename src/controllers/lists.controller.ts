import type { Request, Response } from "express";
import { z } from "zod";
import * as listService from "../services/list.service";
import { UnauthorizedError } from "../lib/errors";
import { imageUrlSchema } from "../lib/validation";

const addItemSchema = z.object({
  text: z.string().trim().min(1).max(280),
  imageUrl: imageUrlSchema.optional(),
});

const updateItemSchema = z
  .object({
    completed: z.boolean().optional(),
    text: z.string().trim().min(1).max(280).optional(),
    imageUrl: imageUrlSchema.optional(),
  })
  .refine((data) => data.completed !== undefined || data.text !== undefined || data.imageUrl !== undefined, {
    message: "At least one of completed, text, or imageUrl must be provided",
  });

function uid(req: Request): string {
  if (!req.auth) throw new UnauthorizedError();
  return req.auth.userId;
}

export async function addItemHandler(req: Request, res: Response) {
  const { text, imageUrl } = addItemSchema.parse(req.body);
  res.status(201).json(await listService.addItem(uid(req), req.params.listId, text, imageUrl));
}

export async function updateItemHandler(req: Request, res: Response) {
  const { completed, text, imageUrl } = updateItemSchema.parse(req.body);
  res.json(await listService.updateItem(uid(req), req.params.listId, req.params.itemId, { completed, text, imageUrl }));
}

export async function deleteItemHandler(req: Request, res: Response) {
  await listService.deleteItem(uid(req), req.params.listId, req.params.itemId);
  res.status(204).end();
}
