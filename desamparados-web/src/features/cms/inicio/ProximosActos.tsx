import { Box, Paper, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import type { PanelResponse } from '../../../lib/api/panel'
import { rolesPorRutaCms } from '../../../app/cmsNavegacion'
import { fechaCorta } from '../contabilidad/formato'
import { contar } from './plural'
import { useTemaCms } from '../../../app/useTemaCms'
import { MECER, fondoResplandor } from '../../../theme/resplandor'
import { CIFRA, entrada } from './animaciones'

const TIPO: Record<string, string> = {
  CULTO: 'Culto', PROCESION: 'Procesión', FORMACION: 'Formación', ENSAYO: 'Ensayo',
  REUNION: 'Reunión', SOCIAL: 'Social', OTRO: 'Otro',
}

/** Los cuatro primeros actos convocados. */
export default function ProximosActos({
  eventos, actividad, role, orden = 0,
}: {
  eventos: PanelResponse['actividad']['proximosEventos']
  /** Noticias y publicaciones, para el pie. Venían sueltas bajo las cifras, sin título que las explicara. */
  actividad: PanelResponse['actividad']
  role?: string
  orden?: number
}) {
  const proximos = eventos.slice(0, 4)
  // Mismos roles que la guarda de /cms/agenda (rolesPorRutaCms es la única
  // fuente de verdad): sin este condicional, Tesorería, Redes y Albacería
  // pulsaban el enlace y ExigeRol los expulsaba a /area-hermano, fuera de
  // todo el CMS.
  const veAgenda = role !== undefined && rolesPorRutaCms.agenda.includes(role)
  const { modo, superficies } = useTemaCms()

  return (
    <Paper component="section" aria-labelledby="proximos-actos" sx={{ ...fondoResplandor(modo, 'oro', superficies.card), borderRadius: 1.75, height: '100%', display: 'flex', flexDirection: 'column', ...entrada(orden, MECER) }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', px: 2.75, pt: 2.25, pb: 1.5 }}>
        <Typography id="proximos-actos" variant="h5" component="h2">Próximos actos</Typography>
        {veAgenda && (
          <Typography component={Link} to="/cms/agenda" variant="body2" sx={{ fontWeight: 600, textDecoration: 'none', color: superficies.enlace }}>
            Agenda →
          </Typography>
        )}
      </Box>
      {proximos.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2.75, pb: 3, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
          No hay actos convocados.
        </Typography>
      )}
      {proximos.map((evento, i) => {
        const fecha = new Date(evento.startDate)
        return (
          <Box key={evento.id} sx={{ display: 'flex', gap: 1.75, alignItems: 'center', px: 2.75, py: 1.5, borderTop: 1, borderColor: 'divider', ...entrada(orden + 1 + i) }}>
            <Box sx={{ width: 44, flexShrink: 0, textAlign: 'center' }}>
              <Typography sx={{ ...CIFRA, fontSize: 24, lineHeight: 1.1 }}>
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
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', px: 2.75, py: 1.5, borderTop: 1, borderColor: 'divider', mt: 'auto' }}
      >
        {contar(actividad.noticias.publicadas, 'noticia publicada', 'noticias publicadas')} ·{' '}
        {contar(actividad.publicaciones.total, 'publicación', 'publicaciones')}
        {actividad.publicaciones.ultima && ` · última el ${fechaCorta(actividad.publicaciones.ultima)}`}
      </Typography>
    </Paper>
  )
}
