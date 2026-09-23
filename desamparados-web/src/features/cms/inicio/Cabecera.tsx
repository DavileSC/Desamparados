import { Box, Button, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { Link } from 'react-router-dom'
import { NOMBRE_CARGO } from '../../../app/cmsNavegacion'
import { contar } from './plural'
import { fechaCorta } from '../contabilidad/formato'
import type { PanelResponse } from '../../../lib/api/panel'

interface Props {
  /** Cuántos asuntos esperan hoy a este cargo. */
  asuntosPropios: number
  asuntosDeLaJunta: number
  role?: string
  /** Noticias y publicaciones de la web, en una línea bajo la frase. */
  actividad?: PanelResponse['actividad']
  hoy?: Date
}

/** Los botones de la cabecera: solo los de las secciones de cada cargo. */
const ATAJOS = [
  { texto: 'Nuevo acto', href: '/cms/agenda', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'] },
  { texto: 'Nuevo apunte', href: '/cms/contabilidad', roles: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'] },
  { texto: 'Nueva noticia', href: '/cms/noticias', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'], principal: true },
]

export default function Cabecera({ asuntosPropios, asuntosDeLaJunta, role, actividad, hoy = new Date() }: Props) {
  const cargo = role ? NOMBRE_CARGO[role] ?? '' : ''
  const visibles = ATAJOS.filter((a) => role && a.roles.includes(role))

  const frase = asuntosPropios > 0
    ? `Tienes ${contar(asuntosPropios, 'asunto', 'asuntos')} esperando.`
    : 'No tienes nada pendiente.'
  const resto = asuntosDeLaJunta > 0
    ? ` El resto de la junta lleva ${contar(asuntosDeLaJunta, 'asunto más', 'asuntos más')}.`
    : ''

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 3, flexWrap: 'wrap', mb: 3.25 }}>
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>
          {hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </Typography>
        <Typography variant="h3" component="h1" sx={{ fontSize: { xs: 30, md: 40 }, lineHeight: 1.15, my: 1 }}>
          Buenos días{cargo && `, ${cargo}`}
        </Typography>
        <Typography variant="body1" color="text.secondary">{frase}{resto}</Typography>
        {actividad && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, opacity: 0.85 }}>
            En la web: {contar(actividad.noticias.publicadas, 'noticia publicada', 'noticias publicadas')} ·{' '}
            {contar(actividad.publicaciones.total, 'publicación', 'publicaciones')}
            {actividad.publicaciones.ultima && `, la última el ${fechaCorta(actividad.publicaciones.ultima)}`}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'center' }}>
        {visibles.map((atajo) => (
          <Button
            key={atajo.href}
            component={Link}
            to={atajo.href}
            startIcon={<AddIcon />}
            variant={atajo.principal ? 'contained' : 'outlined'}
            color={atajo.principal ? 'primary' : 'inherit'}
            sx={{ borderRadius: 1.25 }}
          >
            {atajo.texto}
          </Button>
        ))}
      </Box>
    </Box>
  )
}
