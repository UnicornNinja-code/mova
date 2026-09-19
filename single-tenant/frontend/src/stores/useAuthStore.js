import { create } from "zustand";
import axios from "axios";

const STORAGE_SESSION_MARKER = "mova_session_active";
const STORAGE_USER_KEY = "mova_user_profile";
const STORAGE_TOKEN_KEY = "mova_access_token";

export const useAuthStore = create((set, get) => {
  let initialToken = null;
  let initialUser = null;
  let hasSessionMarker = false;

  try {
    hasSessionMarker = sessionStorage.getItem(STORAGE_SESSION_MARKER) === "true";
    initialToken = sessionStorage.getItem(STORAGE_TOKEN_KEY) || null;
    const savedUser = sessionStorage.getItem(STORAGE_USER_KEY);
    if (savedUser) {
      initialUser = JSON.parse(savedUser);
    }
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
      const currentToken = currentState.token || sessionStorage.getItem(STORAGE_TOKEN_KEY);

      // 1. If token exists in sessionStorage, verify token validity via /api/auth/me
      if (currentToken) {
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
            try {
              sessionStorage.setItem(STORAGE_SESSION_MARKER, "true");
              sessionStorage.setItem(STORAGE_TOKEN_KEY, currentToken);
              sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(fetchedUser));
            } catch (err) {
              console.warn("Storage save warning:", err);
            }

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
          // Token might be expired or invalid; fall through to silent refresh
          console.warn("Access token verification failed, attempting silent refresh...", meErr?.response?.status || meErr.message);
        }
      }

      // 2. Silent recovery via HTTP-Only cookie /api/auth/refresh-token
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
          try {
            sessionStorage.setItem(STORAGE_SESSION_MARKER, "true");
            sessionStorage.setItem(STORAGE_TOKEN_KEY, newToken);
            sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(returnedUser));
          } catch (err) {
            console.warn("Storage save warning:", err);
          }

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
      try {
        sessionStorage.removeItem(STORAGE_SESSION_MARKER);
        sessionStorage.removeItem(STORAGE_TOKEN_KEY);
        sessionStorage.removeItem(STORAGE_USER_KEY);
      } catch (e) {}

      set({
        token: null,
        user: null,
        isAuthenticated: false,
        isInitialized: true,
      });
      return false;
    },

    setAuth: (token, user) => {
      try {
        sessionStorage.setItem(STORAGE_SESSION_MARKER, "true");
        if (token) {
          sessionStorage.setItem(STORAGE_TOKEN_KEY, token);
        }
        if (user) {
          sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
        }
      } catch (err) {
        console.warn("Storage save warning:", err);
      }
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
        sessionStorage.removeItem(STORAGE_TOKEN_KEY);
        sessionStorage.removeItem(STORAGE_USER_KEY);
      } catch (err) {
        console.warn("Storage remove warning:", err);
      }
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

