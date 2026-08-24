import type { Request, Response } from "express";
import { z } from "zod";
import * as authService from "../services/auth.service";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1).max(80),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function registerHandler(req: Request, res: Response) {
  const { email, password, name } = registerSchema.parse(req.body);
  const result = await authService.register(email, password, name);
  res.status(201).json(result);
}

export async function loginHandler(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  const result = await authService.login(email, password);
  res.json(result);
}

export async function refreshHandler(req: Request, res: Response) {
  const { refreshToken } = refreshSchema.parse(req.body);
  const result = await authService.refresh(refreshToken);
  res.json(result);
}

export async function logoutHandler(req: Request, res: Response) {
  const { refreshToken } = refreshSchema.parse(req.body);
  await authService.logout(refreshToken);
  res.status(204).end();
}
