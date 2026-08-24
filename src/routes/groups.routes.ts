import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { requireGroupAdmin } from "../middleware/requireAdmin";
import {
  listGroupsHandler,
  createGroupHandler,
  joinGroupHandler,
  getGroupHandler,
  leaveGroupHandler,
  listMembersHandler,
  removeMemberHandler,
  regenerateInviteHandler,
  createListHandler,
} from "../controllers/groups.controller";

export const groupsRouter = Router();

groupsRouter.use(requireAuth);

groupsRouter.get("/", asyncHandler(listGroupsHandler));
groupsRouter.post("/", asyncHandler(createGroupHandler));
groupsRouter.post("/join", asyncHandler(joinGroupHandler));

groupsRouter.get("/:id", asyncHandler(getGroupHandler));
groupsRouter.delete("/:id/leave", asyncHandler(leaveGroupHandler));
groupsRouter.get("/:id/members", asyncHandler(listMembersHandler));
groupsRouter.delete("/:id/members/:userId", requireGroupAdmin, asyncHandler(removeMemberHandler));
groupsRouter.post("/:id/invite/regenerate", asyncHandler(regenerateInviteHandler));
groupsRouter.post("/:id/lists", asyncHandler(createListHandler));
