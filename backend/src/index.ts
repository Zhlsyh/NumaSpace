import express from "express";
import http from "http";
import path from "path";
import { Server as SocketIOServer } from "socket.io";
import { createServer as createViteServer } from "vite";
import { initSocketHandlers, startStatsTicker } from "./handlers/socketHandler";
import { createApiRouter } from "./routes/api";

// Safe dir path determination for both CJS and ESM
const currentDir = typeof __dirname !== "undefined" ? __dirname : process.cwd();
const productionOriginDefaults = [
  process.env.FRONTEND_URL,
  process.env.RENDER_EXTERNAL_URL,
  process.env.WEBSITE_HOSTNAME ? `https://${process.env.WEBSITE_HOSTNAME}` : undefined,
].filter((origin): origin is string => Boolean(origin));
const configuredOrigins = [
  "https://numaspace.vercel.app",
  ...(process.env.NODE_ENV === "production" ? productionOriginDefaults : []),
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : []),
  ...(process.env.NODE_ENV !== "production"
    ? [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
      ]
    : []),
];
const allowedOrigins = new Set(
  configuredOrigins.flatMap((origin) => {
    try {
      return [new URL(origin.trim()).origin];
    } catch {
      return [];
    }
  }),
);

function isOriginAllowed(origin?: string) {
  if (!origin) return process.env.NODE_ENV !== "production";
  return allowedOrigins.has(origin);
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
  const server = http.createServer(app);

  const io = new SocketIOServer(server, {
    maxHttpBufferSize: 128 * 1024,
    cors: {
      origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
      methods: ["GET", "POST"],
    },
    allowRequest: (request, callback) => callback(null, isOriginAllowed(request.headers.origin)),
    transports: ["websocket", "polling"],
  });

  if (process.env.NODE_ENV === "production" && allowedOrigins.size === 0) {
    console.warn("Socket.IO browser access is disabled; configure ALLOWED_ORIGINS for the frontend origin.");
  }

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.vary("Origin");
    }
    if (req.method === "OPTIONS") {
      if (!isOriginAllowed(origin)) return res.sendStatus(403);
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
      res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      return res.sendStatus(204);
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
