import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas de punta a punta: la web y la API de verdad, con su base de datos.
 *
 * En local no arranca nada: corren contra el backend y el Vite que ya tengas
 * levantados (3001 y 5173), y la preparación avisa si no responden. En el CI
 * (`CI` definida) los arranca Playwright, con la base sembrada del job.
 *
 * Los ficheros se llaman `*.e2e.ts` y viven en `e2e/`, fuera de `src/`: así
 * Vitest no los coge (busca `*.test.*`) y Playwright no coge los de Vitest.
 */
const enCi = Boolean(process.env.CI)
const web = process.env.E2E_WEB ?? 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.e2e.ts',
  globalSetup: './e2e/preparacion.ts',
  // Uno detrás de otro, como las pruebas del backend: comparten la base.
  workers: 1,
  fullyParallel: false,
  forbidOnly: enCi,
  // En el CI un reintento, para separar un fallo de verdad de un tropiezo de
  // la máquina: la traza del primer intento queda guardada igualmente.
  retries: enCi ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: enCi ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: web,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: enCi
    ? [
        {
          command: 'npm start',
          cwd: '../backend-desamparados',
          url: 'http://localhost:3001/api/salidas/proxima',
          timeout: 120_000,
        },
        {
          // El de desarrollo y no `vite preview`: los datos de la corporación
          // los pone el plugin de Vite (en el servidor, nginx), y la web
          // compilada sale sin ellos.
          command: 'npm run dev -- --port 5173 --strictPort',
          url: web,
          timeout: 120_000,
        },
      ]
    : undefined,
})
