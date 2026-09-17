import type { ComponentType } from 'react'
import { FormularioTexto, FormularioFoto, FormularioTarjetas, type Props } from './FormulariosDeBloque'
import type { Bloque } from '../../../lib/api/contenido'

/** Nombre visible de cada tipo. Es lo que lee quien edita. */
export const NOMBRE_BLOQUE: Record<string, string> = {
  texto: 'Texto',
  foto: 'Foto',
  tarjetas: 'Tarjetas',
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
  tarjetas: FormularioTarjetas as unknown as ComponentType<Props<never>>,
}

/** Un bloque recién añadido, con sus campos vacíos. */
export const BLOQUE_NUEVO: Record<string, object> = {
  texto: { tipo: 'texto', titulo: '', html: '' },
  foto: { tipo: 'foto', titulo: '', url: '', alt: '', pie: '' },
  tarjetas: { tipo: 'tarjetas', titulo: '', tarjetas: [{ titulo: '', descripcion: '', enlace: '/' }] },
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
    case 'tarjetas':
      if (bloque.tarjetas.some((t) => t.titulo.trim() === '')) return 'tiene una tarjeta sin título'
      if (bloque.tarjetas.some((t) => t.enlace.trim() === '')) return 'tiene una tarjeta sin enlace'
      return null
    default:
      return null
  }
}
