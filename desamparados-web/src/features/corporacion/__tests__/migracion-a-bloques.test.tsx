import { describe, it, expect } from 'vitest'
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'
import CATALOGO from '../../../../../shared/paginas-publicas.json'

/**
 * Lo que cada página decía ANTES de convertirla a bloques, copiado a mano de su
 * `.tsx` original (commits anteriores a la conversión). Si la migración se come
 * un párrafo, una tarjeta o un enlace, este test lo caza.
 *
 * Se comprueba contra `shared/contenido-por-defecto.json` y no contra la
 * pantalla: los valores de partida son de donde sale el contenido de una página
 * cuya fila no se ha tocado nunca, y son lo que de verdad se trasladó. Que la
 * pantalla pinte esos bloques ya lo cubren `BloquesDePagina.test.tsx` y
 * `CorporacionPage.test.tsx`.
 */
const ANTES: Record<string, string[]> = {
  // El «Quinario al Santo Cristo» salió a propósito: el Grupo tiene una sola titular.
  cultos: [
    // Desde el programa del curso (26-09-2026), los cultos van en sus filas.
    'La vida espiritual del Grupo Parroquial se alimenta de los cultos',
    'Programa del curso',
    'Culto mensual', 'Solemne Triduo', 'Besamanos',
    'Rosario vespertino', 'Sábado de Pasión', 'Navidad',
    'generalmente el primer sábado de mes',
  ],
  'organos-de-gobierno': [
    // Desde la relación de la Junta (26-09-2026), los cargos van en sus filas.
    'La Junta de Gobierno es el órgano colegiado',
    'Junta de Gobierno',
    'Hermano Mayor', 'Teniente Hermano Mayor', 'Secretaría', 'Tesorería',
    'Vocalía de Cultos', 'Vocalía de Caridad', 'Vocalía de Formación',
  ],
  parroquia: [
    'Parroquia de Santa María Goretti',
    'Horarios y despacho',
    'Los Pasionistas', 'La parroquia en fechas', 'Congregación de la Pasión de Jesucristo',
  ],
  'nuestros-fines': [
    'Culto', 'Caridad', 'Formación',
    'La ayuda a quien la necesita, desde la parroquia',
    'Catequesis, charlas y encuentros para crecer en la fe',
  ],
  caridad: [
    // Desde las dos puertas (26-09-2026), los voluntarios y la ayuda van en ellas.
    'la caridad es casi una obligación',
    'Qué hacemos', 'Familias en dificultad', 'Enfermos y mayores',
    'Necesito ayuda', 'Quiero ayudar', 'Cáritas parroquial de Santa María Goretti',
  ],
  formacion: [
    // Desde la carta (26-09-2026), las propuestas son subtítulos del texto.
    'La formación es uno de los pilares del Grupo Parroquial',
    'Catequesis y charlas', 'Retiros y oración', 'La espiritualidad de la Pasión',
    'Jóvenes y nuevos hermanos',
  ],
  'sabado-de-pasion': [
    'El Sábado de Pasión es el día grande de nuestro Grupo Parroquial',
    'La procesión es fruto del trabajo y la ilusión de toda una comunidad',
    'Descubre el Sábado de Pasión',
    'Recorrido', 'Trono', 'Enseres',
  ],
  trono: [
    'El trono de Nuestra Señora de los Desamparados es una de las piezas',
    'Cada detalle del trono ha sido pensado',
    'El trono es portado por una cuadrilla de costaleros',
    'Alrededor del trono se organizan los cargos de la procesión',
  ],
  enseres: [
    'Los enseres procesionales son elementos fundamentales',
    'La música acompaña el paso de Nuestra Señora de los Desamparados',
    'Las insignias del Grupo Parroquial, como el estandarte',
    'El cuidado de los enseres es tarea de todos los hermanos',
  ],
  desamparados: [
    'La devoción a Nuestra Señora de los Desamparados tiene sus raíces',
    'A lo largo de los años, la imagen titular ha sido venerada',
    'Cada noviembre, el Grupo Parroquial celebra solemne triduo',
  ],
  ajuar: [
    'El ajuar de la Sagrada Titular está compuesto por piezas',
    'El manto principal, de rico terciopelo',
    'El ajuar se va enriqueciendo con nuevas donaciones',
  ],
}

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
  }
  return trozos.join(' ').replace(/\s+/g, ' ')
}

describe('la conversión de las páginas a bloques no se ha comido nada', () => {
  for (const [slug, frases] of Object.entries(ANTES)) {
    it(`«${slug}» conserva lo que decía antes`, () => {
      const texto = textoDe(slug)
      for (const frase of frases) {
        expect(texto, `falta en «${slug}»: ${frase}`).toContain(frase)
      }
    })
  }

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
