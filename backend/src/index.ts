import express from "express";
import http from "http";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { createServer as createViteServer } from "vite";
import { initSocketHandlers, startStatsTicker } from "./handlers/socketHandler";
import { createApiRouter } from "./routes/api";

// Safe dir path determination for both CJS and ESM
const currentDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
  const server = http.createServer(app);

  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  app.use(express.json());

  // REST API Endpoints
  app.use("/api", createApiRouter(io));

  // Initialize Socket.IO Handlers
  initSocketHandlers(io);

  // Background ticker for live community statistics
  startStatsTicker(io);

  // Vite dev server middleware / Static serve in production
  if (process.env.NODE_ENV !== "production") {
    const frontendDir = path.resolve(process.cwd(), "frontend");
    const vite = await createViteServer({
      root: frontendDir,
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
  if (typeof process.env.PORT === "string" && process.env.PORT.startsWith("\\\\.\\pipe\\")) {
    server.listen(process.env.PORT, () => {
      console.log(`Numa Space server running on named pipe: ${process.env.PORT}`);
    });
  } else {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Numa Space server running at http://0.0.0.0:${PORT}`);
    });
  }
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
