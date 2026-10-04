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
          // Con nombre propio solo va lo que usa toda la web, que así se queda en
          // la caché entre despliegues. El resto de librerías no lleva nombre y el
          // empaquetador las pone junto a la página perezosa que las pide. Antes
          // acababan todas en un «vendor» común de 1,8 MB —el mapa, el editor del
          // CMS, el lector de QR…— que se descargaba y compilaba en la primera
          // visita a cualquier página: la web iba a tirones los primeros segundos.
          //
          // Se compara el nombre del paquete, no un trozo de la ruta: con
          // `includes('react')` caían en vendor-react @tiptap/react,
          // react-hook-form o @tanstack/react-query.
          manualChunks(id: string) {
            const paquete = /node_modules[\\/]((?:@[^\\/]+[\\/])?[^\\/]+)/.exec(id)?.[1]?.replace('\\', '/')
            if (!paquete) return undefined
            if (['react', 'react-dom', 'react-router', 'react-router-dom', 'scheduler'].includes(paquete)) {
              return 'vendor-react'
            }
            if (paquete.startsWith('@mui/') || paquete.startsWith('@emotion/')) {
              return 'vendor-mui'
            }
            if (['react-hook-form', '@hookform/resolvers', 'zod'].includes(paquete)) {
              return 'vendor-forms'
            }
            if (['framer-motion', 'motion-dom', 'motion-utils', 'react-helmet-async', '@tanstack/react-query', '@tanstack/query-core', 'zustand'].includes(paquete)) {
              return 'vendor-utils'
            }
            return undefined
          },
        },
      },
    },
  }
})
