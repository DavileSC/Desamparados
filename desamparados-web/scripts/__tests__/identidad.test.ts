import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// index.html, el manifest y robots.txt se generan de shared/datos-entidad.json
// antes de dev y de build, pero están versionados: si alguien cambia el JSON o
// la plantilla y hace commit sin generar, la web publicaría la identidad vieja.

const raiz = process.cwd()

describe('los ficheros de la identidad', () => {
  it('están al día con shared/datos-entidad.json', () => {
    const r = spawnSync(process.execPath, ['scripts/generar-identidad.mjs', '--comprobar'], { cwd: raiz, encoding: 'utf8' })
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
  })

  it('index.html no deja ninguna marca de la plantilla sin sustituir', () => {
    const html = readFileSync(join(raiz, 'index.html'), 'utf8')
    expect(html).not.toMatch(/\{\{/)
    const { identidad } = JSON.parse(readFileSync(join(raiz, '../shared/datos-entidad.json'), 'utf8'))
    expect(html).toContain(`<title>${identidad.nombre} | ${identidad.localidad}</title>`)
    expect(html).toContain(`"url": "https://${identidad.dominio}/"`)
  })
})
