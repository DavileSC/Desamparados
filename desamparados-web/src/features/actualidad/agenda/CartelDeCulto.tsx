import { Box, Typography } from '@mui/material'
import type { ApiEvent } from '../../../lib/api/agenda'
import { GOLD, SERIF } from '../../inicio/estilos'
import { claseDelCartel, cuandoEnCartel, fotoDelCartel, hora, notaDelActo } from './cultos'
import EnlacesDelActo from './EnlacesDelActo'

const ORO_SUAVE = '#c9b25a'

/**
 * Un culto solemne, como un cartel: la foto a un lado y, al otro, qué es,
 * su dedicatoria, cuándo y dónde. En el móvil la foto va arriba.
 */
export default function CartelDeCulto({ evento, sinHora = false }: {
  evento: ApiEvent
  /** Solo en la vista previa del CMS, mientras el acto no tiene hora. */
  sinHora?: boolean
}) {
  const foto = fotoDelCartel(evento)
  const nota = notaDelActo(evento)
  return (
    <Box
      component="article"
      aria-labelledby={`cartel-${evento.id}`}
      sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '42% minmax(0, 1fr)' }, backgroundColor: '#120f11', minHeight: { md: 300 } }}
    >
      <Box sx={{
        position: 'relative', height: { xs: 220, md: 'auto' }, overflow: 'hidden',
        '&::after': {
          content: '""', position: 'absolute', inset: 0,
          background: { xs: 'linear-gradient(180deg, transparent 55%, #120f11)', md: 'linear-gradient(90deg, transparent 55%, #120f11)' },
        },
      }}>
        <Box component="img" src={foto.src} alt={foto.alt} loading="lazy" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }} />
      </Box>
      <Box sx={{ p: { xs: '6px 16px 20px', md: '32px 36px 28px 16px' }, display: 'grid', gap: 1, alignContent: 'center' }}>
        <Typography component="span" sx={{ fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: ORO_SUAVE }}>
          {claseDelCartel(evento)}
        </Typography>
        <Typography id={`cartel-${evento.id}`} component="h3" sx={{ fontFamily: SERIF, fontWeight: 300, fontSize: { xs: 26, md: 34 }, lineHeight: 1.12, color: '#fff' }}>
          {evento.title}
        </Typography>
        {evento.dedicatoria && (
          <Typography sx={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.78)', fontSize: 16 }}>{evento.dedicatoria}</Typography>
        )}
        <Typography sx={{ mt: 0.75, fontSize: { xs: 16, md: 17.5 }, color: '#fff' }}>
          <Box component="span" sx={{ color: GOLD, fontWeight: 500 }}>{cuandoEnCartel(evento)}</Box>{!sinHora && <>, a las {hora(evento)}</>}
        </Typography>
        {nota && <Typography sx={{ fontSize: 14.5, color: 'rgba(255,255,255,0.75)', maxWidth: '60ch' }}>{nota}</Typography>}
        <EnlacesDelActo evento={evento} sobreOscuro />
      </Box>
    </Box>
  )
}

