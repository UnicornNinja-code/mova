import { create } from "zustand";

const STORAGE_SESSION_MARKER = "mova_session_active";
const STORAGE_USER_KEY = "mova_user_profile";

export const useAuthStore = create((set, get) => {
  let initialUser = null;
  let hasSessionMarker = false;

  try {
    hasSessionMarker = sessionStorage.getItem(STORAGE_SESSION_MARKER) === "true";
    const savedUser = sessionStorage.getItem(STORAGE_USER_KEY);
    if (savedUser) {
      initialUser = JSON.parse(savedUser);
    }
  } catch (err) {
    console.warn("Session storage access warning:", err);
  }

  return {
    // In-memory runtime token (never saved raw to persistent long-term storage)
    token: null,
    user: initialUser,
    isAuthenticated: hasSessionMarker,
    lastActivity: Date.now(),

    setAuth: (token, user) => {
      try {
        sessionStorage.setItem(STORAGE_SESSION_MARKER, "true");
        sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
      } catch (err) {
        console.warn("Storage save warning:", err);
      }
      set({ token, user, isAuthenticated: true, lastActivity: Date.now() });
    },

    updateToken: (newToken) => {
      set({ token: newToken, lastActivity: Date.now() });
    },

    updateUser: (partialUser) => {
      const currentUser = get().user || {};
      const updatedUser = { ...currentUser, ...partialUser };
      try {
        sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedUser));
      } catch (err) {
        console.warn("Storage save warning:", err);
      }
      set({ user: updatedUser, lastActivity: Date.now() });
    },

    touchActivity: () => {
      set({ lastActivity: Date.now() });
    },

    clearAuth: () => {
      try {
        sessionStorage.removeItem(STORAGE_SESSION_MARKER);
        sessionStorage.removeItem(STORAGE_USER_KEY);
      } catch (err) {
        console.warn("Storage remove warning:", err);
      }
      set({ token: null, user: null, isAuthenticated: false });
    },

    wipeSession: () => {
      try {
        sessionStorage.clear();
        localStorage.clear();
      } catch (err) {
        console.warn("Storage wipe warning:", err);
      }
      set({ token: null, user: null, isAuthenticated: false });
    },
  };
});
