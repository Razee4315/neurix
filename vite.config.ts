import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import type { UserConfig } from "vite";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, "package.json"), "utf-8"));
const host = process.env.TAURI_DEV_HOST || "localhost";

export default defineConfig((): UserConfig => {
  return {
    plugins: [
      react({
        babel: {
          plugins: [
            ["babel-plugin-styled-components", { displayName: true, fileName: true }],
          ],
        },
      }),
    ],
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version),
    },
    clearScreen: false,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 1420,
      strictPort: true,
      host: "0.0.0.0",
      hmr: { protocol: "ws", host, port: 1421 },
      watch: { ignored: ["**/src-tauri/**"] },
      proxy: {
        "/api": { target: "http://localhost:8080", changeOrigin: true, secure: false },
        "/auth": { target: "http://localhost:8080", changeOrigin: true, secure: false },
      },
    },
    build: {
      target: process.env.TAURI_PLATFORM === "windows" ? "chrome105" : "safari13",
      minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
      sourcemap: !!process.env.TAURI_DEBUG,
    },
  };
});
