import { describe, it, expect } from 'vitest'
import { waitFor } from '@testing-library/react'
import { site } from '../config/site'
import { identidadGenerada } from '../test/identidadGenerada'
import { renderWithProviders } from '../test/test-utils'
import DatosEstructurados from '../components/DatosEstructurados'
import DATOS from '@instalacion/datos-entidad.json'

/**
 * Los datos estructurados van en dos sitios: en `index.html` lo que no cambia,
 * para que viaje sin depender de JavaScript, y en la portada lo que se cambia
 * en el CMS (correo, teléfono, sede, perfiles). La fuente de verdad es
 * `site.ts` y los datos de contacto: esto impide que se separen.
 */
// index.html es de cada instalación y no está en git: se genera con la de las pruebas.
const html = identidadGenerada().html

function jsonLd(texto: string): Record<string, unknown> {
  const bloque = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(texto)
  if (!bloque) throw new Error('no hay datos estructurados')
  return JSON.parse(bloque[1]) as Record<string, unknown>
}

describe('los datos estructurados de index.html', () => {
  it('es JSON válido, se declara como schema.org y dice el nombre de site.ts', () => {
    const datos = jsonLd(html)
    expect(datos['@context']).toBe('https://schema.org')
    expect(datos['@type']).toBe('ReligiousOrganization')
    expect(datos.name).toBe(site.nombre)
  })

  it('no lleva lo que se cambia en el CMS: se quedaría viejo', () => {
    const datos = jsonLd(html)
    for (const clave of ['email', 'telephone', 'sameAs', 'location']) expect(datos).not.toHaveProperty(clave)
  })

  it('la denominación jurídica es la de site.ts, y solo si está confirmada', () => {
    // Con `null` en el JSON la línea desaparece al generar index.html: Google
    // daría por bueno un dato inventado, y no se retira fácil.
    const datos = jsonLd(html)
    expect(datos.legalName).toBe(site.entidad.denominacion ?? undefined)
    // El NIF no se publica por decisión del Grupo Parroquial (site.ts).
    expect(datos.taxID).toBeUndefined()
  })
})

describe('los datos estructurados de la portada', () => {
  const pintados = async () => {
    renderWithProviders(<DatosEstructurados />)
    let datos: Record<string, unknown> = {}
    await waitFor(() => { datos = jsonLd(document.head.innerHTML) })
    return datos
  }

  it('dicen el correo y la sede de los datos de contacto', async () => {
    const datos = await pintados()
    expect(datos.name).toBe(site.nombre)
    expect(datos.email).toBe(DATOS.secretaria.email)
    const lugar = datos.location as { name: string; address: Record<string, string> }
    expect(lugar.name).toBe(DATOS.sede.nombre)
    expect(lugar.address.streetAddress).toBe(DATOS.sede.calle)
    expect(lugar.address.addressLocality).toBe(DATOS.sede.localidad)
  })

  it('enumeran solo los perfiles que existen', async () => {
    // Un `null` en las redes significa «todavía no nos han dado la URL».
    const declarados = Object.values(DATOS.redes).filter((u): u is string => u !== null)
    const datos = await pintados()
    expect(datos.sameAs ?? []).toEqual(declarados)
    expect(datos.taxID).toBeUndefined()
  })
})
