import express from "express";
import cors from "cors";
import { env } from "./env";
import { authRouter } from "./routes/auth.routes";
import { guestRouter } from "./routes/guest.routes";
import { usersRouter } from "./routes/users.routes";
import { groupsRouter } from "./routes/groups.routes";
import { listsRouter } from "./routes/lists.routes";
import { wishlistsRouter } from "./routes/wishlists.routes";
import { errorHandler } from "./middleware/errorHandler";
import { pushConfigStatus } from "./lib/push";

export function createApp() {
  const app = express();

  if (env.TRUST_PROXY) app.set("trust proxy", 1);

  const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim());
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  // Raised from the default 100kb to fit item photos, which travel as
  // base64 data URLs in the JSON body (the client compresses them first).
  app.use(express.json({ limit: "4mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  // Read-only, no secrets — just enough to remotely confirm the Firebase
  // env vars on Render were actually picked up and accepted.
  app.get("/api/health/push", (_req, res) => {
    pushConfigStatus().then((status) => res.json(status));
  });

  app.use("/api/auth", authRouter);
  app.use("/api/guest", guestRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/groups", groupsRouter);
  app.use("/api/lists", listsRouter);
  app.use("/api/wishlists", wishlistsRouter);

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  app.use(errorHandler);

  return app;
}
