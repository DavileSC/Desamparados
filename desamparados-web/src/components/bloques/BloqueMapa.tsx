import { useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import DirectionsOutlinedIcon from '@mui/icons-material/DirectionsOutlined'
import { useConsentimientoDeCookies } from '../../hooks/useConsentimientoDeCookies'
import { urlDelMapa } from '../../features/actualidad/agenda/cultos'
import { SERIF } from '../../features/inicio/estilos'
import { parrafosDe } from '../../lib/api/contenido'
import { anchoMaximo, valorDe } from './presentacion'
import type { BloqueMapa as Datos } from '../../lib/api/contenido'

const ALTOS = { bajo: 260, medio: 380, alto: 520 } as const

/**
 * Un mapa de Google con un lugar, y el enlace para llegar.
 *
 * RGPD, como el mapa del pie: el marco de Google envía la IP del visitante,
 * así que no se carga hasta que ha aceptado las cookies o pulsa «Mostrar el
 * mapa». Hasta entonces, un recuadro que lo explica. En oscuro lleva el mismo
 * filtro que el del pie, para que no sea un fogonazo blanco en la página.
 *
 * «Datos al lado»: el mapa a un lado y, al otro, el lugar en grande, la
 * dirección, las indicaciones y el botón para llegar. Así la dirección no es
 * una línea suelta debajo del mapa. En el móvil, los datos van encima.
 */
export default function BloqueMapa({ bloque }: { bloque: Datos }) {
  const { aceptadas } = useConsentimientoDeCookies()
  const [pedido, setPedido] = useState(false)
  const alto = ALTOS[valorDe(bloque, 'alto') as keyof typeof ALTOS] ?? ALTOS.medio
  const oscuro = valorDe(bloque, 'estilo') === 'oscuro'
  const direccion = bloque.direccion.trim()
  if (!direccion) return null
  const llegar = urlDelMapa(direccion)
  const titulo = bloque.lugar || direccion

  const marco = (
    <Box sx={{
      height: alto, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider',
      display: 'grid', placeItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)',
    }}>
      {aceptadas || pedido ? (
        <Box component="iframe" title={`Mapa: ${titulo}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
          src={`https://www.google.com/maps?q=${encodeURIComponent(direccion)}&output=embed`}
          style={{ border: 0, filter: oscuro ? 'grayscale(100%) invert(92%) contrast(83%)' : undefined }}
          sx={{ width: '100%', height: '100%' }} />
      ) : (
        <Box sx={{ textAlign: 'center', px: 3 }}>
          <MapOutlinedIcon sx={{ fontSize: 36, color: 'text.secondary', mb: 1 }} />
          <Typography sx={{ color: 'text.secondary', fontSize: 14, mb: 1.5, maxWidth: 360 }}>
            Al mostrar el mapa, tu IP se envía a Google.
          </Typography>
          <Button variant="outlined" color="secondary" onClick={() => setPedido(true)}>Mostrar el mapa</Button>
        </Box>
      )}
    </Box>
  )
  const botonLlegar = llegar && (
    <Button component="a" href={llegar} target="_blank" rel="noopener noreferrer" startIcon={<DirectionsOutlinedIcon />} color="secondary">
      Cómo llegar
    </Button>
  )
  const indicaciones = parrafosDe(bloque.indicaciones ?? '')

  if (valorDe(bloque, 'disposicion') === 'lado') {
    return (
      <Box sx={{
        maxWidth: anchoMaximo(bloque, '1100px'), mx: 'auto',
        display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1.6fr)' }, gap: { xs: 3, md: 6 }, alignItems: 'center',
      }}>
        <Box>
          {bloque.lugar && (
            <Typography sx={{ fontFamily: SERIF, fontSize: { xs: 28, md: 34 }, lineHeight: 1.15, color: 'text.primary', mb: 1.5 }}>{bloque.lugar}</Typography>
          )}
          <Typography sx={{ color: 'text.primary', fontSize: 17, lineHeight: 1.6 }}>{direccion}</Typography>
          {indicaciones.map((parrafo, i) => (
            <Typography key={i} sx={{ color: 'text.secondary', fontSize: 15.5, lineHeight: 1.7, mt: 2 }}>{parrafo}</Typography>
          ))}
          {botonLlegar && <Box sx={{ mt: 3, ml: -1 }}>{botonLlegar}</Box>}
        </Box>
        {marco}
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: anchoMaximo(bloque, '1100px'), mx: 'auto' }}>
      {marco}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, mt: 2 }}>
        <Box>
          {bloque.lugar && <Typography sx={{ color: 'text.primary', fontWeight: 600 }}>{bloque.lugar}</Typography>}
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{direccion}</Typography>
          {indicaciones.map((parrafo, i) => (
            <Typography key={i} variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>{parrafo}</Typography>
          ))}
        </Box>
        {botonLlegar}
      </Box>
    </Box>
  )
}
