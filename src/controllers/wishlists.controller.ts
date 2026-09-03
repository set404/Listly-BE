import type { Request, Response } from "express";
import { z } from "zod";
import * as wishlistService from "../services/wishlist.service";
import { UnauthorizedError } from "../lib/errors";

const createWishlistSchema = z.object({
  name: z.string().trim().min(1).max(80),
  emoji: z.string().trim().min(1).max(8).default("🎁"),
});

function uid(req: Request): string {
  if (!req.auth) throw new UnauthorizedError();
  return req.auth.userId;
}

export async function listWishlistsHandler(req: Request, res: Response) {
  res.json(await wishlistService.listWishlistsForUser(uid(req)));
}

export async function createWishlistHandler(req: Request, res: Response) {
  const { name, emoji } = createWishlistSchema.parse(req.body);
  res.status(201).json(await wishlistService.createWishlist(uid(req), name, emoji));
}

export async function getWishlistHandler(req: Request, res: Response) {
  res.json(await wishlistService.getWishlistDetail(uid(req), req.params.id));
}

export async function deleteWishlistHandler(req: Request, res: Response) {
  await wishlistService.deleteWishlist(uid(req), req.params.id);
  res.status(204).end();
}

export async function regenerateShareLinkHandler(req: Request, res: Response) {
  res.json(await wishlistService.regenerateShareLink(uid(req), req.params.id));
}

export async function getPublicWishlistHandler(req: Request, res: Response) {
  res.json(await wishlistService.getPublicWishlist(req.params.token));
}
