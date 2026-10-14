import { ErrorDeApi } from '../../../lib/api/cliente'

export function errorMessage(e: unknown, fallback: string) {
  return e instanceof ErrorDeApi ? e.message : fallback
}

/** Código de error que acompaña al mensaje en las respuestas del login. */
export function codigoError(e: unknown): string | undefined {
  if (!(e instanceof ErrorDeApi) || !e.payload || typeof e.payload !== 'object') return undefined
  const { error } = e.payload as { error?: unknown }
  return typeof error === 'string' ? error : undefined
}
