import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Dev-time mirror of the production /api reverse proxy (nginx.conf).
      // Points at the deployed backend so local dev works same-origin
      // without needing a local Python backend. Override with a local
      // target if you run the backend on :3001.
      '/api': {
        target: 'https://no-mi-kos-back.onrender.com',
        changeOrigin: true,
        secure: true,
      },
      // Dev-time mirror of the production reverse proxy defined in
      // vercel.json + nginx.conf. Keeps auth requests same-origin so cookies
      // behave the same locally as in prod.
      '/auth-api': {
        target: 'https://nomikos-auth-service.onrender.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/auth-api/, ''),
        cookieDomainRewrite: '',
      },
    },
  },
})
