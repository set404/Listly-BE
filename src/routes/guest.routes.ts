import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { guestLimiter } from "../middleware/rateLimit";
import {
  createGuestHandler,
  checkRecoveryHandler,
  confirmRecoveryHandler,
  declineRecoveryHandler,
} from "../controllers/guest.controller";

export const guestRouter = Router();

guestRouter.post("/create", guestLimiter, asyncHandler(createGuestHandler));
guestRouter.post("/recover/check", guestLimiter, asyncHandler(checkRecoveryHandler));
guestRouter.post("/recover/confirm", guestLimiter, asyncHandler(confirmRecoveryHandler));
guestRouter.post("/recover/decline", guestLimiter, asyncHandler(declineRecoveryHandler));
