import type { NextFunction, Request, Response } from "express";
import { prisma } from "../db";
import { ForbiddenError, UnauthorizedError } from "../lib/errors";
import { asyncHandler } from "../lib/asyncHandler";

// Only used on the member-removal route. Always checks the DB fresh —
// roles aren't carried in the JWT since they can change at any time.
export const requireGroupAdmin = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.auth) {
    throw new UnauthorizedError();
  }
  const groupId = req.params.id;
  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: req.auth.userId } },
  });
  if (!membership || membership.role !== "ADMIN") {
    throw new ForbiddenError("Only the group admin can do this");
  }
  next();
});
