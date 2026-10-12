import { Box } from '@mui/material'
import { propsDeFoto } from '../lib/fotoSubida'
import { FOTO_DE_SIEMPRE } from '../config/fotosDeLaInstalacion'
import { useFotoQueFalla } from '../hooks/useFotoQueFalla'

/** Fondo de página: la foto se funde a él por arriba y por abajo de la ventana. */
const FONDO = '#121113'
/** La foto apenas se intuye: es un velo, no una foto que competir con el texto. */
const OPACIDAD = 0.16

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
 *
 * Si la foto no está (una fija que esta instalación no tiene, o una borrada),
 * se quita y queda el fondo liso: es decorado, y un hueco no se nota.
 */
export default function FondoDePagina({ url, altura = '100svh' }: { url: string; altura?: string }) {
  const esLaDeSiempre = url === FOTO_DE_SIEMPRE
  const { visible, alFallar } = useFotoQueFalla(url)
  if (!visible) return null
  return (
    <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, zIndex: -1, overflow: 'clip', pointerEvents: 'none' }}>
      <Box sx={{ position: 'sticky', top: 0, height: altura }}>
        <Box
          component="img"
          {...propsDeFoto(url, '100vw', alFallar)}
          alt=""
          decoding="async"
          fetchPriority="low"
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            // Corona y rostro a la vista en cualquier ventana con la foto de
            // siempre (el rostro está al 40 % de su ancho); con otra foto, un
            // encuadre alto-centrado es lo que mejor aguanta.
            objectPosition: esLaDeSiempre ? '40% 28%' : '50% 30%',
            opacity: OPACIDAD,
            filter: 'saturate(0.85)',
          }}
        />
        <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${FONDO} 0%, transparent 24%, transparent 72%, ${FONDO} 100%)` }} />
      </Box>
    </Box>
  )
}
