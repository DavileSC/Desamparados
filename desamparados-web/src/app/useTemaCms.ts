import { createContext, useContext } from 'react'
import type { GraficasCms, ModoCms, SuperficiesCms } from '../theme/cms'

/**
 * El contexto del tema del CMS y la forma de leerlo. Aparte de `temaCms.tsx`
 * a propósito: ese fichero exporta el proveedor, que es un componente, y
 * sacar de él también el gancho rompe el *fast refresh* de Vite (aviso
 * `react/only-export-components`), igual que en `bloques/filas.ts`.
 *
 * Quien pinta importa de aquí; quien monta el árbol, de `temaCms.tsx`.
 */
export interface ValorTemaCms {
  modo: ModoCms
  cambiarModo: (modo: ModoCms) => void
  superficies: SuperficiesCms
  graficas: GraficasCms
}

export const ContextoTemaCms = createContext<ValorTemaCms | null>(null)

export function useTemaCms(): ValorTemaCms {
  const valor = useContext(ContextoTemaCms)
  if (!valor) throw new Error('useTemaCms solo funciona dentro de TemaCmsProvider')
  return valor
}
