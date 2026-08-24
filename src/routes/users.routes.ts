import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../middleware/auth";
import { getMeHandler, updateMeHandler } from "../controllers/users.controller";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, asyncHandler(getMeHandler));
usersRouter.patch("/me", requireAuth, asyncHandler(updateMeHandler));
