/**
 * Cuándo lo tendrán todos: la cola saca `porHora` correos y espera a la hora
 * siguiente, y la despierta un reloj de diez minutos, así que cada tanda tarda
 * algo más de una hora en dejar paso a la siguiente. Es una cuenta para
 * orientar («hacia las 10:25»), no un horario: otros correos del día (altas,
 * contraseñas) gastan del mismo cupo.
 */

export interface Ritmo { porHora: number; porDia: number }

/** Lo que tarda una tanda en dejar sitio a la siguiente: la hora del tope y el reloj de la cola. */
const TANDA_MS = 65 * 60 * 1000
/** Una tanda sale en unos minutos (1,5 s entre correo y correo). */
const ULTIMA_TANDA_MS = 5 * 60 * 1000
const CINCO_MINUTOS = 5 * 60 * 1000

export interface EstimacionDeEnvio {
  /** Cuántas tandas de una hora: una sola es «en unos minutos». */
  tandas: number
  /** El instante en que sale el último, redondeado a cinco minutos; null si pasa del tope del día. */
  fin: number | null
  /** Son más que el tope del día: lo que sobre sale al siguiente. */
  pasaDelDia: boolean
}

export function estimarEnvio(inicio: number, correos: number, ritmo: Ritmo): EstimacionDeEnvio {
  const tandas = Math.max(1, Math.ceil(correos / Math.max(1, ritmo.porHora)))
  if (correos > ritmo.porDia) return { tandas, fin: null, pasaDelDia: true }
  const fin = inicio + (tandas - 1) * TANDA_MS + ULTIMA_TANDA_MS
  return { tandas, fin: Math.ceil(fin / CINCO_MINUTOS) * CINCO_MINUTOS, pasaDelDia: false }
}
