import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { addItemHandler, updateItemHandler, reorderItemsHandler, deleteItemHandler } from "../controllers/lists.controller";

export const listsRouter = Router();

listsRouter.use(requireAuth);

listsRouter.post("/:listId/items", asyncHandler(addItemHandler));
// Must come before the /:itemId patch route below — both match the same
// number of segments, and Express tries routes in registration order.
listsRouter.patch("/:listId/items/reorder", asyncHandler(reorderItemsHandler));
listsRouter.patch("/:listId/items/:itemId", asyncHandler(updateItemHandler));
listsRouter.delete("/:listId/items/:itemId", asyncHandler(deleteItemHandler));
