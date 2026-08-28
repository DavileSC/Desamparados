import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // En desarrollo, /api se proxyea al backend (por defecto :3001) para evitar CORS.
  // En producción se sirve bajo el mismo dominio: la cookie de sesión es
  // SameSite=Strict y no viajaría a otro origen.
  const backendUrl = env.VITE_DEV_BACKEND_URL || 'http://localhost:3001'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': { target: backendUrl, changeOrigin: true },
        '/storage': { target: backendUrl, changeOrigin: true },
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-router-dom')) {
                return 'vendor-react'
              }
              if (id.includes('@mui') || id.includes('@emotion')) {
                return 'vendor-mui'
              }
              if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
                return 'vendor-forms'
              }
              if (
                id.includes('framer-motion') ||
                id.includes('react-helmet-async') ||
                id.includes('@tanstack/react-query') ||
                id.includes('zustand')
              ) {
                return 'vendor-utils'
              }
              return 'vendor'
            }
          },
        },
      },
    },
  }
})
