import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Store room data
  // rooms[id] = { password, hostSocketId }
  const sessions = new Map();

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("create-session", ({ password }, callback) => {
      // Generate a simple numeric ID
      const sessionId = Math.floor(100000 + Math.random() * 900000).toString();
      sessions.set(sessionId, { password, hostId: socket.id });
      socket.join(sessionId);
      console.log(`Session created: ${sessionId}`);
      callback({ sessionId });
    });

    socket.on("join-session", ({ sessionId, password }, callback) => {
      const session = sessions.get(sessionId);
      if (!session) {
        return callback({ error: "Session not found" });
      }
      if (session.password !== password) {
        return callback({ error: "Invalid password" });
      }

      socket.join(sessionId);
      console.log(`User joined session: ${sessionId}`);
      
      // Notify host that someone joined
      socket.to(session.hostId).emit("user-joined", { userId: socket.id });
      callback({ success: true });
    });

    socket.on("signal", ({ to, signal, sessionId }) => {
      // Forward WebRTC signaling message
       if (to) {
          io.to(to).emit("signal", { from: socket.id, signal });
       } else {
          socket.to(sessionId).emit("signal", { from: socket.id, signal });
       }
    });

    socket.on("chat-message", ({ sessionId, message, senderName }) => {
      io.to(sessionId).emit("chat-message", {
        senderId: socket.id,
        senderName,
        message,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      // Clean up sections if host disconnects
      for (const [id, session] of sessions.entries()) {
        if (session.hostId === socket.id) {
          io.to(id).emit("session-closed");
          sessions.delete(id);
          console.log(`Session deleted: ${id}`);
        }
      }
    });
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    } else {
      app.use(express.static(__dirname));
      app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "index.html"));
      });
    }
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
