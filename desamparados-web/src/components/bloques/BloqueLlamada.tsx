import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import Boton from '../Boton'
import TarjetaCristal from '../TarjetaCristal'
import { anchoMaximo, valorDe } from './presentacion'
import { PAPEL, SERIF } from '../../features/inicio/estilos'
import type { BloqueLlamada as Datos } from '../../lib/api/contenido'
import { useEnlaceVivo } from '../../hooks/useEnlaceVivo'
import { MARCA, alfa } from '../../theme/marca'

/** El botón de cada color. `granate` es el de siempre. */
const VARIANTE_BOTON = { granate: 'primary', dorado: 'secondary', contorno: 'outline' } as const

/**
 * Un texto y un botón que lleva a otra página del sitio: en un recuadro sin
 * borde (el de siempre), entre dos filetes a lo ancho (franja), sin nada
 * alrededor (sencilla) o en una fila, el texto a un lado y el botón al otro
 * (fila), o en una nota crema de esquinas redondeadas, con el título a un
 * lado y el texto y el botón al otro (nota, la de Vida).
 *
 * El destino siempre es interno (lo exige `bloques.schema.ts`), así que se
 * navega con el `Link` del router y no con un `<a>`: recargar la aplicación
 * entera para ir a otra página nuestra perdería la caché y el desplazamiento.
 *
 * El título del bloque lo pinta `BloquesDePagina` encima, como en los demás.
 */
export default function BloqueLlamada({ bloque }: { bloque: Datos }) {
  const enlaceVivo = useEnlaceVivo()
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
      {enlaceVivo(bloque.enlace) && (
        <Box>
          <Boton component={Link} to={bloque.enlace} appVariant={variante}>{bloque.boton}</Boton>
        </Box>
      )}
    </>
  )

  const comun = { maxWidth: anchoMaximo(bloque, '850px'), mx: 'auto', textAlign: izquierda ? 'left' : 'center' } as const

  if (estilo === 'franja') {
    return (
      <Box sx={{ ...comun, py: { xs: 4, md: 5 }, borderTop: `1px solid ${alfa(MARCA.acento, 0.4)}`, borderBottom: `1px solid ${alfa(MARCA.acento, 0.4)}` }}>
        {contenido}
      </Box>
    )
  }
  if (estilo === 'sencilla') return <Box sx={comun}>{contenido}</Box>
  if (estilo === 'fila') {
    return (
      <Box sx={{
        maxWidth: anchoMaximo(bloque, '1200px'), mx: 'auto',
        display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between', gap: { xs: 3, md: 6 },
      }}>
        {bloque.texto && (
          <Typography sx={{ maxWidth: 720, fontSize: { xs: 21, md: 26 }, lineHeight: 1.45, fontWeight: 300, color: 'text.primary' }}>
            {bloque.texto}
          </Typography>
        )}
        {enlaceVivo(bloque.enlace) && (
          <Box sx={{ flexShrink: 0 }}>
            <Boton component={Link} to={bloque.enlace} appVariant={variante}>{bloque.boton}</Boton>
          </Box>
        )}
      </Box>
    )
  }
  if (estilo === 'nota') {
    // Crema sobre la página oscura: la tinta va escrita aquí, no la del tema.
    return (
      <Box sx={{
        maxWidth: anchoMaximo(bloque, '1200px'), mx: 'auto', backgroundColor: PAPEL, color: '#2a1418',
        borderRadius: { xs: '22px', md: '32px' }, px: { xs: 3, md: 10 }, py: { xs: 5, md: 9 },
        display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1.2fr)' }, gap: { xs: 3, md: 8 }, alignItems: 'center',
      }}>
        {bloque.titulo && (
          <Typography component="h2" sx={{ fontFamily: SERIF, fontWeight: 600, fontSize: { xs: 34, md: 48 }, lineHeight: 1.05, color: '#2a1418' }}>{bloque.titulo}</Typography>
        )}
        <Box>
          {bloque.texto && <Typography sx={{ fontSize: { xs: 16, md: 18 }, lineHeight: 1.7, color: '#4a3433', mb: 3 }}>{bloque.texto}</Typography>}
          {enlaceVivo(bloque.enlace) && <Boton component={Link} to={bloque.enlace} appVariant={variante}>{bloque.boton}</Boton>}
        </Box>
      </Box>
    )
  }
  return (
    <TarjetaCristal sx={{ ...comun, p: { xs: 3, md: 5 } }}>
      {contenido}
    </TarjetaCristal>
  )
}
