import { useId, useState } from 'react'
import { Box, ButtonBase, Collapse, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { parrafosDe, type BloquePreguntas as Datos } from '../../lib/api/contenido'
import { anchoMaximo, siDe, valorDe } from './presentacion'
import { MARCA, alfa } from '../../theme/marca'

/**
 * Preguntas plegables: la pregunta a la vista y la respuesta al pulsarla.
 *
 * Cada pregunta es un botón con `aria-expanded` que controla su respuesta (el
 * patrón de divulgación), dentro de un encabezado para que se pueda saltar de
 * una a otra con el lector de pantalla. La respuesta es texto plano con los
 * párrafos separados por una línea en blanco.
 */
export default function BloquePreguntas({ bloque }: { bloque: Datos }) {
  const tarjetas = valorDe(bloque, 'estilo') === 'tarjetas'
  const [abiertas, setAbiertas] = useState<Set<number>>(() => (siDe(bloque, 'abrirPrimera') ? new Set([0]) : new Set()))
  const base = useId()
  const alternar = (i: number) => setAbiertas((antes) => {
    const despues = new Set(antes)
    if (despues.has(i)) despues.delete(i)
    else despues.add(i)
    return despues
  })

  return (
    <Box sx={{ maxWidth: anchoMaximo(bloque, '850px'), mx: 'auto', display: 'grid', gap: tarjetas ? 1.5 : 0 }}>
      {bloque.preguntas.map((item, i) => {
        const abierta = abiertas.has(i)
        const idBoton = `${base}-p${i}`
        const idRespuesta = `${base}-r${i}`
        return (
          <Box key={i} sx={tarjetas
            ? { border: '1px solid', borderColor: abierta ? alfa(MARCA.acento, 0.4) : 'divider', borderRadius: '8px', px: { xs: 2, md: 3 }, transition: 'border-color .2s ease' }
            : { borderTop: i === 0 ? 0 : '1px solid', borderColor: 'divider' }}>
            <Typography component="h3" sx={{ m: 0 }}>
              <ButtonBase id={idBoton} aria-expanded={abierta} aria-controls={idRespuesta} onClick={() => alternar(i)}
                sx={{
                  width: '100%', justifyContent: 'space-between', gap: 2, py: 2.25, textAlign: 'left',
                  fontFamily: 'inherit', fontSize: '1.05rem', fontWeight: 600, color: 'text.primary',
                  '&:hover': { color: 'secondary.main' }, '&.Mui-focusVisible': { outline: `2px solid ${MARCA.acento}`, outlineOffset: 2 },
                }}>
                <span>{item.pregunta}</span>
                <ExpandMoreIcon aria-hidden sx={{ flexShrink: 0, color: 'secondary.main', transition: 'transform .2s ease', transform: abierta ? 'rotate(180deg)' : 'none' }} />
              </ButtonBase>
            </Typography>
            <Collapse in={abierta}>
              <Box id={idRespuesta} role="region" aria-labelledby={idBoton} sx={{ pb: 2.5 }}>
                {parrafosDe(item.respuesta).map((parrafo, j) => (
                  <Typography key={j} sx={{ color: 'text.secondary', lineHeight: 1.75, mb: 1.5, '&:last-of-type': { mb: 0 } }}>{parrafo}</Typography>
                ))}
              </Box>
            </Collapse>
          </Box>
        )
      })}
    </Box>
  )
}
