import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { publicUser } from "../services/auth.service";
import { UnauthorizedError, NotFoundError } from "../lib/errors";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  avatarColor: z
    .enum(["indigo", "rose", "amber", "emerald", "sky", "orange", "pink", "violet"])
    .optional(),
});

export async function getMeHandler(req: Request, res: Response) {
  if (!req.auth) throw new UnauthorizedError();
  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  if (!user) throw new NotFoundError("User not found");
  res.json(publicUser(user));
}

export async function updateMeHandler(req: Request, res: Response) {
  if (!req.auth) throw new UnauthorizedError();
  const data = updateSchema.parse(req.body);
  const user = await prisma.user.update({ where: { id: req.auth.userId }, data });
  res.json(publicUser(user));
}
