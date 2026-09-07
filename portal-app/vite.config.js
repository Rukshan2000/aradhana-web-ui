import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The portal talks to portal-api. In dev we proxy /api and /health so the
// browser stays on one origin and no CORS/env juggling is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': { target: process.env.VITE_API_TARGET || 'http://localhost:4000', changeOrigin: true },
      '/health': { target: process.env.VITE_API_TARGET || 'http://localhost:4000', changeOrigin: true },
    },
  },
});
