import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { site } from '../config/site'

/**
 * Los datos estructurados viven en `index.html` para que viajen en el HTML sin
 * depender de JavaScript, pero la fuente de verdad sigue siendo `site.ts`.
 * Dos sitios que dicen lo mismo se separan solos: esto lo impide.
 */
const html = (() => {
  // index.html es de cada instalación y no está en git: se genera aquí con la
  // misma que ve site.ts en las pruebas (el ejemplo), en una carpeta aparte.
  const destino = mkdtempSync(join(tmpdir(), 'datos-estructurados-'))
  try {
    const r = spawnSync(process.execPath, ['scripts/generar-identidad.mjs', '--destino', destino], { cwd: process.cwd(), encoding: 'utf8' })
    if (r.status !== 0) throw new Error(r.stderr)
    return readFileSync(join(destino, 'index.html'), 'utf8')
  } finally {
    rmSync(destino, { recursive: true, force: true })
  }
})()

function jsonLd(): Record<string, unknown> {
  const bloque = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)
  if (!bloque) throw new Error('index.html ya no lleva datos estructurados')
  return JSON.parse(bloque[1]) as Record<string, unknown>
}

describe('los datos estructurados de index.html', () => {
  it('es JSON válido y se declara como schema.org', () => {
    const datos = jsonLd()
    expect(datos['@context']).toBe('https://schema.org')
    expect(datos['@type']).toBe('ReligiousOrganization')
  })

  it('dice el mismo nombre y el mismo correo que site.ts', () => {
    const datos = jsonLd()
    expect(datos.name).toBe(site.nombre)
    expect(datos.email).toBe(site.contacto.email)
  })

  it('enumera exactamente los perfiles que site.ts da por buenos', () => {
    // Un `null` en `site.redes` significa «todavía no nos han dado la URL».
    // Anunciarle a Google un perfil que no existe es peor que no anunciarlo.
    const declarados = Object.values(site.redes).filter((u): u is string => u !== null)
    expect(jsonLd().sameAs).toEqual(declarados)
  })

  it('sitúa la parroquia donde dice site.sede', () => {
    const lugar = jsonLd().location as { name: string; address: Record<string, string> }
    expect(lugar.name).toBe(site.sede.nombre)
    expect(lugar.address.streetAddress).toBe(site.sede.direccion)
    expect(lugar.address.addressLocality).toBe(site.sede.localidad)
  })

  it('la denominación jurídica es la de site.ts, y solo si está confirmada', () => {
    // Con `null` en el JSON la línea desaparece al generar index.html: Google
    // daría por bueno un dato inventado, y no se retira fácil.
    const datos = jsonLd()
    expect(datos.legalName).toBe(site.entidad.denominacion ?? undefined)
    // El NIF no se publica por decisión del Grupo Parroquial (site.ts).
    expect(datos.taxID).toBeUndefined()
  })
})
