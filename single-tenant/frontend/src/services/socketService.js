import { io } from "socket.io-client";
import { useAuthStore } from "@/stores/useAuthStore";

let socketInstance = null;

export function getSocket() {
  if (!socketInstance) {
    const token = useAuthStore.getState().token;
    const socketOrigin =
      import.meta.env.VITE_API_URL || window.location.origin;

    socketInstance = io(socketOrigin, {
      path: "/socket.io",
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socketInstance;
}

export function connectSocket() {
  const socket = getSocket();
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
