/**
 * El escudo y el nombre de la corporación en la barra. Desde el 13-11-2026 el
 * nombre que se ve es el de la barra («Nombre Localidad»), y por eso el hero
 * ya no enseña su título; la clase («Grupo Parroquial») sigue en el hero, como
 * antetítulo encima del párrafo.
 *
 * Desde el 28-11-2026, si la corporación ha subido su rótulo (el nombre en
 * imagen, en Marca), va ese tal cual en lugar del nombre escrito: es su letra
 * de siempre y no hay tipografía que la imite. Sin rótulo, el nombre escrito.
 *
 * Dos formas: la de escritorio, centrada en el piso de arriba y con el nombre
 * corto y la localidad, y la del móvil, a la izquierda y con el nombre corto. La del
 * móvil la pinta también la cabecera del cajón, que calca la barra.
 */
import { Link } from 'react-router-dom'
import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import EscudoDelGrupo from '../EscudoDelGrupo'
import { compactMq, estrechoMq } from './estilos'
import { site } from '../../config/site'
// La serif de la agenda: importarla de ahí trae también sus ficheros de letra.
import { CORMORANT } from '../../features/actualidad/agenda/letraAlmanaque'

/** El nombre corto y la localidad («Nombre Localidad»), el de la portada de siempre. */
const NOMBRE_DE_LA_BARRA = [site.nombreCorto, site.entidad.localidad].filter(Boolean).join(' ')

/**
 * El rótulo, dimensionado por el alto como el escudo. Muy apaisado: si no cabe
 * a lo ancho (un móvil estrecho) se encoge dentro de su caja sin deformarse.
 * Su texto alternativo es el nombre, que es lo que dice.
 */
function Rotulo({ src, alto, sx }: { src: string; alto: number; sx?: SxProps<Theme> }) {
  return (
    <Box
      component="img"
      src={src}
      alt={NOMBRE_DE_LA_BARRA}
      sx={{ height: alto, width: 'auto', maxWidth: '100%', minWidth: 0, objectFit: 'contain', objectPosition: 'left center', display: 'block', ...sx }}
    />
  )
}

export function MarcaEscritorio() {
  const rotulo = site.imagenes.rotulo
  return (
    <Box
      component={Link}
      to="/"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '5px',
        minWidth: 0,
        color: 'text.primary',
        textDecoration: 'none',
        '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 4 },
      }}
    >
      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1.75, minWidth: 0 }}>
        <EscudoDelGrupo alto={36} sx={{ [compactMq]: { height: 34 }, [estrechoMq]: { height: 32 } }} />
        {rotulo ? (
          <Rotulo src={rotulo} alto={16} sx={{ [estrechoMq]: { height: 15 } }} />
        ) : (
          <Box
            component="span"
            sx={{
              fontFamily: CORMORANT,
              fontWeight: 600,
              fontSize: 22,
              lineHeight: 1,
              // Un nombre largo de otra corporación puede no caber en una línea:
              // pasa a dos, equilibradas.
              textWrap: 'balance',
              textAlign: 'center',
              [compactMq]: { fontSize: 21 },
              [estrechoMq]: { fontSize: 19 },
            }}
          >
            {NOMBRE_DE_LA_BARRA}
          </Box>
        )}
      </Box>
    </Box>
  )
}

export function MarcaMovil({ alPulsar }: { alPulsar?: () => void }) {
  const rotulo = site.imagenes.rotulo
  return (
    <Box
      component={Link}
      to="/"
      onClick={alPulsar}
      sx={{ display: 'flex', alignItems: 'center', gap: 1.375, minWidth: 0, color: 'text.primary', textDecoration: 'none' }}
    >
      <EscudoDelGrupo alto={38} />
      {rotulo ? (
        <Rotulo src={rotulo} alto={15} />
      ) : (
        <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 }}>
          <Box
            component="span"
            sx={{ fontFamily: CORMORANT, fontWeight: 600, fontSize: 25, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {site.nombreCorto}
          </Box>
        </Box>
      )}
    </Box>
  )
}

/**
 * El filete dorado bajo la barra del móvil, con los mismos márgenes que el
 * contenido: sustituye a la raya gris de lado a lado.
 */
export function FileteMovil() {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        left: { xs: 20, md: 64 },
        right: { xs: 20, md: 64 },
        bottom: 0,
        height: '1px',
        bgcolor: 'secondary.main',
        opacity: 0.45,
      }}
    />
  )
}
