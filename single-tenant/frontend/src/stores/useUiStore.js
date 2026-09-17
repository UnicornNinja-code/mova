import { create } from "zustand";

const THEME_KEY = "mova_theme";
const SIDEBAR_KEY = "mova_sidebar_collapsed";

export const useUiStore = create((set, get) => {
  let initialTheme = "dark";
  let initialCollapsed = false;

  try {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) initialTheme = savedTheme;
    const savedSidebar = localStorage.getItem(SIDEBAR_KEY);
    if (savedSidebar !== null) initialCollapsed = savedSidebar === "true";
  } catch (e) {
    // fallback
  }

  // Sync initial class on document
  if (typeof document !== "undefined") {
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  return {
    theme: initialTheme,
    isSidebarCollapsed: initialCollapsed,

    toggleSidebar: () => {
      const next = !get().isSidebarCollapsed;
      try {
        localStorage.setItem(SIDEBAR_KEY, String(next));
      } catch (e) {}
      set({ isSidebarCollapsed: next });
    },

    setTheme: (theme) => {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (e) {}
      if (typeof document !== "undefined") {
        if (theme === "dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
      set({ theme });
    },

    toggleTheme: () => {
      const nextTheme = get().theme === "dark" ? "light" : "dark";
      get().setTheme(nextTheme);
    },
  };
});
