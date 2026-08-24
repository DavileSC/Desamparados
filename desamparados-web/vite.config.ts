import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
})
