/*
 * socket.ts
 * Socket.IO Real-time Client for Svelte 5 Frontend
 */

import { io, Socket } from "socket.io-client";

const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:9000/api";
const socketServerUrl = rawApiUrl.replace(/\/api\/?$/, "");

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;

    socket = io(socketServerUrl, {
      transports: ["websocket", "polling"],
      auth: {
        token: token || undefined,
      },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on("connect", () => {
      console.log("⚡ [Socket.IO] Connected to server:", socket?.id);
    });

    socket.on("disconnect", (reason) => {
      console.warn("⚠️ [Socket.IO] Disconnected:", reason);
    });

    socket.on("connect_error", (error) => {
      console.error("❌ [Socket.IO] Connection Error:", error.message);
    });
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
