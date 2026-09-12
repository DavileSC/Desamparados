import { Box, Paper, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import type { PanelResponse } from '../../../lib/api/panel'
import { designTokens } from '../../../theme'

const TIPO: Record<string, string> = {
  CULTO: 'Culto', PROCESION: 'Procesión', FORMACION: 'Formación', ENSAYO: 'Ensayo',
  REUNION: 'Reunión', SOCIAL: 'Social', OTRO: 'Otro',
}

/** Los cuatro primeros actos convocados. */
export default function ProximosActos({ eventos }: { eventos: PanelResponse['actividad']['proximosEventos'] }) {
  const proximos = eventos.slice(0, 4)

  return (
    <Paper component="section" aria-labelledby="proximos-actos" sx={{ borderRadius: 1.75 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', px: 2.75, pt: 2.25, pb: 1.5 }}>
        <Typography id="proximos-actos" variant="h5" component="h2">Próximos actos</Typography>
        <Typography component={Link} to="/cms/agenda" variant="body2" sx={{ fontWeight: 600, textDecoration: 'none', color: 'primary.main' }}>
          Agenda →
        </Typography>
      </Box>
      {proximos.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2.75, pb: 3, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
          No hay actos convocados.
        </Typography>
      )}
      {proximos.map((evento) => {
        const fecha = new Date(evento.startDate)
        return (
          <Box key={evento.id} sx={{ display: 'flex', gap: 1.75, alignItems: 'center', px: 2.75, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ width: 44, flexShrink: 0, textAlign: 'center' }}>
              <Typography sx={{ fontFamily: designTokens.fonts.heading, fontSize: 22, lineHeight: 1.1 }}>
                {fecha.getDate()}
              </Typography>
              <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.secondary' }}>
                {fecha.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}
              </Typography>
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{evento.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {fecha.toLocaleDateString('es-ES', { weekday: 'long' })} ·{' '}
                {fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · {TIPO[evento.type] ?? evento.type}
              </Typography>
            </Box>
          </Box>
        )
      })}
      <Box sx={{ pb: 1 }} />
    </Paper>
  )
}
