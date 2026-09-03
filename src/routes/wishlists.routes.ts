import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { wishlistPublicLimiter } from "../middleware/rateLimit";
import {
  listWishlistsHandler,
  createWishlistHandler,
  getWishlistHandler,
  updateWishlistHandler,
  deleteWishlistHandler,
  regenerateShareLinkHandler,
  getPublicWishlistHandler,
} from "../controllers/wishlists.controller";

export const wishlistsRouter = Router();

// Public, no auth — must come before requireAuth is applied below.
wishlistsRouter.get("/public/:token", wishlistPublicLimiter, asyncHandler(getPublicWishlistHandler));

wishlistsRouter.use(requireAuth);

wishlistsRouter.get("/", asyncHandler(listWishlistsHandler));
wishlistsRouter.post("/", asyncHandler(createWishlistHandler));
wishlistsRouter.get("/:id", asyncHandler(getWishlistHandler));
wishlistsRouter.patch("/:id", asyncHandler(updateWishlistHandler));
wishlistsRouter.delete("/:id", asyncHandler(deleteWishlistHandler));
wishlistsRouter.post("/:id/share/regenerate", asyncHandler(regenerateShareLinkHandler));
