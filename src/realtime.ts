import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { verifyAccessToken } from "./lib/jwt";
import { assertMembership } from "./services/group.service";
import { env } from "./env";

// Single Render instance on the free plan, so an in-process Socket.IO server
// is enough — no Redis adapter needed to fan events out across processes.
let io: SocketIOServer | null = null;

function groupRoom(groupId: string): string {
  return `group:${groupId}`;
}

export function initRealtime(httpServer: HttpServer): SocketIOServer {
  const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim());

  io = new SocketIOServer(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string" || !token) {
      next(new Error("Unauthorized"));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    // Clients join the room for whichever group they currently have open —
    // membership is re-checked fresh on every join, never trusted from the
    // handshake, since it can change at any time.
    socket.on("join-group", async (data: { groupId?: string }, ack?: (res: { ok: boolean }) => void) => {
      const groupId = data?.groupId;
      if (!groupId) {
        ack?.({ ok: false });
        return;
      }
      try {
        await assertMembership(groupId, socket.data.userId as string);
        socket.join(groupRoom(groupId));
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
      }
    });

    socket.on("leave-group", (data: { groupId?: string }) => {
      if (data?.groupId) socket.leave(groupRoom(data.groupId));
    });
  });

  return io;
}

export function emitToGroup(groupId: string, event: string, payload: unknown): void {
  io?.to(groupRoom(groupId)).emit(event, payload);
}
