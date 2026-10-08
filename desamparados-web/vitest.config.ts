import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { rutaDeDatosEntidad } from '../shared/datos-entidad.mjs'

export default defineConfig({
  plugins: [react()],
  // El mismo alias que vite.config.ts; en las pruebas resuelve al ejemplo.
  resolve: { alias: { '@instalacion/datos-entidad.json': rutaDeDatosEntidad() } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Con los 5 s de serie, las pruebas largas del constructor de páginas
    // caían por carga (en local y en el CI) sin que nada estuviera roto.
    testTimeout: 20000,
  },
})
