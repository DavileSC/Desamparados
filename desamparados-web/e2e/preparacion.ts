import { execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import type { FullConfig } from '@playwright/test'

const BACKEND = path.resolve(import.meta.dirname, '../../backend-desamparados')

/**
 * Los datos de las pruebas los crea y los borra la API (scripts/e2e-datos.ts):
 * así las contraseñas van cifradas y el secreto del doble factor, con la clave
 * del servidor, igual que los de verdad. Con `node --import tsx`, como los
 * guiones de package.json: sin `npx`, que en Windows necesita una shell.
 */
function datosDeLaApi(orden: 'preparar' | 'limpiar', sufijo: string): string {
  return execFileSync(process.execPath, ['--import', 'tsx', 'scripts/e2e-datos.ts', orden, sufijo], {
    cwd: BACKEND,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
}

/** En local, los servidores los arranca cada uno: sin ellos, decirlo en vez de fallar en cada prueba. */
async function responde(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok
  } catch {
    return false
  }
}

export default async function preparacion(config: FullConfig) {
  const web = config.projects[0].use.baseURL!
  if (!(await responde(web)) || !(await responde(new URL('/api/salidas/proxima', web).href))) {
    throw new Error(`La web (${web}) o la API no responden. Arranca el backend y Vite antes de lanzar las pruebas.`)
  }

  const sufijo = randomBytes(5).toString('hex')
  // Los procesos de las pruebas nacen después y heredan el entorno.
  process.env.E2E_DATOS = datosDeLaApi('preparar', sufijo)

  return () => {
    datosDeLaApi('limpiar', sufijo)
  }
}
