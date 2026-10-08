import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * index.html, el manifest y robots.txt como los genera
 * `scripts/generar-identidad.mjs`, con la instalación de las pruebas (el
 * ejemplo). No se leen los de la carpeta de la web: son de cada instalación,
 * no están en git y en el CI no existen.
 */
export function identidadGenerada() {
  const destino = mkdtempSync(join(tmpdir(), 'identidad-'))
  try {
    const r = spawnSync(process.execPath, ['scripts/generar-identidad.mjs', '--destino', destino], { cwd: process.cwd(), encoding: 'utf8' })
    if (r.status !== 0) throw new Error(r.stderr)
    const leer = (ruta: string) => readFileSync(join(destino, ruta), 'utf8')
    return { html: leer('index.html'), manifiesto: leer('public/manifest.json'), robots: leer('public/robots.txt') }
  } finally {
    rmSync(destino, { recursive: true, force: true })
  }
}
