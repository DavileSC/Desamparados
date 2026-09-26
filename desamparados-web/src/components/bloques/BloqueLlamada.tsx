import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import Boton from '../Boton'
import TarjetaCristal from '../TarjetaCristal'
import { anchoMaximo, valorDe } from './presentacion'
import type { BloqueLlamada as Datos } from '../../lib/api/contenido'
import { esDestinoValido } from '../../lib/destinos'

/** El botón de cada color. `granate` es el de siempre. */
const VARIANTE_BOTON = { granate: 'primary', dorado: 'secondary', contorno: 'outline' } as const

/**
 * Un texto y un botón que lleva a otra página del sitio: en un recuadro sin
 * borde (el de siempre), entre dos filetes a lo ancho (franja) o sin nada
 * alrededor (sencilla).
 *
 * El destino siempre es interno (lo exige `bloques.schema.ts`), así que se
 * navega con el `Link` del router y no con un `<a>`: recargar la aplicación
 * entera para ir a otra página nuestra perdería la caché y el desplazamiento.
 *
 * El título del bloque lo pinta `BloquesDePagina` encima, como en los demás.
 */
export default function BloqueLlamada({ bloque }: { bloque: Datos }) {
  const estilo = valorDe(bloque, 'estilo')
  const izquierda = valorDe(bloque, 'alineacion') === 'izquierda'
  const variante = VARIANTE_BOTON[valorDe(bloque, 'boton') as keyof typeof VARIANTE_BOTON] ?? 'primary'

  const contenido = (
    <>
      {bloque.texto && (
        <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8, mb: 3, fontSize: estilo === 'franja' ? '1.15rem' : undefined }}>
          {bloque.texto}
        </Typography>
      )}
      {/* Sin destino que exista, sin botón: llevaría a «página no encontrada». */}
      {esDestinoValido(bloque.enlace) && (
        <Box>
          <Boton component={Link} to={bloque.enlace} appVariant={variante}>{bloque.boton}</Boton>
        </Box>
      )}
    </>
  )

  const comun = { maxWidth: anchoMaximo(bloque, '850px'), mx: 'auto', textAlign: izquierda ? 'left' : 'center' } as const

  if (estilo === 'franja') {
    return (
      <Box sx={{ ...comun, py: { xs: 4, md: 5 }, borderTop: '1px solid rgba(222, 199, 43, 0.4)', borderBottom: '1px solid rgba(222, 199, 43, 0.4)' }}>
        {contenido}
      </Box>
    )
  }
  if (estilo === 'sencilla') return <Box sx={comun}>{contenido}</Box>
  return (
    <TarjetaCristal sx={{ ...comun, p: { xs: 3, md: 5 } }}>
      {contenido}
    </TarjetaCristal>
  )
}
