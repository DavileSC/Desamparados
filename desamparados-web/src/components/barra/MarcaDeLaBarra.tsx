/**
 * El escudo y el nombre de la corporación en la barra. Desde el 13-11-2026 el
 * nombre que se ve es el de la barra («Nombre Localidad»), y por eso el hero
 * ya no enseña su título; la clase («Grupo Parroquial») sigue en el hero, como
 * antetítulo encima del párrafo.
 *
 * Dos formas: la de escritorio, centrada en el piso de arriba y con el nombre
 * corto y la localidad, y la del móvil, a la izquierda y con el nombre corto. La del
 * móvil la pinta también la cabecera del cajón, que calca la barra.
 */
import { Link } from 'react-router-dom'
import { Box } from '@mui/material'
import EscudoDelGrupo from '../EscudoDelGrupo'
import { compactMq, estrechoMq } from './estilos'
import { site } from '../../config/site'
// La serif de la agenda: importarla de ahí trae también sus ficheros de letra.
import { CORMORANT } from '../../features/actualidad/agenda/letraAlmanaque'

/** El nombre corto y la localidad («Nombre Localidad»), el de la portada de siempre. */
const NOMBRE_DE_LA_BARRA = [site.nombreCorto, site.entidad.localidad].filter(Boolean).join(' ')

export function MarcaEscritorio() {
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
        <EscudoDelGrupo alto={42} sx={{ [compactMq]: { height: 38 }, [estrechoMq]: { height: 34 } }} />
        <Box
          component="span"
          sx={{
            fontFamily: CORMORANT,
            fontWeight: 600,
            fontSize: 28,
            lineHeight: 1,
            // Un nombre largo de otra corporación puede no caber en una línea:
            // pasa a dos, equilibradas (con 76 px de franja, justas).
            textWrap: 'balance',
            textAlign: 'center',
            [compactMq]: { fontSize: 25 },
            [estrechoMq]: { fontSize: 22 },
          }}
        >
          {NOMBRE_DE_LA_BARRA}
        </Box>
      </Box>
    </Box>
  )
}

export function MarcaMovil({ alPulsar }: { alPulsar?: () => void }) {
  return (
    <Box
      component={Link}
      to="/"
      onClick={alPulsar}
      sx={{ display: 'flex', alignItems: 'center', gap: 1.375, minWidth: 0, color: 'text.primary', textDecoration: 'none' }}
    >
      <EscudoDelGrupo alto={38} />
      <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 }}>
        <Box
          component="span"
          sx={{ fontFamily: CORMORANT, fontWeight: 600, fontSize: 25, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {site.nombreCorto}
        </Box>
      </Box>
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
