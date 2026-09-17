import { io } from "socket.io-client";
import { SOCKET_EVENTS } from "./socketEvents.js";
import { defaultDeduplicator } from "./eventDeduplicator.js";

const SOCKET_URL = (typeof import.meta !== "undefined" && import.meta.env?.VITE_SOCKET_URL) || "http://localhost:8090";

class SocketManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.deduplicator = defaultDeduplicator;
    this.authErrorHandler = null;
  }

  /**
   * Set callback when server rejects handshake due to expired or missing token
   */
  onAuthError(callback) {
    this.authErrorHandler = callback;
  }

  /**
   * Initializes and connects Socket.io client with JWT handshake auth
   */
  connect(token) {
    const authToken = token || localStorage.getItem("token");
    if (!authToken) return null;

    if (this.socket) {
      if (this.socket.connected) {
        return this.socket;
      }
      // If token changed, disconnect old socket first
      if (this.socket.auth?.token !== authToken) {
        this.disconnect();
      } else {
        return this.socket;
      }
    }

    this.socket = io(SOCKET_URL, {
      auth: { token: authToken },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.socket.on(SOCKET_EVENTS.CONNECT, () => {
      this.isConnected = true;
      console.log("⚡ [SOCKET.IO] Connected to Real-Time Server:", this.socket?.id || "established");
    });

    this.socket.on(SOCKET_EVENTS.CONNECT_ERROR, (err) => {
      this.isConnected = false;
      console.warn("⚠️ [SOCKET.IO] Connection Error:", err.message);

      const errCode = err?.data?.code;
      if (errCode === "AUTH_EXPIRED" || errCode === "AUTH_INVALID" || errCode === "AUTH_REQUIRED") {
        if (typeof this.authErrorHandler === "function") {
          this.authErrorHandler(errCode, err.message);
        }
      }
    });

    this.socket.on(SOCKET_EVENTS.DISCONNECT, (reason) => {
      this.isConnected = false;
      console.log("🔌 [SOCKET.IO] Disconnected:", reason);
    });

    return this.socket;
  }

  /**
   * Subscribes to an event with built-in deduplication check
   */
  on(eventName, callback) {
    if (!this.socket) return;

    this.socket.on(eventName, (payload) => {
      const eventId = payload?.event_id || payload?.data?.event_id;
      if (this.deduplicator.shouldProcess(eventId)) {
        callback(payload);
      }
    });
  }

  /**
   * Unsubscribes from an event
   */
  off(eventName, callback) {
    if (!this.socket) return;
    this.socket.off(eventName, callback);
  }

  /**
   * Emits an event to server
   */
  emit(eventName, data) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit(eventName, data);
  }

  /**
   * Disconnects and cleans up socket instance
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.deduplicator.clear();
    }
  }
}

export const socketManager = new SocketManager();

