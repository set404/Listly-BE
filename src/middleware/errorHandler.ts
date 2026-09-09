import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../lib/errors";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    console.warn(`[${err.status}] ${req.method} ${req.originalUrl} - ${err.message}`);
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    console.warn(`[400] ${req.method} ${req.originalUrl} - ${JSON.stringify(err.flatten())}`);
    res.status(400).json({ error: "Invalid request", details: err.flatten() });
    return;
  }
  console.error(`[500] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ error: "Internal server error" });
}
