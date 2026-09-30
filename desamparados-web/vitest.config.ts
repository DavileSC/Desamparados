import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
