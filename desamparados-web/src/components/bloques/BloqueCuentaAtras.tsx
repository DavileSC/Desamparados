import { useEffect, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { SERIF } from '../../features/inicio/estilos'
import { valorDe } from './presentacion'
import { instanteEnMadrid } from './fechas'
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

  const compacta = valorDe(bloque, 'estilo') === 'compacta'
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
            {`Faltan ${dias} días para el ${fechaLegible}.`}
          </Typography>
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
          <Typography variant="body2" sx={{ mt: 3, color: 'text.secondary', '&::first-letter': { textTransform: 'uppercase' } }}>{fechaLegible}</Typography>
        </>
      )}
    </Box>
  )
}
