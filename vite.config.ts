import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
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
