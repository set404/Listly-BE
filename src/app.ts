import express from "express";
import cors from "cors";
import { env } from "./env";
import { authRouter } from "./routes/auth.routes";
import { guestRouter } from "./routes/guest.routes";
import { usersRouter } from "./routes/users.routes";
import { groupsRouter } from "./routes/groups.routes";
import { listsRouter } from "./routes/lists.routes";
import { errorHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  if (env.TRUST_PROXY) app.set("trust proxy", 1);

  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRouter);
  app.use("/api/guest", guestRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/groups", groupsRouter);
  app.use("/api/lists", listsRouter);

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  app.use(errorHandler);

  return app;
}
