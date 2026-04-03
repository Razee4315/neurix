export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export const APP_NAME = import.meta.env.VITE_APP_NAME || "Neurix";

export const isTauriEnvironment =
  typeof window !== "undefined" && "__TAURI__" in window;
