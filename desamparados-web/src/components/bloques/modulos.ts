import CATALOGO from '../../../../shared/tipos-de-bloque.json'
import type { Modulo } from '../../domain/modulos'
import type { Bloque, FuenteListado } from '../../lib/api/contenido'

type EntradaDeModulo = Modulo | { porFuente: Record<string, Modulo> }
const MODULO_DE_TIPO = CATALOGO.modulo as Record<string, EntradaDeModulo>

/** Un tipo se ofrece en «Añadir bloque» si su módulo está; un listado, si está el de alguna de sus fuentes. */
export function moduloDeTipo(tipo: string): Modulo | Modulo[] {
  const m = MODULO_DE_TIPO[tipo]
  if (m === undefined) return 'nucleo'
  return typeof m === 'string' ? m : Object.values(m.porFuente)
}

/** El módulo de un bloque concreto: el de su tipo o, en un listado, el de su fuente. */
export function moduloDeBloque(bloque: Bloque): Modulo {
  const m = MODULO_DE_TIPO[bloque.tipo]
  if (m === undefined || typeof m === 'string') return m ?? 'nucleo'
  const fuente = (bloque as { fuente?: string }).fuente
  return (fuente && m.porFuente[fuente]) || 'nucleo'
}

/** Las fuentes de listado que se pueden elegir con estos módulos. */
export function fuentesVisibles(activos: ReadonlySet<string>): FuenteListado[] {
  const m = MODULO_DE_TIPO.listado
  if (typeof m === 'string') return []
  return (Object.entries(m.porFuente) as [FuenteListado, Modulo][]).filter(([, modulo]) => modulo === 'nucleo' || activos.has(modulo)).map(([fuente]) => fuente)
}
