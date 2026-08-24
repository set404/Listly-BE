import type { Request, Response } from "express";
import { z } from "zod";
import * as listService from "../services/list.service";
import { UnauthorizedError } from "../lib/errors";

const addItemSchema = z.object({
  text: z.string().trim().min(1).max(280),
});

const updateItemSchema = z
  .object({
    completed: z.boolean().optional(),
    text: z.string().trim().min(1).max(280).optional(),
  })
  .refine((data) => data.completed !== undefined || data.text !== undefined, {
    message: "At least one of completed or text must be provided",
  });

function uid(req: Request): string {
  if (!req.auth) throw new UnauthorizedError();
  return req.auth.userId;
}

export async function addItemHandler(req: Request, res: Response) {
  const { text } = addItemSchema.parse(req.body);
  res.status(201).json(await listService.addItem(uid(req), req.params.listId, text));
}

export async function updateItemHandler(req: Request, res: Response) {
  const { completed, text } = updateItemSchema.parse(req.body);
  res.json(await listService.updateItem(uid(req), req.params.listId, req.params.itemId, { completed, text }));
}
