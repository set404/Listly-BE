import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { addItemHandler, updateItemHandler } from "../controllers/lists.controller";

export const listsRouter = Router();

listsRouter.use(requireAuth);

listsRouter.post("/:listId/items", asyncHandler(addItemHandler));
listsRouter.patch("/:listId/items/:itemId", asyncHandler(updateItemHandler));
