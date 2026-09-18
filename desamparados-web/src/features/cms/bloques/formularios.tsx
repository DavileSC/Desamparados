import type { ComponentType } from 'react'
import {
  FormularioTexto, FormularioFoto, FormularioGaleria,
  FormularioTarjetas, FormularioLlamada, FormularioDatos, FormularioItinerario,
  FormularioCronologia, FormularioListado, FormularioContacto,
  type Props,
} from './FormulariosDeBloque'
import { problemaDelMedio } from '../contenido/medios'
import { esDestinoValido } from '../../../lib/destinos'
import type { Bloque } from '../../../lib/api/contenido'

/** Nombre visible de cada tipo. Es lo que lee quien edita. */
export const NOMBRE_BLOQUE: Record<string, string> = {
  texto: 'Texto',
  foto: 'Foto',
  galeria: 'Galería',
  tarjetas: 'Tarjetas',
  llamada: 'Llamada',
  datos: 'Datos',
  itinerario: 'Itinerario',
  cronologia: 'Cronología',
  listado: 'Listado',
  contacto: 'Formulario de contacto',
}

// El registro es, a propósito, un `Record` de un solo tipo de componente: cada
// formulario recibe su propio `Bloque` concreto, no `never`. TypeScript no
// puede comprobar por sí solo que `EditorDeBloques` invoca cada uno con el
// bloque de su mismo tipo (lo hace por `bloque.tipo`, en tiempo de ejecución):
// la misma idea insegura-a-propósito que ya usa `components/bloques/registro.tsx`
// para la web pública, aunque allí un cast directo basta —su `{ bloque: never
// }` no lleva ninguna función— y aquí, con `onCambio` en `Props<T>`,
// TypeScript exige pasar antes por `unknown`.
export const FORMULARIOS: Record<string, ComponentType<Props<never>>> = {
  texto: FormularioTexto as unknown as ComponentType<Props<never>>,
  foto: FormularioFoto as unknown as ComponentType<Props<never>>,
  galeria: FormularioGaleria as unknown as ComponentType<Props<never>>,
  tarjetas: FormularioTarjetas as unknown as ComponentType<Props<never>>,
  llamada: FormularioLlamada as unknown as ComponentType<Props<never>>,
  datos: FormularioDatos as unknown as ComponentType<Props<never>>,
  itinerario: FormularioItinerario as unknown as ComponentType<Props<never>>,
  cronologia: FormularioCronologia as unknown as ComponentType<Props<never>>,
  listado: FormularioListado as unknown as ComponentType<Props<never>>,
  contacto: FormularioContacto as unknown as ComponentType<Props<never>>,
}

/** Un bloque recién añadido, con sus campos vacíos. */
export const BLOQUE_NUEVO: Record<string, object> = {
  texto: { tipo: 'texto', titulo: '', html: '' },
  foto: { tipo: 'foto', titulo: '', url: '', alt: '', pie: '' },
  // La galería nace vacía a propósito: el primer paso es elegir si lo que se
  // añade es una foto o un vídeo, y son dos formularios distintos.
  galeria: { tipo: 'galeria', titulo: '', medios: [] },
  tarjetas: { tipo: 'tarjetas', titulo: '', tarjetas: [{ titulo: '', descripcion: '', enlace: '/' }] },
  llamada: { tipo: 'llamada', titulo: '', texto: '', boton: '', enlace: '/' },
  datos: { tipo: 'datos', titulo: '', lineas: [{ etiqueta: '', valor: '' }] },
  itinerario: { tipo: 'itinerario', titulo: '', paradas: [{ hora: '17:30', lugar: '' }] },
  cronologia: {
    tipo: 'cronologia', titulo: '',
    hitos: [{ periodo: '', etiqueta: '', titulo: '', relato: '', foto: { url: '', alt: '', pie: '' }, tono: 'ninguno' }],
  },
  // Nace con la fuente más corriente elegida: un listado siempre enseña algo.
  listado: { tipo: 'listado', titulo: '', fuente: 'noticias-recientes' },
  contacto: { tipo: 'contacto', titulo: '', tituloDatos: 'Datos de contacto', lineas: [] },
}

/**
 * Qué le falta a un bloque para poder guardarse, o `null` si está completo.
 *
 * No reimplementa el esquema del servidor (`bloques.schema.ts`): cubre lo que
 * un bloque recién añadido tiene en blanco (`BLOQUE_NUEVO`), que es el caso que
 * de verdad se cuela al guardar sin querer. El servidor sigue siendo quien de
 * verdad decide; esto es solo para avisar antes de gastar una petición y para
 * decir DE QUÉ bloque se trata, porque puede estar plegado y fuera de la vista.
 */
export function problemaDeBloque(bloque: Bloque): string | null {
  switch (bloque.tipo) {
    case 'texto':
      return bloque.html.trim() === '' ? 'está vacío' : null
    case 'foto':
      if (bloque.url.trim() === '') return 'no tiene foto'
      if (bloque.alt.trim() === '') return 'no tiene descripción de la foto'
      return null
    case 'galeria': {
      if (bloque.medios.length === 0) return 'está vacío: añade una foto o un vídeo'
      // Se avisa del primero que falle, no de todos: el mensaje lleva a un
      // bloque concreto y quien edita lo abre y lo ve.
      const problema = bloque.medios.map(problemaDelMedio).find((p) => p !== null)
      return problema ?? null
    }
    case 'tarjetas': {
      if (bloque.tarjetas.some((t) => t.titulo.trim() === '')) return 'tiene una tarjeta sin título'
      // Vacío sí vale: una tarjeta sin enlace es informativa, y es legítimo.
      const rota = bloque.tarjetas.findIndex((t) => t.enlace !== '' && !esDestinoValido(t.enlace))
      if (rota !== -1) return `tiene la tarjeta ${rota + 1} enlazada a una página que no existe (${bloque.tarjetas[rota].enlace})`
      return null
    }
    case 'llamada':
      if (bloque.boton.trim() === '') return 'no tiene texto en el botón'
      if (bloque.enlace.trim() === '') return 'no tiene destino en el botón'
      if (!esDestinoValido(bloque.enlace)) return `lleva el botón a una página que no existe (${bloque.enlace})`
      return null
    case 'datos':
      if (bloque.lineas.some((l) => l.etiqueta.trim() === '')) return 'tiene una línea sin concepto'
      return null
    case 'itinerario':
      if (bloque.paradas.some((p) => p.lugar.trim() === '')) return 'tiene una parada sin lugar'
      if (bloque.paradas.some((p) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.hora))) return 'tiene una hora que no es una hora (usa 17:30)'
      return null
    case 'cronologia': {
      const n = bloque.hitos.findIndex((h) => h.periodo.trim() === '')
      if (n !== -1) return `tiene el hito ${n + 1} sin periodo`
      const f = bloque.hitos.findIndex((h) => h.foto.url !== '' && h.foto.alt.trim() === '')
      if (f !== -1) return `tiene la foto del hito ${f + 1} sin descripción`
      return null
    }
    case 'contacto':
      if (bloque.lineas.some((l) => l.etiqueta.trim() === '')) return 'tiene una línea sin concepto'
      return null
    default:
      return null
  }
}
