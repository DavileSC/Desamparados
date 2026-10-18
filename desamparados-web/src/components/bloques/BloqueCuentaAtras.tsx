import { useEffect, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { useReducedMotion } from 'framer-motion'
import { SERIF } from '../../features/inicio/estilos'
import { valorDe } from './presentacion'
import { instanteEnMadrid } from '../../lib/horaDeMadrid'
import type { BloqueCuentaAtras as Datos } from '../../lib/api/contenido'

/** Lo que falta, en días, horas, minutos y segundos. */
function partesDe(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return { dias: Math.floor(s / 86400), horas: Math.floor((s % 86400) / 3600), minutos: Math.floor((s % 3600) / 60), segundos: s % 60 }
}

/**
 * Cuenta atrás hasta una fecha y hora de Madrid: días, horas, minutos y
 * segundos en grande, con el texto de qué llega encima. Al llegar, en vez de
 * ceros se lee `textoFinal`.
 *
 * Con el estilo «rueda», cada cifra es un rodillo que gira hasta la
 * siguiente, como un marcador de los de antes.
 *
 * Los números cambian cada segundo, pero no se anuncian: un lector de pantalla
 * leyendo la cuenta cada segundo no dejaría oír nada más. Lo que se anuncia
 * es la fecha, una vez, en texto.
 */
export default function BloqueCuentaAtras({ bloque }: { bloque: Datos }) {
  const [ahora, setAhora] = useState(() => Date.now())
  const objetivo = instanteEnMadrid(bloque.fecha)
  useEffect(() => {
    const reloj = window.setInterval(() => setAhora(Date.now()), 1000)
    return () => window.clearInterval(reloj)
  }, [])
  if (objetivo === null) return null

  const estilo = valorDe(bloque, 'estilo')
  const compacta = estilo === 'compacta'
  const llegado = ahora >= objetivo
  const { dias, horas, minutos, segundos } = partesDe(objetivo - ahora)
  const fechaLegible = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' }).format(objetivo)
  const casillas = [
    { valor: dias, nombre: dias === 1 ? 'día' : 'días' },
    { valor: horas, nombre: horas === 1 ? 'hora' : 'horas' },
    { valor: minutos, nombre: 'min' },
    { valor: segundos, nombre: 'seg' },
  ]

  return (
    <Box sx={{ textAlign: 'center', maxWidth: 900, mx: 'auto' }}>
      {bloque.texto && (
        <Typography sx={{ color: 'secondary.main', fontSize: 13, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', mb: 2.5 }}>
          {bloque.texto}
        </Typography>
      )}
      {llegado ? (
        <Typography sx={{ fontFamily: SERIF, fontSize: compacta ? { xs: 26, md: 32 } : { xs: 32, md: 48 }, color: 'text.primary' }}>
          {bloque.textoFinal || '¡Ha llegado el día!'}
        </Typography>
      ) : (
        <>
          <Typography sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            {dias === 0 ? `Falta menos de un día para el ${fechaLegible}.` : `${dias === 1 ? 'Falta un día' : `Faltan ${dias} días`} para el ${fechaLegible}.`}
          </Typography>
          {estilo === 'rueda' ? <Ruedas casillas={casillas} /> : (
          <Box aria-hidden sx={{ display: 'flex', justifyContent: 'center', gap: compacta ? { xs: 2, md: 3 } : { xs: 1.5, sm: 3, md: 5 } }}>
            {casillas.map((casilla) => (
              <Box key={casilla.nombre} sx={{ minWidth: compacta ? 56 : { xs: 64, md: 120 } }}>
                <Typography sx={{
                  fontFamily: SERIF, lineHeight: 1, color: 'text.primary', fontVariantNumeric: 'tabular-nums',
                  fontSize: compacta ? { xs: 30, md: 38 } : { xs: 42, sm: 60, md: 84 },
                }}>
                  {String(casilla.valor).padStart(2, '0')}
                </Typography>
                <Typography sx={{ mt: 1, color: 'text.secondary', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{casilla.nombre}</Typography>
              </Box>
            ))}
          </Box>
          )}
          <Typography variant="body2" sx={{ mt: 3, color: 'text.secondary', '&::first-letter': { textTransform: 'uppercase' } }}>{fechaLegible}</Typography>
        </>
      )}
    </Box>
  )
}

/** El alto de una cifra del rodillo. */
const ALTO_CIFRA = { xs: 46, sm: 84, md: 118 }

/**
 * Los rodillos: una columna de cifras del 0 al 9 detrás de una ventana, que se
 * desplaza hasta la que toca. Los días llevan tantas cifras como hagan falta
 * (tres a más de cien días); lo demás, dos.
 */
function Ruedas({ casillas }: { casillas: { valor: number; nombre: string }[] }) {
  const quieto = useReducedMotion() ?? false
  return (
    <Box aria-hidden sx={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap', gap: { xs: 0.5, sm: 1.5, md: 2.5 } }}>
      {casillas.map((casilla, k) => (
        <Box key={casilla.nombre} sx={{ display: 'flex', alignItems: 'flex-start', gap: { xs: 0.5, sm: 1.5, md: 2.5 } }}>
          {k > 0 && (
            <Typography component="span" sx={{ fontFamily: SERIF, fontWeight: 200, color: 'secondary.main', lineHeight: 1, fontSize: { xs: 24, sm: 52, md: 72 }, pt: { xs: 1, sm: 2, md: 3 } }}>
              :
            </Typography>
          )}
          <Box sx={{ display: 'grid', justifyItems: 'center', gap: 1.25 }}>
            <Box sx={{ display: 'flex', gap: { xs: '3px', sm: '4px' } }}>
              {String(casilla.valor).padStart(2, '0').split('').map((cifra, i, todas) => (
                <Box key={todas.length - i} sx={{
                  position: 'relative', overflow: 'hidden', height: ALTO_CIFRA, width: { xs: 29, sm: 56, md: 78 },
                  border: 1, borderColor: 'divider', backgroundColor: 'action.hover',
                  // La raya del medio, como en los marcadores de lamas.
                  '&::after': { content: '""', position: 'absolute', left: 0, right: 0, top: '50%', borderTop: '1px solid', borderColor: 'divider' },
                }}>
                  <Box sx={{
                    transform: `translateY(${-Number(cifra) * 10}%)`,
                    transition: quieto ? 'none' : 'transform .9s cubic-bezier(.3, 1.3, .5, 1)',
                  }}>
                    {'0123456789'.split('').map((d) => (
                      <Typography key={d} component="span" sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', height: ALTO_CIFRA,
                        fontFamily: SERIF, fontWeight: 300, color: 'text.primary', lineHeight: 1, fontSize: { xs: 28, sm: 56, md: 80 },
                      }}>
                        {d}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>
            <Typography component="span" sx={{ color: 'text.secondary', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase' }}>{casilla.nombre}</Typography>
          </Box>
        </Box>
      ))}
    </Box>
  )
}
