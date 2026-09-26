import type { ComponentType } from 'react'
import { FormularioTexto, FormularioLlamada, FormularioListado, FormularioContacto } from './formularios/breves'
import { FormularioFoto, FormularioGaleria } from './formularios/medios'
import { FormularioTarjetas, FormularioDatos, FormularioItinerario } from './formularios/listas'
import { FormularioCronologia } from './formularios/cronologia'
import { FormularioFotoFija } from './formularios/fotoFija'
import { FormularioCarrusel } from './formularios/carrusel'
import { FormularioHorario } from './formularios/horario'
import {
  FormularioFotoTexto, FormularioCita, FormularioVideo, FormularioBotones, FormularioPreguntas,
  FormularioDescargas, FormularioMapa, FormularioCuentaAtras, FormularioEspacio, FormularioDibujo, FormularioAnillos,
  FormularioPuertas, FormularioPrograma, FormularioRelacion,
} from './formularios/nuevos'
import { FICHA_DE_BLOQUE } from '../constructor/etiquetas'
import { libreDe, valorDe } from '../../../components/bloques/presentacion'
import type { Props } from './formularios/comunes'
import { problemaDelMedio } from '../contenido/medios'
import { esDestinoValido } from '../../../lib/destinos'
import type { Bloque } from '../../../lib/api/contenido'

/** Nombre visible de cada tipo. Es lo que lee quien edita; sale de la ficha de la galería. */
export const NOMBRE_BLOQUE: Record<string, string> = Object.fromEntries(
  Object.entries(FICHA_DE_BLOQUE).map(([tipo, ficha]) => [tipo, ficha.nombre]),
)

// El registro es, a propósito, un `Record` de un solo tipo de componente: cada
// formulario recibe su propio `Bloque` concreto, no `never`. TypeScript no
// puede comprobar por sí solo que `ListaDeBloques` invoca cada uno con el
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
  fotoTexto: FormularioFotoTexto as unknown as ComponentType<Props<never>>,
  cita: FormularioCita as unknown as ComponentType<Props<never>>,
  video: FormularioVideo as unknown as ComponentType<Props<never>>,
  botones: FormularioBotones as unknown as ComponentType<Props<never>>,
  preguntas: FormularioPreguntas as unknown as ComponentType<Props<never>>,
  descargas: FormularioDescargas as unknown as ComponentType<Props<never>>,
  mapa: FormularioMapa as unknown as ComponentType<Props<never>>,
  cuentaAtras: FormularioCuentaAtras as unknown as ComponentType<Props<never>>,
  espacio: FormularioEspacio as unknown as ComponentType<Props<never>>,
  fotoFija: FormularioFotoFija as unknown as ComponentType<Props<never>>,
  horario: FormularioHorario as unknown as ComponentType<Props<never>>,
  dibujo: FormularioDibujo as unknown as ComponentType<Props<never>>,
  anillos: FormularioAnillos as unknown as ComponentType<Props<never>>,
  puertas: FormularioPuertas as unknown as ComponentType<Props<never>>,
  programa: FormularioPrograma as unknown as ComponentType<Props<never>>,
  relacion: FormularioRelacion as unknown as ComponentType<Props<never>>,
  carrusel: FormularioCarrusel as unknown as ComponentType<Props<never>>,
}

/** Los bloques que no llevan título de sección: su contenido ya lo dice todo, o no dice nada. */
export const SIN_TITULO = new Set(['espacio'])

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
  fotoTexto: { tipo: 'fotoTexto', titulo: '', url: '', alt: '', pie: '', html: '', boton: '', enlace: '' },
  cita: { tipo: 'cita', titulo: '', texto: '', autor: '', fuente: '' },
  video: { tipo: 'video', titulo: '', url: '', portada: '', alt: '', pie: '' },
  botones: { tipo: 'botones', titulo: '', botones: [{ texto: '', enlace: '/', estilo: 'principal' }] },
  preguntas: { tipo: 'preguntas', titulo: '', preguntas: [{ pregunta: '', respuesta: '' }] },
  descargas: { tipo: 'descargas', titulo: '', archivos: [{ titulo: '', descripcion: '', url: '' }] },
  mapa: { tipo: 'mapa', titulo: '', lugar: '', direccion: '' },
  // La fecha la pone `bloqueNuevo`: dentro de un mes a las 18:00, para que la
  // vista en vivo enseñe ya una cuenta y no un hueco.
  cuentaAtras: { tipo: 'cuentaAtras', titulo: '', fecha: '', texto: '', textoFinal: '' },
  espacio: { tipo: 'espacio', titulo: '' },
  fotoFija: { tipo: 'fotoFija', titulo: '', pasos: [{ titulo: '', texto: '', foto: { url: '', alt: '', pie: '' } }] },
  // Nace con una franja de diario ya rellena: así la vista en vivo enseña ya
  // la próxima misa, y quien edita ve la forma antes de cambiarla.
  horario: {
    tipo: 'horario', titulo: '',
    misas: [{ etiqueta: 'Lunes a sábado', dias: [1, 2, 3, 4, 5, 6], horas: ['19:00'], horasVerano: [] }],
    despacho: [], verano: { desde: '', hasta: '' }, lineas: [],
  },
  dibujo: { tipo: 'dibujo', titulo: '', dibujo: 'templo', html: '' },
  // Nace con los tres fines nombrados: el dibujo es de ellos y así la vista en
  // vivo enseña ya los anillos con su texto.
  anillos: {
    tipo: 'anillos', titulo: '', centro: '', texto: '',
    fines: ['Culto', 'Caridad', 'Formación'].map((titulo) => ({ titulo, texto: '', boton: '', enlace: '' })),
  },
  // Siempre dos: nacen las dos en blanco, sin datos.
  puertas: {
    tipo: 'puertas', titulo: '',
    puertas: [0, 1].map(() => ({ ceja: '', titulo: '', texto: '', datos: [], boton: '', enlace: '' })),
  },
  relacion: { tipo: 'relacion', titulo: 'Junta de Gobierno', mandato: '', nota: '', filas: [{ cargo: '', nombre: '', texto: '', enlace: '' }] },
  carrusel: { tipo: 'carrusel', titulo: '', piezas: [{ familia: '', titulo: '', texto: '', foto: { url: '', alt: '', pie: '' }, datos: [] }] },
  programa: { tipo: 'programa', titulo: 'Programa del curso', filas: [{ cuando: '', mes: 0, titulo: '', texto: '', boton: '', enlace: '' }] },
}

