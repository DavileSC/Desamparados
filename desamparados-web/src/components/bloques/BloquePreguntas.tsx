import { useId, useState } from 'react'
import { Box, ButtonBase, Collapse, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { parrafosDe, type BloquePreguntas as Datos } from '../../lib/api/contenido'
import { anchoMaximo, siDe, valorDe } from './presentacion'
import { MARCA, alfa } from '../../theme/marca'
import { SERIF } from '../../features/inicio/estilos'

/** Qué preguntas están abiertas: ninguna, o la primera si el bloque lo pide. */
function useAbiertas(bloque: Datos) {
  const [abiertas, setAbiertas] = useState<Set<number>>(() => (siDe(bloque, 'abrirPrimera') ? new Set([0]) : new Set()))
  const alternar = (i: number) => setAbiertas((antes) => {
    const despues = new Set(antes)
    if (despues.has(i)) despues.delete(i)
    else despues.add(i)
    return despues
  })
  return { abiertas, alternar }
}

/**
 * Preguntas plegables: la pregunta a la vista y la respuesta al pulsarla.
 *
 * Cada pregunta es un botón con `aria-expanded` que controla su respuesta (el
 * patrón de divulgación), dentro de un encabezado para que se pueda saltar de
 * una a otra con el lector de pantalla. La respuesta es texto plano con los
 * párrafos separados por una línea en blanco.
 */
export default function BloquePreguntas({ bloque }: { bloque: Datos }) {
  // Cada estilo en su componente: en la vista previa del CMS el estilo cambia
  // en vivo, y un `return` antes de los hooks cambiaría su orden.
  const estilo = valorDe(bloque, 'estilo')
  return estilo === 'numeradas' ? <Numeradas bloque={bloque} /> : <Lineas bloque={bloque} tarjetas={estilo === 'tarjetas'} />
}

/** Líneas (el de siempre) o tarjetas: la pregunta en el cuerpo de texto, con su flecha. */
function Lineas({ bloque, tarjetas }: { bloque: Datos; tarjetas: boolean }) {
  const { abiertas, alternar } = useAbiertas(bloque)
  const base = useId()

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

/**
 * Numeradas (Evangelización, 27-11-2026): cada pregunta en grande, en la letra
 * de los titulares, con su número en oro delante y un «+» en un cuadro que se
 * gira hasta «×» al abrirla. La respuesta entra por debajo, alineada con la
 * pregunta y no con el número. Abren una página contestando lo que la gente
 * pregunta, así que van a todo el ancho de la columna, como su título.
 *
 * Una abierta no cierra las demás: quien compara dos respuestas las quiere
 * ver a la vez.
 */
function Numeradas({ bloque }: { bloque: Datos }) {
  const { abiertas, alternar } = useAbiertas(bloque)
  const base = useId()
  const filete = '1px solid rgba(255, 255, 255, 0.2)'
  return (
    <Box sx={{ maxWidth: anchoMaximo(bloque, 'none'), mx: 'auto', borderTop: filete }}>
      {bloque.preguntas.map((item, i) => {
        const abierta = abiertas.has(i)
        const idBoton = `${base}-p${i}`
        const idRespuesta = `${base}-r${i}`
        return (
          <Box key={i} sx={{ borderBottom: filete }}>
            <Typography component="h3" sx={{ m: 0 }}>
              <ButtonBase id={idBoton} aria-expanded={abierta} aria-controls={idRespuesta} onClick={() => alternar(i)}
                sx={{
                  width: '100%', display: 'grid', gridTemplateColumns: { xs: '36px minmax(0, 1fr) 36px', md: '72px minmax(0, 1fr) 40px' },
                  alignItems: 'center', gap: 2, py: { xs: 2.75, md: 3.5 }, textAlign: 'left', color: 'text.primary',
                  '&:hover .mas': { borderColor: MARCA.acento },
                  '&.Mui-focusVisible': { outline: `2px solid ${MARCA.acento}`, outlineOffset: 4 },
                }}>
                <Box component="span" aria-hidden sx={{ fontFamily: SERIF, fontSize: { xs: 18, md: 22 }, color: MARCA.acento }}>
                  {String(i + 1).padStart(2, '0')}
                </Box>
                <Box component="span" sx={{ fontFamily: SERIF, fontWeight: 600, fontSize: { xs: 24, md: 38 }, lineHeight: 1.12, textWrap: 'balance' }}>
                  {item.pregunta}
                </Box>
                <Box component="span" className="mas" aria-hidden sx={{
                  width: { xs: 36, md: 40 }, height: { xs: 36, md: 40 }, display: 'grid', placeItems: 'center',
                  border: '1px solid', borderColor: abierta ? MARCA.acento : 'rgba(255, 255, 255, 0.3)', color: abierta ? MARCA.acento : 'inherit',
                  fontSize: 22, lineHeight: 1, transition: 'border-color .2s ease',
                }}>
                  {/* Gira el signo y no el cuadro: el cuadro girado sería un rombo. */}
                  <Box component="span" sx={{
                    display: 'block', transition: 'transform .25s ease', transform: abierta ? 'rotate(45deg)' : 'rotate(0deg)',
                    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                  }}>+</Box>
                </Box>
              </ButtonBase>
            </Typography>
            <Collapse in={abierta}>
              <Box id={idRespuesta} role="region" aria-labelledby={idBoton}
                sx={{ pl: { xs: '52px', md: '88px' }, pr: { xs: 0, md: 7 }, pb: { xs: 3, md: 4 }, maxWidth: 960 }}>
                {parrafosDe(item.respuesta).map((parrafo, j) => (
                  <Typography key={j} sx={{ color: 'text.secondary', fontSize: { xs: 16, md: 18 }, lineHeight: 1.7, mb: 1.5, '&:last-of-type': { mb: 0 } }}>{parrafo}</Typography>
                ))}
              </Box>
            </Collapse>
          </Box>
        )
      })}
    </Box>
  )
}
