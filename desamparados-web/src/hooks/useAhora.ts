import { useState } from 'react'

/**
 * El momento en que se montó el componente, fijo mientras dure. Leer la hora
 * al pintar da un valor distinto en cada pintado, y el compilador de React
 * cuenta con que pintar dos veces dé lo mismo: la memoización podría quedarse
 * con un «hoy» y enseñar otro al lado.
 *
 * `dado` es el que trae quien lo pinta (las pruebas fijan así el día); sin él,
 * el de ahora.
 */
export function useAhora(dado?: Date): Date {
  const [ahora] = useState(() => new Date())
  return dado ?? ahora
}
