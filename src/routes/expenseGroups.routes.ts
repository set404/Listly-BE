import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { requireGroupAdmin } from "../middleware/requireAdmin";
import {
  listExpenseGroupsHandler,
  createExpenseGroupHandler,
  joinExpenseGroupHandler,
  getExpenseGroupHandler,
  updateExpenseGroupHandler,
  deleteExpenseGroupHandler,
  leaveExpenseGroupHandler,
  listExpenseGroupMembersHandler,
  removeExpenseGroupMemberHandler,
  regenerateExpenseGroupInviteHandler,
  addExpenseHandler,
  updateExpenseHandler,
  deleteExpenseHandler,
  addSettlementHandler,
  deleteSettlementHandler,
} from "../controllers/expenseGroups.controller";

export const expenseGroupsRouter = Router();

expenseGroupsRouter.use(requireAuth);

expenseGroupsRouter.get("/", asyncHandler(listExpenseGroupsHandler));
expenseGroupsRouter.post("/", asyncHandler(createExpenseGroupHandler));
expenseGroupsRouter.post("/join", asyncHandler(joinExpenseGroupHandler));

expenseGroupsRouter.get("/:id", asyncHandler(getExpenseGroupHandler));
expenseGroupsRouter.patch("/:id", asyncHandler(updateExpenseGroupHandler));
expenseGroupsRouter.delete("/:id", requireGroupAdmin, asyncHandler(deleteExpenseGroupHandler));
expenseGroupsRouter.delete("/:id/leave", asyncHandler(leaveExpenseGroupHandler));
expenseGroupsRouter.get("/:id/members", asyncHandler(listExpenseGroupMembersHandler));
expenseGroupsRouter.delete("/:id/members/:userId", requireGroupAdmin, asyncHandler(removeExpenseGroupMemberHandler));
expenseGroupsRouter.post("/:id/invite/regenerate", asyncHandler(regenerateExpenseGroupInviteHandler));
expenseGroupsRouter.post("/:id/expenses", asyncHandler(addExpenseHandler));
expenseGroupsRouter.patch("/:id/expenses/:expenseId", asyncHandler(updateExpenseHandler));
expenseGroupsRouter.delete("/:id/expenses/:expenseId", asyncHandler(deleteExpenseHandler));
expenseGroupsRouter.post("/:id/settlements", asyncHandler(addSettlementHandler));
expenseGroupsRouter.delete("/:id/settlements/:settlementId", asyncHandler(deleteSettlementHandler));
