import { createContext, useContext } from 'react'
import type { GraficasCms, ModoCms, SuperficiesCms } from '../theme/cms'

/**
 * El contexto del tema del CMS y la forma de leerlo. Aparte de `temaCms.tsx`
 * a propósito: ese fichero exporta el proveedor, que es un componente, y
 * sacar de él también el gancho rompe el *fast refresh* de Vite (aviso
 * `react/only-export-components`), igual que en `bloques/filas.ts`.
 *
 * Quien pinta importa de aquí; quien monta el árbol, de `temaCms.tsx`.
 *
 * Dos contextos a propósito. `useTemaCms` no cambia nunca: las superficies y
 * los colores de las gráficas son variables CSS que valen para los dos modos,
 * así que al cambiar de modo ningún componente que pinta se vuelve a pintar.
 * El modo en sí va en `useModoCms`, que solo lee quien lo enseña (el
 * interruptor): leerlo para elegir colores devolvería el parón al cambiar.
 */
export interface ValorTemaCms {
  cambiarModo: (modo: ModoCms) => void
  superficies: SuperficiesCms
  graficas: GraficasCms
}

export const ContextoTemaCms = createContext<ValorTemaCms | null>(null)
export const ContextoModoCms = createContext<ModoCms | null>(null)

export function useTemaCms(): ValorTemaCms {
  const valor = useContext(ContextoTemaCms)
  if (!valor) throw new Error('useTemaCms solo funciona dentro de TemaCmsProvider')
  return valor
}

/** El modo en que está el CMS. Solo para enseñarlo, no para elegir colores (ver arriba). */
export function useModoCms(): ModoCms {
  const modo = useContext(ContextoModoCms)
  if (!modo) throw new Error('useModoCms solo funciona dentro de TemaCmsProvider')
  return modo
}
