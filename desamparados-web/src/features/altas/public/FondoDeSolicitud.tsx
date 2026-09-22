/**
 * El decorado de la solicitud: la Virgen velada detrás del formulario y los
 * dos degradados que la funden con el fondo de página.
 *
 * Es la foto de siempre del hero, a su alto completo para que corona y rostro
 * entren enteros en cualquier ventana: a sangre y ampliada, en una pantalla
 * apaisada solo cabía la mitad de arriba y los ojos quedaban en el borde. En
 * escritorio ocupa la columna del texto y se funde al fondo antes de la
 * tarjeta; en móvil va a todo el ancho y la tarjeta tinta el resto. Arriba y
 * abajo se funde al fondo de página, para que no se note el corte con la barra
 * ni con el pie.
 *
 * Está aparte porque es solo eso, decorado: la pantalla del alta se queda con
 * los pasos y los campos.
 */
import { Box } from '@mui/material'

/** Fondo de página: la foto se funde a él en los bordes. */
const FONDO = '#262326'
const FONDO_VELO = 'rgba(38, 35, 38, 0.55)'
const FONDO_VELO_LEVE = 'rgba(38, 35, 38, 0.25)'
/** Presencia leve: se intuye la corona y el rostro, sin competir con el texto. */
const OPACIDAD_VIRGEN = 0.18

export default function FondoDeSolicitud() {
  return (
    <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, zIndex: -1, overflow: 'hidden', pointerEvents: 'none' }}>
      <Box
        component="img"
        src="/images/hero-1920.webp"
        srcSet="/images/hero-960.webp 960w, /images/hero-1920.webp 1920w"
        sizes="(min-width: 900px) 60vw, 100vw"
        alt=""
        decoding="async"
        fetchPriority="low"
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: { xs: '100%', md: '60%' },
          maxWidth: 'none',
          objectFit: 'cover',
          // El rostro está al 40 % del ancho de la foto: alineado con el
          // 40 % de su caja queda bajo el texto, no bajo la tarjeta.
          objectPosition: '40% 50%',
          opacity: OPACIDAD_VIRGEN,
          filter: 'saturate(0.85)',
        }}
      />
      <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${FONDO} 0%, transparent 22%, transparent 76%, ${FONDO} 100%)` }} />
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: {
            xs: `linear-gradient(90deg, ${FONDO_VELO_LEVE} 0%, transparent 30%, ${FONDO_VELO} 100%)`,
            md: `linear-gradient(90deg, ${FONDO_VELO_LEVE} 0%, transparent 20%, transparent 32%, ${FONDO} 60%)`,
          },
        }}
      />
    </Box>
  )
}
