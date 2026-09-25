import { create } from "zustand";
import axios from "axios";

const STORAGE_SESSION_MARKER = "kopigo_session_active";
const STORAGE_USER_KEY = "kopigo_user_profile";
const STORAGE_TOKEN_KEY = "kopigo_access_token";

const LEGACY_SESSION_MARKER = "mova_session_active";
const LEGACY_USER_KEY = "mova_user_profile";
const LEGACY_TOKEN_KEY = "mova_access_token";

function readStorageToken() {
  try {
    return sessionStorage.getItem(STORAGE_TOKEN_KEY) || sessionStorage.getItem(LEGACY_TOKEN_KEY) || null;
  } catch (e) {
    return null;
  }
}

function readStorageUser() {
  try {
    const raw = sessionStorage.getItem(STORAGE_USER_KEY) || sessionStorage.getItem(LEGACY_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeStorageAuth(token, user) {
  try {
    sessionStorage.setItem(STORAGE_SESSION_MARKER, "true");
    sessionStorage.setItem(LEGACY_SESSION_MARKER, "true");
    if (token) {
      sessionStorage.setItem(STORAGE_TOKEN_KEY, token);
      sessionStorage.setItem(LEGACY_TOKEN_KEY, token);
    }
    if (user) {
      const uStr = JSON.stringify(user);
      sessionStorage.setItem(STORAGE_USER_KEY, uStr);
      sessionStorage.setItem(LEGACY_USER_KEY, uStr);
    }
  } catch (err) {
    console.warn("Storage save warning:", err);
  }
}

function clearStorageAuth() {
  try {
    sessionStorage.removeItem(STORAGE_SESSION_MARKER);
    sessionStorage.removeItem(STORAGE_TOKEN_KEY);
    sessionStorage.removeItem(STORAGE_USER_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_MARKER);
    sessionStorage.removeItem(LEGACY_TOKEN_KEY);
    sessionStorage.removeItem(LEGACY_USER_KEY);
  } catch (err) {
    console.warn("Storage remove warning:", err);
  }
}

export const useAuthStore = create((set, get) => {
  let initialToken = null;
  let initialUser = null;
  let hasSessionMarker = false;

  try {
    hasSessionMarker =
      sessionStorage.getItem(STORAGE_SESSION_MARKER) === "true" ||
      sessionStorage.getItem(LEGACY_SESSION_MARKER) === "true";
    initialToken = readStorageToken();
    initialUser = readStorageUser();
  } catch (err) {
    console.warn("Session storage access warning:", err);
  }

  const isInitiallyAuth = Boolean((initialToken && initialUser) || (hasSessionMarker && initialUser));

  return {
    token: initialToken,
    user: initialUser,
    isAuthenticated: isInitiallyAuth,
    isInitialized: false,
    lastActivity: Date.now(),

    initializeAuth: async () => {
      const currentState = get();
      const currentToken = currentState.token || readStorageToken();

      // Lazy check: If no access token exists in storage, finish initialization immediately without network calls
      if (!currentToken) {
        clearStorageAuth();
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isInitialized: true,
        });
        return false;
      }

      // 1. Verify existing token validity via /api/auth/me
      try {
        const meResponse = await axios.get(
          `${import.meta.env.VITE_API_URL || ""}/api/auth/me`,
          {
            headers: { Authorization: `Bearer ${currentToken}` },
            withCredentials: true,
            timeout: 8000,
          }
        );

        const fetchedUser = meResponse.data?.user || meResponse.data?.data?.user || currentState.user;
        if (fetchedUser) {
          writeStorageAuth(currentToken, fetchedUser);

          set({
            token: currentToken,
            user: fetchedUser,
            isAuthenticated: true,
            isInitialized: true,
            lastActivity: Date.now(),
          });
          return true;
        }
      } catch (meErr) {
        // Token might be expired or invalid; fall through to silent recovery
      }

      // 2. Silent recovery via HTTP-Only cookie /api/auth/refresh-token (only if token existed previously)
      try {
        const refreshResponse = await axios.post(
          `${import.meta.env.VITE_API_URL || ""}/api/auth/refresh-token`,
          {},
          { withCredentials: true, timeout: 8000 }
        );

        const data = refreshResponse.data?.data || refreshResponse.data;
        const newToken = data?.token;
        const returnedUser = data?.user || currentState.user;

        if (newToken && returnedUser) {
          writeStorageAuth(newToken, returnedUser);

          set({
            token: newToken,
            user: returnedUser,
            isAuthenticated: true,
            isInitialized: true,
            lastActivity: Date.now(),
          });
          return true;
        }
      } catch (refreshErr) {
        // Silent recovery failed (e.g. no cookie or refresh token expired)
      }

      // 3. Clear any invalid/partial session state if all recovery attempts fail
      clearStorageAuth();

      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isInitialized: true,
      });
      return false;
    },

    setAuth: (token, user) => {
      writeStorageAuth(token, user);
      set({
        token,
        user,
        isAuthenticated: true,
        isInitialized: true,
        lastActivity: Date.now(),
      });
    },

    updateToken: (newToken) => {
      try {
        if (newToken) {
          sessionStorage.setItem(STORAGE_TOKEN_KEY, newToken);
          sessionStorage.setItem(LEGACY_TOKEN_KEY, newToken);
        }
      } catch (err) {
        console.warn("Storage save warning:", err);
      }
      set({ token: newToken, lastActivity: Date.now() });
    },

    updateUser: (partialUser) => {
      const currentUser = get().user || {};
      const updatedUser = { ...currentUser, ...partialUser };
      try {
        const uStr = JSON.stringify(updatedUser);
        sessionStorage.setItem(STORAGE_USER_KEY, uStr);
        sessionStorage.setItem(LEGACY_USER_KEY, uStr);
      } catch (err) {
        console.warn("Storage save warning:", err);
      }
      set({ user: updatedUser, lastActivity: Date.now() });
    },

    touchActivity: () => {
      set({ lastActivity: Date.now() });
    },

    clearAuth: () => {
      clearStorageAuth();
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isInitialized: true,
      });
    },

    wipeSession: () => {
      try {
        sessionStorage.clear();
        localStorage.clear();
      } catch (err) {
        console.warn("Storage wipe warning:", err);
      }
      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isInitialized: true,
      });
    },
  };
});

