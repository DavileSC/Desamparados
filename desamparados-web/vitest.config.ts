import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Sin el plugin de la instalación: los datos los pone src/test/setup.ts en
  // window.__INSTALACION__, como haría /instalacion.js (siempre el ejemplo).
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Con los 5 s de serie, las pruebas largas del constructor de páginas
    // caían por carga (en local y en el CI) sin que nada estuviera roto. Las
    // pesadas tardan unos 10 s solas y, con la suite entera (un trabajador por
    // núcleo), hasta el doble: 30 s les deja margen. Una prueba con un tope
    // propio más corto que este no gana nada y pierde margen: no se pone.
    testTimeout: 30000,
  },
})
