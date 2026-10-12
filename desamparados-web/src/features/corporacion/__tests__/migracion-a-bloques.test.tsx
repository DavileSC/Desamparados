import { describe, it, expect } from 'vitest'
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'
import CATALOGO from '../../../../../shared/paginas-publicas.json'

/**
 * Hasta la etapa 6 de la Fase 8 aquí se comprobaba, frase a frase, que la
 * conversión a bloques no se había comido nada del texto de Desamparados. Ese
 * texto ya no está en git: es la semilla de su instalación
 * (instalacion/contenido-inicial.json), y el contenido de partida es neutro.
 * Quedan las comprobaciones que valen para cualquier contenido de partida: que
 * toda página tenga el suyo, no vacío, y que no pierda sus enlaces.
 */

/** Los enlaces que tenía cada página y que no pueden haberse perdido. */
const ENLACES: Record<string, string[]> = {
  'nuestros-fines': ['/nuestros-fines/caridad', '/nuestros-fines/formacion'],
  'sabado-de-pasion': [
    '/sabado-de-pasion/recorrido',
    '/sabado-de-pasion/trono',
    '/sabado-de-pasion/enseres',
  ],
}

/** Todo el texto visible de un documento, sin etiquetas. */
function textoDe(slug: string): string {
  const pagina = (POR_DEFECTO as Record<string, unknown>)[slug] as {
    cabecera: { titulo: string; subtitulo: string }
    bloques: {
      titulo: string; html?: string; tarjetas?: { titulo: string; descripcion: string }[]
      // La foto fija guarda el texto en sus partes (Trono pasó a ella el 25-09-2026).
      pasos?: { titulo: string; texto: string }[]
      // Los tres anillos guardan su texto en los fines (Nuestros fines, 26-09-2026).
      fines?: { titulo: string; texto: string }[]
      // Las dos puertas, en sus paneles (Caridad, 26-09-2026).
      puertas?: { ceja: string; titulo: string; texto: string }[]
      // El programa, en sus filas (Cultos, 26-09-2026).
      // El programa (Cultos) y la relación (Órganos de Gobierno), en sus filas.
      filas?: { cuando?: string; titulo?: string; cargo?: string; nombre?: string; texto: string }[]
      // El carrusel, en sus piezas (Enseres, 27-09-2026).
      piezas?: { familia: string; titulo: string; texto: string }[]
    }[]
  }
  const trozos = [pagina.cabecera.titulo, pagina.cabecera.subtitulo]
  for (const bloque of pagina.bloques) {
    trozos.push(bloque.titulo)
    if (bloque.html) trozos.push(bloque.html.replace(/<[^>]*>/g, ' '))
    for (const tarjeta of bloque.tarjetas ?? []) trozos.push(tarjeta.titulo, tarjeta.descripcion)
    for (const paso of bloque.pasos ?? []) trozos.push(paso.titulo, paso.texto)
    for (const fin of bloque.fines ?? []) trozos.push(fin.titulo, fin.texto)
    for (const puerta of bloque.puertas ?? []) trozos.push(puerta.ceja, puerta.titulo, puerta.texto)
    for (const fila of bloque.filas ?? []) trozos.push(fila.cuando ?? '', fila.titulo ?? '', fila.cargo ?? '', fila.nombre ?? '', fila.texto)
    for (const pieza of bloque.piezas ?? []) trozos.push(pieza.familia, pieza.titulo, pieza.texto)
  }
  return trozos.join(' ').replace(/\s+/g, ' ')
}

describe('el contenido de partida de las páginas de bloques', () => {
  for (const [slug, destinos] of Object.entries(ENLACES)) {
    it(`«${slug}» conserva sus enlaces`, () => {
      const pagina = (POR_DEFECTO as Record<string, unknown>)[slug] as {
        bloques: { tarjetas?: { enlace: string }[]; fines?: { enlace: string }[] }[]
      }
      const enlaces = pagina.bloques.flatMap((b) => [...(b.tarjetas ?? []), ...(b.fines ?? [])].map((t) => t.enlace))
      for (const destino of destinos) {
        expect(enlaces, `falta el enlace ${destino} en «${slug}»`).toContain(destino)
      }
    })
  }

  it('toda página del catálogo tiene su documento de partida', () => {
    // Declarar una página en el catálogo sin trasladar su contenido la dejaría
    // en blanco en la web y con el editor vacío en el CMS.
    for (const pagina of CATALOGO.paginas) {
      const documento = (POR_DEFECTO as Record<string, unknown>)[pagina.slug]
      expect(documento, `«${pagina.slug}» no tiene contenido de partida`).toBeDefined()
      // Las páginas de Actualidad, Publicaciones y Contacto tienen poco texto
      // propio: lo que enseñan es el listado vivo o el formulario. Para ellas,
      // «no vacía» es llevar ese bloque.
      const bloques = (documento as { bloques: { tipo: string }[] }).bloques
      if (bloques.some((b) => b.tipo === 'listado' || b.tipo === 'contacto')) continue
      expect(textoDe(pagina.slug).trim().length, `«${pagina.slug}» está vacía`).toBeGreaterThan(80)
    }
  })
})
