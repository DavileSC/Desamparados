import type { ComponentType } from 'react'
import { FormularioTexto, FormularioFoto, FormularioTarjetas, type Props } from './FormulariosDeBloque'

/** Nombre visible de cada tipo. Es lo que lee quien edita. */
export const NOMBRE_BLOQUE: Record<string, string> = {
  texto: 'Texto',
  foto: 'Foto',
  tarjetas: 'Tarjetas',
}

// El registro es, a propósito, un `Record` de un solo tipo de componente: cada
// formulario recibe su propio `Bloque` concreto, no `never`. TypeScript no
// puede comprobar por sí solo que `EditorDeBloques` solo invoca cada uno con
// el bloque de su mismo tipo (lo hace por `bloque.tipo`, en tiempo de
// ejecución); de ahí el paso por `unknown`, igual que en
// `components/bloques/registro.tsx`, la misma idea para la web pública.
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
