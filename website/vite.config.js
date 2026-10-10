import { defineConfig } from 'vite'

// The site is self-contained: it reads nothing from the app's source at build time.
export default defineConfig({
  server: { port: 5183, strictPort: true },
  preview: { port: 5184, strictPort: true },
  build: { target: 'es2022', assetsInlineLimit: 0 },
})
