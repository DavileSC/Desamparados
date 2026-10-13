import { afterAll, beforeAll } from 'vitest'

/**
 * Pone la zona horaria del proceso y devuelve cómo dejarla como estaba.
 *
 * Restaurar con `process.env.TZ = zonaDeAntes` no vale cuando no había ninguna
 * (Windows en local, el CI): `process.env` guarda la cadena «undefined», Node la
 * toma por una zona desconocida y pasa a UTC, y las pruebas que vinieran detrás
 * en el mismo trabajador correrían en otra zona sin que nadie lo pidiera.
 */
export function fijarZonaHoraria(zona: string): () => void {
  const zonaDeAntes = process.env.TZ
  process.env.TZ = zona
  return () => {
    if (zonaDeAntes === undefined) delete process.env.TZ
    else process.env.TZ = zonaDeAntes
  }
}

/** La zona para todo el fichero (o el `describe`) en que se llama. */
export function enZonaHoraria(zona: string) {
  let restaurar: (() => void) | undefined
  beforeAll(() => { restaurar = fijarZonaHoraria(zona) })
  afterAll(() => { restaurar?.() })
}
