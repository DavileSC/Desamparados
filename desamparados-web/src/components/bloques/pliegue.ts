import { createContext } from 'react'

/**
 * Lo que un pliegue necesita saber de la página: si su parte está abierta,
 * cómo abrirla o cerrarla y el id de la parte que controla. Lo pone
 * `BloquesDePagina`, que es quien sabe qué bloques van dentro. Sin él (un
 * pliegue suelto en la vista previa de un bloque), se pinta abierto y quieto.
 */
export const PliegueContext = createContext<{ abierta: boolean; alternar: () => void; idParte: string } | null>(null)

/**
 * Dentro de una parte plegada, el título de cada bloque es un subtítulo: el de
 * la sección es el del pliegue. Lo lee `BloquesDePagina` para pintarlo pequeño.
 */
export const DentroDePliegueContext = createContext(false)
