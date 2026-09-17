/*
 * socketManager.ts
 * Singleton Socket.io Server Manager with Multi-Tenant JWT Handshake Auth & Room Control
 * MOVA Architecture Stage 5 (Live LBS & Real-Time Presence)
 */

import { Server, Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { JwtPayload } from "../types/user.types.js";

export interface AuthenticatedSocket extends Socket {
  user?: {
    id: number | string;
    name: string;
    email: string;
    role: string;
    tenantId?: string;
  };
}

export class SocketManager {
  private static instance: SocketManager | null = null;
  public io: Server | null = null;

  constructor() {
    if (SocketManager.instance) {
      return SocketManager.instance;
    }
    this.io = null;
    SocketManager.instance = this;
  }

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  /**
   * Initialize Socket.io Server on HTTP Server
   */
  public init(httpServer: HttpServer, forceNew: boolean = false): Server {
    if (this.io && !forceNew) return this.io;
    if (this.io && forceNew) {
      try {
        this.io.close();
      } catch (e) {}
    }

    this.io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
      pingTimeout: 10000,
      pingInterval: 5000,
    });

    // JWT Authentication Middleware for Socket.io Handshake
    this.io.use((socket: AuthenticatedSocket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace("Bearer ", "");

        if (!token) {
          return next(new Error("Authentication error: Token required"));
        }

        const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
        const tenantId = decoded.tenantId || (decoded as any).tenant_id || "thesis-default";

        socket.user = {
          id: decoded.id,
          name: decoded.name,
          email: decoded.email,
          role: decoded.role,
          tenantId: tenantId,
        };
        return next();
      } catch (err) {
        return next(new Error("Authentication error: Invalid or expired token"));
      }
    });

    // Connection Handler
    this.io.on("connection", (socket: AuthenticatedSocket) => {
      const user = socket.user;
      if (!user) return;
      const tenantId = user.tenantId || "thesis-default";
      console.log(`🔌 [SOCKET.IO CONNECTED] Socket ID: ${socket.id} | User: ${user.name} (${user.role}) | Tenant: ${tenantId}`);

      // Auto Join Tenant-Scoped Rooms based on Role
      if (user.role === "SUPERADMIN" || user.role === "MANAGEMENT") {
        socket.join(`tenant:${tenantId}:management`);
        socket.join(`tenant:${tenantId}:supervisors`);
        // Legacy fallback rooms
        socket.join("management_room");
        socket.join("supervisors_room");
      } else if (user.role === "SUPERVISOR") {
        socket.join(`tenant:${tenantId}:supervisors`);
        socket.join("supervisors_room");
      } else if (user.role === "RIDER") {
        socket.join(`tenant:${tenantId}:riders`);
        socket.join(`tenant:${tenantId}:rider:${user.id}`);
        socket.join("riders_room");
        socket.join(`rider_${user.id}_room`);
      }

      // Disconnect Handler
      socket.on("disconnect", (reason) => {
        console.log(`🔌 [SOCKET.IO DISCONNECTED] Socket ID: ${socket.id} | User: ${user.name} | Reason: ${reason}`);
      });
    });

    console.log("⚡ Socket.io Multi-Tenant Real-Time Server initialized successfully!");
    return this.io;
  }

  /**
   * Broadcast event to Tenant Supervisor Room (Supervisors, Management, Superadmin in tenant)
   */
  public broadcastToTenantSupervisors(tenantId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`tenant:${tenantId}:supervisors`).emit(event, data);
      // Legacy room broadcast
      this.io.to("supervisors_room").emit(event, data);
    }
  }

  /**
   * Broadcast event to Tenant Management Room
   */
  public broadcastToTenantManagement(tenantId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`tenant:${tenantId}:management`).emit(event, data);
      this.io.to("management_room").emit(event, data);
    }
  }

  /**
   * Send event to specific Tenant Rider Room
   */
  public sendToTenantRider(tenantId: string, riderId: number | string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`tenant:${tenantId}:rider:${riderId}`).emit(event, data);
      this.io.to(`rider_${riderId}_room`).emit(event, data);
    }
  }

  /**
   * Broadcast event to all connected clients
   */
  public broadcastAll(event: string, data: any): void {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  // Legacy compatibility helpers
  public broadcastToManagement(event: string, data: any): void {
    if (this.io) {
      this.io.to("management_room").emit(event, data);
    }
  }

  public broadcastToSupervisors(event: string, data: any): void {
    if (this.io) {
      this.io.to("supervisors_room").emit(event, data);
    }
  }

  public sendToRider(riderId: number | string, event: string, data: any): void {
    if (this.io) {
      this.io.to(`rider_${riderId}_room`).emit(event, data);
    }
  }
}

export const socketManager = SocketManager.getInstance();
