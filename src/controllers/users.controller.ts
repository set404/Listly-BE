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

const registerPushTokenSchema = z.object({
  token: z.string().trim().min(1),
  platform: z.string().trim().min(1).max(20).default("android"),
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

// A token can only ever belong to one user at a time (a device might switch
// guest identities, or someone logs into a different account on the same
// phone) — upsert re-points it rather than erroring on the unique conflict.
export async function registerPushTokenHandler(req: Request, res: Response) {
  if (!req.auth) throw new UnauthorizedError();
  const { token, platform } = registerPushTokenSchema.parse(req.body);
  await prisma.pushToken.upsert({
    where: { token },
    update: { userId: req.auth.userId, platform },
    create: { userId: req.auth.userId, token, platform },
  });
  res.status(204).end();
}
