import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/**
 * Las carpetas de @mui/material que van en vendor-mui: lo que necesita
 * cualquier página para arrancar. Un componente que solo pinta el CMS no entra.
 */
const NUCLEO_MUI = new Set([
  'styles', 'utils', 'internal', 'colors', 'transitions', 'zero-styled', 'DefaultPropsProvider',
  'className', 'generateUtilityClass', 'generateUtilityClasses', 'locale', 'version', 'index.js',
  'CssBaseline', 'GlobalStyles', 'useMediaQuery', 'Box', 'Typography', 'ButtonBase', 'Button', 'SvgIcon',
])

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
            // Los iconos no: casi todos son del CMS (unos 165), y en vendor-mui
            // los bajaba también quien solo visita la web pública. Sueltos, cada
            // uno acaba junto a la pantalla que lo pinta.
            if (paquete === '@mui/icons-material') return undefined
            // De @mui/material, solo el núcleo: el tema, los estilos y las
            // piezas que pinta cualquier página. Con todo @mui/* aquí, la web
            // pública bajaba Autocomplete, Table, Slider… que solo usa el CMS
            // (62 KB gzip de más en la portada). El resto de componentes, como
            // los iconos, va sin grupo junto a quien los pinta.
            if (paquete === '@mui/material') {
              const carpeta = /@mui[\\/]material[\\/](?:esm[\\/])?([^\\/]+)/.exec(id)?.[1]
              return carpeta && NUCLEO_MUI.has(carpeta) ? 'vendor-mui' : undefined
            }
            if (paquete.startsWith('@mui/') || paquete.startsWith('@emotion/')) {
              return 'vendor-mui'
            }
            // Sin grupo para react-hook-form y zod: con «vendor-forms» el
            // empaquetador metía ahí también el código CJS de react, de modo que
            // toda página importaba ese trozo (y sus 30 KB de formularios) aunque
            // no tuviera ningún formulario. Sueltos, van con el formulario que
            // los usa.
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
