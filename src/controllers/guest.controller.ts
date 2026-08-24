import type { Request, Response } from "express";
import { z } from "zod";
import * as guestService from "../services/guest.service";
import { getClientIp } from "../lib/ip";

const createSchema = z.object({
  name: z.string().trim().max(80).optional(),
  fingerprint: z.string().min(1),
});

const checkSchema = z.object({
  fingerprint: z.string().min(1),
});

const idSchema = z.object({
  recoveryId: z.string().min(1),
});

export async function createGuestHandler(req: Request, res: Response) {
  const { name, fingerprint } = createSchema.parse(req.body);
  const result = await guestService.createGuest(name, fingerprint, getClientIp(req));
  res.status(201).json(result);
}

export async function checkRecoveryHandler(req: Request, res: Response) {
  const { fingerprint } = checkSchema.parse(req.body);
  const candidate = await guestService.checkRecovery(fingerprint, getClientIp(req));
  res.json({ candidate });
}

export async function confirmRecoveryHandler(req: Request, res: Response) {
  const { recoveryId } = idSchema.parse(req.body);
  const result = await guestService.confirmRecovery(recoveryId, getClientIp(req));
  res.json(result);
}

export async function declineRecoveryHandler(req: Request, res: Response) {
  idSchema.parse(req.body);
  res.status(204).end();
}
