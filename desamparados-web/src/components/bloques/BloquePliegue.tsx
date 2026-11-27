import { useContext } from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import { SERIF } from '../../features/inicio/estilos'
import type { BloquePliegue as Datos } from '../../lib/api/contenido'
import { MARCA } from '../../theme/marca'
import { PliegueContext } from './pliegue'

/**
 * Sección plegable (Patrimonio, 27-11-2026): sobria, sin caja ni foto. Un
 * filete encima, el título grande, una frase de qué hay dentro y una flecha
 * fina que se da la vuelta al abrirla. Los bloques que le siguen en la página
 * son su contenido; solo hay una parte abierta a la vez.
 *
 * El título es el botón (`aria-expanded`, `aria-controls`) dentro de un
 * encabezado, como en las preguntas: se salta de una parte a otra con el
 * lector de pantalla.
 */
export default function BloquePliegue({ bloque }: { bloque: Datos }) {
  const pliegue = useContext(PliegueContext)
  const abierta = pliegue?.abierta ?? true
  return (
    <Typography component="h2" sx={{ m: 0 }}>
      <ButtonBase onClick={pliegue?.alternar} disabled={!pliegue} aria-expanded={pliegue ? abierta : undefined} aria-controls={pliegue?.idParte}
        sx={{
          width: '100%', display: 'grid', alignItems: 'baseline', textAlign: 'left', color: 'text.primary',
          gridTemplateColumns: { xs: 'minmax(0, 1fr) 24px', md: 'minmax(0, 1fr) minmax(0, 1fr) 24px' },
          columnGap: { xs: 1.5, md: 4 }, rowGap: 0.75, py: { xs: 3, md: 4.25 },
          '&:hover .titulo': { color: MARCA.acento },
          '&.Mui-focusVisible': { outline: `2px solid ${MARCA.acento}`, outlineOffset: 4 },
          '&.Mui-disabled': { color: 'text.primary' },
        }}>
        <Box component="span" className="titulo" sx={{ fontFamily: SERIF, fontWeight: 500, fontSize: { xs: 32, md: 44 }, lineHeight: 1.1, transition: 'color .2s ease' }}>
          {bloque.titulo}
        </Box>
        {bloque.resumen && (
          <Box component="span" sx={{ gridColumn: { xs: 1, md: 2 }, gridRow: { xs: 2, md: 1 }, fontSize: { xs: 14, md: 16 }, lineHeight: 1.5, color: 'text.secondary', fontWeight: 400 }}>
            {bloque.resumen}
          </Box>
        )}
        <Box component="svg" viewBox="0 0 24 24" aria-hidden sx={{
          gridColumn: { xs: 2, md: 3 }, gridRow: { xs: '1 / span 2', md: 1 }, alignSelf: 'center',
          width: 22, height: 22, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
          color: abierta ? MARCA.acento : 'text.secondary', transform: abierta ? 'rotate(180deg)' : 'none',
          transition: 'transform .25s ease', '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        }}>
          <path d="M5 9l7 7 7-7" />
        </Box>
      </ButtonBase>
    </Typography>
  )
}
