import { defineConfig } from 'vite'

// The site is self-contained: it reads nothing from the app's source at build time.
// `base: './'` keeps every URL relative, so the build runs from a domain root or from any sub-path.
export default defineConfig({
  base: './',
  server: { port: 5183, strictPort: true },
  preview: { port: 5184, strictPort: true },
  build: { target: 'es2022', assetsInlineLimit: 0 },
})
