/*
 *   Copyright (c) 2026 
 *   All rights reserved.
 *   socketManager.js (Singleton Socket.io Server Manager with JWT Handshake Auth & Room Control)
 */

import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export class SocketManager {
  static instance = null;

  constructor() {
    if (SocketManager.instance) {
      return SocketManager.instance;
    }
    this.io = null;
    this.userSockets = new Map(); // Map<userId, Set<socketId>>
    SocketManager.instance = this;
  }

  static getInstance() {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  /**
   * Initialize Socket.io Server on Express HTTP Server
   */
  init(httpServer, forceNew = false) {
    if (this.io && !forceNew) return this.io;
    if (this.io && forceNew) {
      try { this.io.close(); } catch (e) {}
      this.userSockets.clear();
    }

    this.io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      pingTimeout: 20000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e6, // 1 MB limit per frame
      transports: ["websocket", "polling"],
      allowUpgrades: true,
    });

    // JWT Authentication Middleware for Socket.io Handshake
    this.io.use((socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

        if (!token) {
          const authErr = new Error("Authentication error: Token required");
          authErr.data = { code: "AUTH_REQUIRED" };
          return next(authErr);
        }

        const decoded = jwt.verify(token, env.JWT_SECRET);
        socket.user = {
          id: decoded.id,
          name: decoded.name,
          email: decoded.email,
          role: decoded.role,
        };
        return next();
      } catch (err) {
        const authErr = new Error("Authentication error: Invalid or expired token");
        authErr.data = { code: err.name === "TokenExpiredError" ? "AUTH_EXPIRED" : "AUTH_INVALID" };
        return next(authErr);
      }
    });

    // Connection Handler
    this.io.on("connection", (socket) => {
      const user = socket.user;
      if (!user) return;

      // Track active user socket mappings
      if (!this.userSockets.has(user.id)) {
        this.userSockets.set(user.id, new Set());
      }
      this.userSockets.get(user.id).add(socket.id);

      console.log(`🔌 [SOCKET.IO CONNECTED] Socket ID: ${socket.id} | User: ${user.name} (${user.role})`);

      // Auto Join Private User Room
      socket.join(`user_${user.id}`);

      // Auto Join Rooms based on Role
      if (user.role === "SUPERADMIN" || user.role === "MANAGEMENT") {
        socket.join("management_room");
        socket.join("supervisors_room");
      } else if (user.role === "SUPERVISOR") {
        socket.join("supervisors_room");
      } else if (user.role === "RIDER") {
        socket.join("riders_room");
        socket.join(`rider_${user.id}_room`);
      }

      // Disconnect Handler
      socket.on("disconnect", (reason) => {
        if (user && this.userSockets.has(user.id)) {
          const set = this.userSockets.get(user.id);
          set.delete(socket.id);
          if (set.size === 0) {
            this.userSockets.delete(user.id);
          }
        }
        console.log(`🔌 [SOCKET.IO DISCONNECTED] Socket ID: ${socket.id} | User: ${user?.name || "Unknown"} | Reason: ${reason}`);
      });
    });

    console.log("⚡ Socket.io Real-Time Server initialized successfully!");
    return this.io;
  }

  /**
   * Send event to specific user (across all their active socket connections)
   */
  sendToUser(userId, event, data) {
    if (this.io) {
      this.io.to(`user_${userId}`).emit(event, data);
    }
  }

  /**
   * Broadcast event to Management Room (Superadmin & Management only)
   */
  broadcastToManagement(event, data) {
    if (this.io) {
      this.io.to("management_room").emit(event, data);
    }
  }

  /**
   * Broadcast event to Supervisors Room (Supervisor, Management, & Superadmin)
   */
  broadcastToSupervisors(event, data) {
    if (this.io) {
      this.io.to("supervisors_room").emit(event, data);
    }
  }

  /**
   * Send event to specific Rider Room
   */
  sendToRider(riderId, event, data) {
    if (this.io) {
      this.io.to(`rider_${riderId}_room`).emit(event, data);
    }
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcastAll(event, data) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  /**
   * Get total number of connected sockets
   */
  getConnectedClientsCount() {
    return this.io?.engine?.clientsCount || 0;
  }

  /**
   * Check if a specific user currently has an active socket connection
   */
  isUserConnected(userId) {
    return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
  }

  /**
   * Get total active sockets in a specific room
   */
  async getRoomSocketsCount(roomName) {
    if (!this.io) return 0;
    const sockets = await this.io.in(roomName).allSockets();
    return sockets ? sockets.size : 0;
  }

  /**
   * Graceful close
   */
  close() {
    if (this.io) {
      this.io.close();
      this.io = null;
      this.userSockets.clear();
    }
  }
}

export const socketManager = SocketManager.getInstance();

