import type { Request, Response } from "express";
import { z } from "zod";
import * as listService from "../services/list.service";
import { UnauthorizedError } from "../lib/errors";
import { imageUrlSchema, currencyCodeSchema } from "../lib/validation";

const priceSchema = z.number().nonnegative().finite().max(999999999);

const addItemSchema = z.object({
  text: z.string().trim().min(1).max(280),
  imageUrl: imageUrlSchema.optional(),
  price: priceSchema.optional(),
  currency: currencyCodeSchema.optional(),
});

const updateItemSchema = z
  .object({
    completed: z.boolean().optional(),
    text: z.string().trim().min(1).max(280).optional(),
    imageUrl: imageUrlSchema.optional(),
    price: priceSchema.nullable().optional(),
    currency: currencyCodeSchema.optional(),
  })
  .refine(
    (data) =>
      data.completed !== undefined ||
      data.text !== undefined ||
      data.imageUrl !== undefined ||
      data.price !== undefined ||
      data.currency !== undefined,
    { message: "At least one of completed, text, imageUrl, price, or currency must be provided" },
  );

const reorderItemsSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1),
});

function uid(req: Request): string {
  if (!req.auth) throw new UnauthorizedError();
  return req.auth.userId;
}

export async function addItemHandler(req: Request, res: Response) {
  const { text, imageUrl, price, currency } = addItemSchema.parse(req.body);
  res.status(201).json(await listService.addItem(uid(req), req.params.listId, text, imageUrl, price, currency));
}

export async function updateItemHandler(req: Request, res: Response) {
  const { completed, text, imageUrl, price, currency } = updateItemSchema.parse(req.body);
  res.json(
    await listService.updateItem(uid(req), req.params.listId, req.params.itemId, {
      completed,
      text,
      imageUrl,
      price,
      currency,
    }),
  );
}

export async function reorderItemsHandler(req: Request, res: Response) {
  const { itemIds } = reorderItemsSchema.parse(req.body);
  await listService.reorderItems(uid(req), req.params.listId, itemIds);
  res.status(204).end();
}

export async function deleteItemHandler(req: Request, res: Response) {
  await listService.deleteItem(uid(req), req.params.listId, req.params.itemId);
  res.status(204).end();
}
