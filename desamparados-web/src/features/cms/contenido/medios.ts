import type { MedioGaleria } from '../../../lib/api/contenido'

/**
 * Los valores de partida y las comprobaciones de un medio de galería, aparte de
 * `CamposDeMedio.tsx` a propósito: ese fichero declara un componente, y
 * exportar además datos sueltos rompe el *fast refresh* de Vite (aviso
 * `react/only-export-components`), igual que pasa con `bloques/filas.ts`.
 */

/** Un medio recién añadido, con todo en blanco. */
export const FOTO_NUEVA: MedioGaleria = { tipo: 'foto', url: '', portada: '', alt: '', pie: '' }
export const VIDEO_NUEVO: MedioGaleria = { tipo: 'video', url: '', portada: '', alt: '', pie: '' }

/**
 * Qué le falta a un medio para poder guardarse, o `null` si está completo.
 *
 * No reimplementa el esquema del servidor (`medios.schema.ts`): cubre lo que un
 * medio recién añadido tiene en blanco, que es el caso que de verdad se cuela
 * al guardar sin querer. El servidor sigue siendo quien decide; esto avisa
 * antes de gastar una petición y, en el constructor de páginas, permite decir
 * de qué bloque se trata cuando está plegado y fuera de la vista.
 */
export function problemaDelMedio(medio: MedioGaleria): string | null {
  if (medio.url.trim() === '') {
    return medio.tipo === 'video' ? 'tiene un vídeo sin dirección ni subir' : 'tiene una foto sin subir'
  }
  // Sin descripción, el medio no existe para quien use un lector de pantalla.
  if (medio.alt.trim() === '') return 'tiene un medio sin descripción'
  // Sin portada propia habría que pedirle la miniatura a YouTube nada más abrir
  // la página, y eso ya avisa a un tercero de la visita.
  if (medio.tipo === 'video' && medio.portada.trim() === '') return 'tiene un vídeo sin foto de portada'
  return null
}
