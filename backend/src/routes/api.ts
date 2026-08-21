import { Router } from "express";
import { Server as SocketIOServer } from "socket.io";
import { getStats } from "../handlers/socketHandler";

export function createApiRouter(io: SocketIOServer) {
  const router = Router();

  router.get("/health", (req, res) => {
    const stats = getStats(io);
    res.json({
      status: "ok",
      appName: "StudyMatch",
      ...stats,
    });
  });

  return router;
}
