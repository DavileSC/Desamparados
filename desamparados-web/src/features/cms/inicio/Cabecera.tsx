import { Box, Button, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { NOMBRE_CARGO } from '../../../app/cmsNavegacion'
import { contar } from './plural'
import { fechaCorta } from '../contabilidad/formato'
import type { PanelResponse } from '../../../lib/api/panel'
import { SERIF, VERSALITAS } from './estiloRetablo'

interface Props {
  role?: string
  /** Noticias y publicaciones de la web, en una línea bajo el saludo. */
  actividad?: PanelResponse['actividad']
  hoy?: Date
}

/** Los botones de la cabecera: solo los de las secciones de cada cargo. */
const ATAJOS = [
  { texto: 'Nuevo evento', href: '/cms/agenda', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'] },
  { texto: 'Nuevo apunte', href: '/cms/contabilidad', roles: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'] },
  { texto: 'Nueva noticia', href: '/cms/noticias', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'], principal: true },
]

/**
 * El saludo del Inicio: la fecha, «Buenos días» con el cargo y cómo va la web.
 * Lo que espera ya no va aquí en una frase: lo cuenta la lista de asuntos,
 * justo debajo.
 */
export default function Cabecera({ role, actividad, hoy = new Date() }: Props) {
  const cargo = role ? NOMBRE_CARGO[role] ?? '' : ''
  const visibles = ATAJOS.filter((a) => role && a.roles.includes(role))

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 3, flexWrap: 'wrap' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Typography sx={{ ...VERSALITAS, letterSpacing: '0.24em' }}>
          {hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </Typography>
        <Typography component="h1" sx={{ ...SERIF, fontSize: { xs: 38, md: 54 }, lineHeight: 1 }}>
          Buenos días{cargo && `, ${cargo}`}
        </Typography>
        {actividad && (
          <Typography sx={{ fontSize: 15, color: 'text.secondary' }}>
            En la web: {contar(actividad.noticias.publicadas, 'noticia publicada', 'noticias publicadas')} ·{' '}
            {contar(actividad.publicaciones.total, 'publicación', 'publicaciones')}
            {actividad.publicaciones.ultima && `, la última el ${fechaCorta(actividad.publicaciones.ultima)}`}
          </Typography>
        )}
      </Box>
      {visibles.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {visibles.map((atajo) => (
            <Button
              key={atajo.href}
              component={Link}
              to={atajo.href}
              variant={atajo.principal ? 'contained' : 'outlined'}
              color={atajo.principal ? 'primary' : 'inherit'}
              sx={{ height: 44, px: 2.25, borderRadius: 0.75, textTransform: 'none', fontSize: 14, fontWeight: atajo.principal ? 600 : 500 }}
            >
              {atajo.texto}
            </Button>
          ))}
        </Box>
      )}
    </Box>
  )
}
