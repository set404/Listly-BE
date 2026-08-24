import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { authLimiter } from "../middleware/rateLimit";
import { registerHandler, loginHandler, refreshHandler, logoutHandler } from "../controllers/auth.controller";

export const authRouter = Router();

authRouter.post("/register", authLimiter, asyncHandler(registerHandler));
authRouter.post("/login", authLimiter, asyncHandler(loginHandler));
authRouter.post("/refresh", asyncHandler(refreshHandler));
authRouter.post("/logout", asyncHandler(logoutHandler));
