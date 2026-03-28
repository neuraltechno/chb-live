// =============================================
// Custom Next.js Server with Socket.io
// Enables real-time chat for each game room
// =============================================

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // ---------- Socket.io Setup ----------
  // In development, allow any browser origin (localhost vs 127.0.0.1, custom port).
  // In production, restrict to NEXT_PUBLIC_APP_URL.
  const io = new Server(httpServer, {
    cors: {
      origin: dev
        ? true
        : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Track active users per room
  const roomUsers = new Map(); // gameId -> Set of { socketId, username, avatar }

  io.on("connection", (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // ---------- Join a game chat room ----------
    socket.on("join_room", ({ gameId, user }) => {
      socket.join(gameId);

      if (!roomUsers.has(gameId)) {
        roomUsers.set(gameId, new Map());
      }

      const room = roomUsers.get(gameId);
      room.set(socket.id, {
        socketId: socket.id,
        username: user?.username || "Anonymous",
        avatar: user?.avatar || "",
        userId: user?.id || null,
      });

      // Notify room about new user
      io.to(gameId).emit("room_users", {
        count: room.size,
        users: Array.from(room.values()),
      });

      io.to(gameId).emit("user_joined", {
        username: user?.username || "Anonymous",
        count: room.size,
      });

      console.log(
        `👤 ${user?.username || "Anonymous"} joined room ${gameId} (${room.size} users)`
      );
    });

    // ---------- Leave a game chat room ----------
    socket.on("leave_room", ({ gameId }) => {
      socket.leave(gameId);

      const room = roomUsers.get(gameId);
      if (room) {
        const user = room.get(socket.id);
        room.delete(socket.id);

        if (room.size === 0) {
          roomUsers.delete(gameId);
        } else {
          io.to(gameId).emit("room_users", {
            count: room.size,
            users: Array.from(room.values()),
          });

          if (user) {
            io.to(gameId).emit("user_left", {
              username: user.username,
              count: room.size,
            });
          }
        }
      }
    });

    // ---------- Send a message ----------
    socket.on("send_message", (data) => {
      const { gameId, message } = data;

      const emitData = {
        _id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        gameId,
        user: {
          _id: message.userId,
          username: message.username,
          avatar: message.userAvatar,
        },
        content: message.content,
        type: message.type || "text",
        createdAt: new Date().toISOString(),
      };

      if (message.replyTo) {
        emitData.replyTo = message.replyTo;
      }

      // Broadcast to all users in the room (including sender)
      io.to(gameId).emit("new_message", emitData);
    });

    // ---------- Typing indicators ----------
    socket.on("typing", ({ gameId, username }) => {
      socket.to(gameId).emit("user_typing", { username, isTyping: true });
    });

    socket.on("stop_typing", ({ gameId, username }) => {
      socket.to(gameId).emit("user_typing", { username, isTyping: false });
    });

    // ---------- Disconnect ----------
    socket.on("disconnect", () => {
      console.log(`🔌 User disconnected: ${socket.id}`);

      // Clean up from all rooms
      for (const [gameId, room] of roomUsers.entries()) {
        if (room.has(socket.id)) {
          const user = room.get(socket.id);
          room.delete(socket.id);

          if (room.size === 0) {
            roomUsers.delete(gameId);
          } else {
            io.to(gameId).emit("room_users", {
              count: room.size,
              users: Array.from(room.values()),
            });

            if (user) {
              io.to(gameId).emit("user_left", {
                username: user.username,
                count: room.size,
              });
            }
          }
        }
      }
    });
  });

  // ---------- DM (Direct Messages) Real-time ----------

  // Store which socket is for which user (userId -> socketId)
  const userSockets = new Map(); // userId -> Set of socketIds

  io.on("connection", (socket) => {
    // Track userId for this socket (set when joining DM rooms)
    let connectedUserId = null;

    socket.on("register_user", ({ userId }) => {
      if (!userId) return;
      connectedUserId = userId;
      if (!userSockets.has(userId)) userSockets.set(userId, new Set());
      userSockets.get(userId).add(socket.id);
    });

    socket.on("join_dm_room", ({ conversationId, userId }) => {
      if (conversationId) {
        socket.join(`dm_${conversationId}`);
      }
      if (userId) {
        connectedUserId = userId;
        if (!userSockets.has(userId)) userSockets.set(userId, new Set());
        userSockets.get(userId).add(socket.id);
      }
    });

    socket.on("leave_dm_room", ({ conversationId }) => {
      if (conversationId) {
        socket.leave(`dm_${conversationId}`);
      }
    });

    socket.on("send_dm", ({ conversationId, message }) => {
      if (!conversationId || !message) return;
      // Emit to all OTHER participants in the DM room (not the sender)
      socket.to(`dm_${conversationId}`).emit("new_dm", message);
    });

    socket.on("dm_typing", ({ conversationId, username, isTyping }) => {
      if (!conversationId) return;
      socket.to(`dm_${conversationId}`).emit("dm_user_typing", {
        username,
        isTyping,
      });
    });

    socket.on("disconnect", () => {
      if (connectedUserId && userSockets.has(connectedUserId)) {
        userSockets.get(connectedUserId).delete(socket.id);
        if (userSockets.get(connectedUserId).size === 0) {
          userSockets.delete(connectedUserId);
        }
      }
    });
  });

  // ---------- Start Server ----------
  httpServer.listen(port, () => {
    console.log(`
  ╔══════════════════════════════════════════╗
  ║                                          ║
  ║   🎮  GAMEBLOC is running!               ║
  ║                                          ║
  ║   ➜  Local:   http://${hostname}:${port}      ║
  ║   ➜  Mode:    ${dev ? "Development" : "Production "}          ║
  ║   ➜  Socket:  Ready ✓                    ║
  ║                                          ║
  ╚══════════════════════════════════════════╝
    `);
  });
});
