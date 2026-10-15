import type { ReactNode } from 'react'

/**
 * Los iconos de las teselas de accesos, dibujados para el Grupo (forma A,
 * «Grabado», de la maqueta del 16-10-2026). Trazo fino y puntas en ángulo
 * recto, como las líneas del escudo: los de librería, siempre redondeados,
 * daban a la portada el aspecto de cualquier otra web.
 *
 * Miden 1em y toman el color del texto, como los de MUI a los que sustituyen.
 */
function Grabado({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      {children}
    </svg>
  )
}

/** La espadaña de la parroquia, con su campana y su puerta. */
export const IconoSede = () => (
  <Grabado>
    <path d="M4 21H20M6 21V10.2L12 5.2L18 10.2V21M12 5.2V2M10.6 3.3H13.4M10.2 13.2V10.8A1.8 1.8 0 0 1 13.8 10.8V13.2ZM10.6 21V18.2A1.4 1.4 0 0 1 13.4 18.2V21" />
  </Grabado>
)

/** Unas manos que dan, con el corazón encima. */
export const IconoCaridad = () => (
  <Grabado>
    <path d="M12 12.5C8.5 10.2 7.5 8.6 7.5 7.2C7.5 5.9 8.5 5 9.7 5C10.7 5 11.5 5.6 12 6.4C12.5 5.6 13.3 5 14.3 5C15.5 5 16.5 5.9 16.5 7.2C16.5 8.6 15.5 10.2 12 12.5Z" />
    <path d="M2.5 15H6C7 15 8 15.4 9 16L10.2 16.7H13.6C14.4 16.7 14.9 17.2 14.9 17.9C14.9 18.6 14.4 19.1 13.6 19.1H10.4M14.8 17.6L18.6 15.7C19.4 15.3 20.3 15.7 20.5 16.5C20.6 17.1 20.3 17.6 19.8 17.9L14.6 20.7C14 21 13.4 21.1 12.8 21.1H6L2.5 21.1" />
  </Grabado>
)

/** Un pergamino enrollado. */
export const IconoHistoria = () => (
  <Grabado>
    <path d="M8.5 4H18.5A1.75 1.75 0 0 1 18.5 7.5H17M8.5 4A1.75 1.75 0 0 0 7 5.75V17M17 4.6V17M17 17H5.5A1.75 1.75 0 0 0 5.5 20.5H15.5A1.75 1.75 0 0 0 17 17ZM9.5 9.5H14.5M9.5 12H14.5M9.5 14.5H12.5" />
  </Grabado>
)

/** Un cuaderno abierto: los boletines y anuarios. */
export const IconoBoletines = () => (
  <Grabado>
    <path d="M3 6C6 5 9 5.3 12 7C15 5.3 18 5 21 6V19C18 18 15 18.3 12 20C9 18.3 6 18 3 19ZM12 7V20M5.5 9.5C7 9.3 8.5 9.5 9.8 10.1M5.5 12.5C7 12.3 8.5 12.5 9.8 13.1M14.2 10.1C15.5 9.5 17 9.3 18.5 9.5M14.2 13.1C15.5 12.5 17 12.3 18.5 12.5" />
  </Grabado>
)

/** Una pantalla con el triángulo de reproducir: el canal de vídeo. */
export const IconoVideo = () => (
  <Grabado>
    <path d="M3 5.5H21V18.5H3ZM10 9.3L15.2 12L10 14.7Z" />
  </Grabado>
)

/** Una carta. */
export const IconoContacto = () => (
  <Grabado>
    <path d="M3 6H21V18H3ZM3 6L12 12.8L21 6" />
  </Grabado>
)
