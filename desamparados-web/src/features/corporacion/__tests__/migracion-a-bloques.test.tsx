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
  cultos: [
    'La vida espiritual del Grupo Parroquial se alimenta de los cultos',
    'Celebraciones del año',
    'Cultos mensuales', 'Triduo a la Sagrada Titular', 'Besamanos de la Virgen',
    'Quinario al Santo Cristo', 'Sábado de Pasión', 'Cultos de Navidad y Semana Santa',
    'generalmente el primer sábado de mes',
  ],
  'organos-de-gobierno': [
    'La Junta de Gobierno es el órgano colegiado',
    'Cargos de la Junta de Gobierno',
    'Hermano Mayor', 'Teniente Hermano Mayor', 'Secretario', 'Tesorero',
    'Vocal de Cultos', 'Vocal de Caridad', 'Vocal de Formación',
  ],
  parroquia: [
    'atendida por la\n              Congregación de la Pasión'.replace(/\s+/g, ' '),
    'Los Padres Pasionistas, con su espiritualidad centrada en la Cruz',
    'En el templo parroquial se celebran los cultos principales',
    'La comunidad pasionista y el Grupo Parroquial mantienen una estrecha colaboración',
  ],
  'nuestros-fines': [
    'como fines esenciales, la práctica de la caridad',
    'Caridad', 'Formación',
    'Ayuda social, obra asistencial y cercanía con los más desfavorecidos',
    'Educación en la fe, transmisión de valores cofrades',
  ],
  caridad: [
    'La caridad constituye uno de los fines fundamentales',
    'A través de la Vocalía de Caridad',
    'La obra asistencial no se entiende sin la participación activa',
    'Queremos que nuestro Grupo Parroquial sea una comunidad acogedora',
  ],
  formacion: [
    'La formación cristiana es uno de los pilares',
    'Durante el año se organizan diferentes actividades formativas',
    'La formación también abarca la transmisión de los valores cofrades',
    'Desde la Vocalía de Formación se promueve un itinerario formativo continuo',
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
    bloques: { titulo: string; html?: string; tarjetas?: { titulo: string; descripcion: string }[] }[]
  }
  const trozos = [pagina.cabecera.titulo, pagina.cabecera.subtitulo]
  for (const bloque of pagina.bloques) {
    trozos.push(bloque.titulo)
    if (bloque.html) trozos.push(bloque.html.replace(/<[^>]*>/g, ' '))
    for (const tarjeta of bloque.tarjetas ?? []) trozos.push(tarjeta.titulo, tarjeta.descripcion)
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
        bloques: { tarjetas?: { enlace: string }[] }[]
      }
      const enlaces = pagina.bloques.flatMap((b) => (b.tarjetas ?? []).map((t) => t.enlace))
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