/** La fecha de un mes más tarde a las 18:00, como AAAA-MM-DDTHH:mm. */
function dentroDeUnMes(): string {
  const fecha = new Date()
  fecha.setMonth(fecha.getMonth() + 1)
  const dos = (n: number) => String(n).padStart(2, '0')
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}T18:00`
}

/** Un bloque nuevo de ese tipo, listo para añadir: copia fresca, nunca el objeto de la tabla. */
export function bloqueNuevo(tipo: string): Bloque {
  const bloque = structuredClone(BLOQUE_NUEVO[tipo]) as Bloque
  if (bloque.tipo === 'cuentaAtras') bloque.fecha = dentroDeUnMes()
  return bloque
}

const ANCLA = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Qué falla en la presentación, o `null`. Solo lo que se puede dejar mal desde
 * la pestaña (el servidor valida el resto): un fondo de foto sin foto, unas
 * fechas cruzadas o un ancla con otros caracteres.
 */
export function problemaDePresentacion(bloque: Bloque): string | null {
  if (valorDe(bloque, 'fondo') === 'foto' && libreDe(bloque, 'fondoFoto') === '') return 'tiene el fondo de foto sin foto'
  const desde = libreDe(bloque, 'desde')
  const hasta = libreDe(bloque, 'hasta')
  if (desde && hasta && desde > hasta) return 'tiene la fecha «hasta» antes que «desde»: no se vería nunca'
  const ancla = libreDe(bloque, 'ancla')
  if (ancla && !ANCLA.test(ancla)) return 'tiene un ancla con caracteres que no valen (solo minúsculas, cifras y guiones)'
  return null
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
      // Vacía vale: la hora puede no saberse todavía y la web dice «por confirmar».
      if (bloque.paradas.some((p) => p.hora !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.hora))) return 'tiene una hora que no es una hora (usa 17:30, o déjala vacía)'
      if (bloque.recorrido && bloque.recorrido.esquinas.length === 1) return 'tiene un recorrido de una sola esquina: pulsa al menos otra en el mapa'
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
    case 'fotoTexto':
      if (bloque.url.trim() === '') return 'no tiene foto'
      if (bloque.alt.trim() === '') return 'no tiene descripción de la foto'
      if (bloque.html.trim() === '') return 'no tiene texto'
      if (bloque.boton.trim() !== '' && bloque.enlace === '') return 'tiene un botón sin destino'
      if (bloque.boton.trim() === '' && bloque.enlace !== '') return 'tiene un destino sin texto en el botón'
      if (bloque.enlace !== '' && !esDestinoValido(bloque.enlace)) return `lleva el botón a una página que no existe (${bloque.enlace})`
      return null
    case 'cita':
      return bloque.texto.trim() === '' ? 'está vacía' : null
    case 'video':
      return problemaDelMedio({ tipo: 'video', url: bloque.url, portada: bloque.portada, alt: bloque.alt, pie: bloque.pie })
    case 'botones': {
      if (bloque.botones.some((b) => b.texto.trim() === '')) return 'tiene un botón sin texto'
      const roto = bloque.botones.find((b) => !esDestinoValido(b.enlace))
      return roto ? `lleva un botón a una página que no existe (${roto.enlace})` : null
    }
    case 'preguntas': {
      const sin = bloque.preguntas.findIndex((p) => p.pregunta.trim() === '' || p.respuesta.trim() === '')
      return sin === -1 ? null : `tiene la pregunta ${sin + 1} sin completar`
    }
    case 'descargas': {
      const sin = bloque.archivos.findIndex((a) => a.titulo.trim() === '' || a.url === '')
      return sin === -1 ? null : `tiene el documento ${sin + 1} sin nombre o sin PDF`
    }
    case 'mapa':
      return bloque.direccion.trim() === '' ? 'no tiene dirección' : null
    case 'fotoFija': {
      const sinFoto = bloque.pasos.findIndex((p) => p.foto.url === '')
      if (sinFoto !== -1) return `tiene la parte ${sinFoto + 1} sin foto`
      const sinAlt = bloque.pasos.findIndex((p) => p.foto.alt.trim() === '')
      if (sinAlt !== -1) return `tiene la foto de la parte ${sinAlt + 1} sin descripción`
      const sinTexto = bloque.pasos.findIndex((p) => p.texto.trim() === '')
      return sinTexto === -1 ? null : `tiene la parte ${sinTexto + 1} sin texto`
    }
    case 'horario': {
      const hora = /^([01]\d|2[0-3]):[0-5]\d$/
      const sinNombre = bloque.misas.findIndex((f) => f.etiqueta.trim() === '')
      if (sinNombre !== -1) return `tiene la franja ${sinNombre + 1} sin nombre`
      const sinDias = bloque.misas.findIndex((f) => f.dias.length === 0)
      if (sinDias !== -1) return `tiene la franja ${sinDias + 1} sin días`
      const malas = bloque.misas.findIndex((f) => f.horas.length === 0 || ![...f.horas, ...f.horasVerano].every((h) => hora.test(h)))
      if (malas !== -1) return `tiene la franja ${malas + 1} sin horas o con una hora mal escrita (usa 19:00)`
      const turno = bloque.despacho.findIndex((t) => t.dias.length === 0 || !hora.test(t.desde) || !hora.test(t.hasta) || t.hasta <= t.desde)
      if (turno !== -1) return `tiene el turno de despacho ${turno + 1} sin días o con las horas al revés`
      if ((bloque.verano.desde === '') !== (bloque.verano.hasta === '')) return 'tiene el verano a medias: pon principio y fin, o ninguno'
      return null
    }
    case 'anillos': {
      const sinNombre = bloque.fines.findIndex((f) => f.titulo.trim() === '')
      if (sinNombre !== -1) return `tiene el fin ${sinNombre + 1} sin nombre`
      const cojo = bloque.fines.findIndex((f) => (f.boton.trim() === '') !== (f.enlace === ''))
      return cojo === -1 ? null : `tiene el botón del fin ${cojo + 1} sin texto o sin destino`
    }
    case 'puertas': {
      const sinTitulo = bloque.puertas.findIndex((p) => p.titulo.trim() === '')
      if (sinTitulo !== -1) return `tiene la puerta ${sinTitulo + 1} sin título`
      const sinNombre = bloque.puertas.findIndex((p) => p.datos.some((d) => d.etiqueta.trim() === ''))
      if (sinNombre !== -1) return `tiene un dato de la puerta ${sinNombre + 1} sin nombre`
      const cojo = bloque.puertas.findIndex((p) => (p.boton.trim() === '') !== (p.enlace === ''))
      return cojo === -1 ? null : `tiene el botón de la puerta ${cojo + 1} sin texto o sin destino`
    }
    case 'carrusel': {
      const sinNombre = bloque.piezas.findIndex((p) => p.titulo.trim() === '')
      if (sinNombre !== -1) return `tiene la pieza ${sinNombre + 1} sin nombre`
      const sinFoto = bloque.piezas.findIndex((p) => p.foto.url === '')
      if (sinFoto !== -1) return `tiene la pieza ${sinFoto + 1} sin foto`
      const sinAlt = bloque.piezas.findIndex((p) => p.foto.alt.trim() === '')
      if (sinAlt !== -1) return `tiene la foto de la pieza ${sinAlt + 1} sin descripción`
      const coja = bloque.piezas.findIndex((p) => p.datos.some((d) => (d.etiqueta.trim() === '') !== (d.valor.trim() === '')))
      return coja === -1 ? null : `tiene un dato de la pieza ${coja + 1} sin nombre o sin valor`
    }
    case 'relacion': {
      const sinCargo = bloque.filas.findIndex((f) => f.cargo.trim() === '')
      return sinCargo === -1 ? null : `tiene la fila ${sinCargo + 1} sin cargo`
    }
    case 'programa': {
      const sinCuando = bloque.filas.findIndex((f) => f.cuando.trim() === '')
      if (sinCuando !== -1) return `tiene el culto ${sinCuando + 1} sin decir cuándo`
      const sinTitulo = bloque.filas.findIndex((f) => f.titulo.trim() === '')
      if (sinTitulo !== -1) return `tiene el culto ${sinTitulo + 1} sin nombre`
      const cojo = bloque.filas.findIndex((f) => (f.boton.trim() === '') !== (f.enlace === ''))
      return cojo === -1 ? null : `tiene el enlace del culto ${cojo + 1} sin texto o sin destino`
    }
    case 'dibujo':
      if (bloque.foto && bloque.foto.url !== '' && bloque.foto.alt.trim() === '') return 'tiene la ilustración sin descripción'
      return bloque.html.trim() === '' ? 'no tiene texto' : null
    case 'cuentaAtras':
      return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(bloque.fecha) ? null : 'no tiene fecha y hora'
    default:
      return null
  }
}
