import { Box } from '@mui/material'

/** Fondo de página: la foto se funde a él por arriba y por abajo de la ventana. */
const FONDO = '#121113'
/** La foto apenas se intuye: es un velo, no una foto que competir con el texto. */
const OPACIDAD = 0.16

// El srcset solo vale para la foto que viene en el repositorio, que existe en
// dos tamaños. Una foto subida desde el CMS es un solo fichero.
const FONDO_DEL_REPOSITORIO = '/images/hero-1920.webp'
const SRCSET_DEL_REPOSITORIO = '/images/hero-960.webp 960w, /images/hero-1920.webp 1920w'

/**
 * La foto velada detrás de toda una página. La caja de la foto es pegajosa
 * dentro de un contenedor que abarca la página entera: se queda quieta a la
 * altura de la ventana mientras el texto pasa por encima, y se va con la
 * página al llegar al pie, sin pisarlo. El contenedor recorta con `clip` y no
 * con `hidden`: un `hidden` haría de caja de scroll y la foto dejaría de
 * pegarse a la ventana. Es decorativa: sin alt y fuera del árbol accesible.
 *
 * En un recorte pequeño (la vista previa del CMS) se le pasa `altura: '100%'`:
 * el velo y sus fundidos se reparten por el recuadro en vez de por una
 * ventana entera, que allí dejaría solo el tramo oscuro de arriba.
 *
 * Quien lo use tiene que envolver la página en una caja `position: relative`
 * con `isolation: 'isolate'`, para que el `zIndex: -1` se quede dentro de ella
 * y no se vaya por detrás del fondo del documento.
 */
export default function FondoDePagina({ url, altura = '100svh' }: { url: string; altura?: string }) {
  const esLaDelRepositorio = url === FONDO_DEL_REPOSITORIO
  return (
    <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, zIndex: -1, overflow: 'clip', pointerEvents: 'none' }}>
      <Box sx={{ position: 'sticky', top: 0, height: altura }}>
        <Box
          component="img"
          src={url}
          srcSet={esLaDelRepositorio ? SRCSET_DEL_REPOSITORIO : undefined}
          sizes={esLaDelRepositorio ? '100vw' : undefined}
          alt=""
          decoding="async"
          fetchPriority="low"
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            // Corona y rostro a la vista en cualquier ventana con la foto del
            // repositorio (el rostro está al 40 % de su ancho); con otra foto,
            // un encuadre alto-centrado es lo que mejor aguanta.
            objectPosition: esLaDelRepositorio ? '40% 28%' : '50% 30%',
            opacity: OPACIDAD,
            filter: 'saturate(0.85)',
          }}
        />
        <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${FONDO} 0%, transparent 24%, transparent 72%, ${FONDO} 100%)` }} />
      </Box>
    </Box>
  )
}
