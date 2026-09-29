import { Box, Typography } from '@mui/material'
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

/**
 * El saludo del Inicio: la fecha, «Buenos días» con el cargo y cómo va la web.
 * Lo que espera lo cuenta la lista de asuntos, justo debajo. Sin botones de
 * crear: cada cosa se crea desde su sección.
 */
export default function Cabecera({ role, actividad, hoy = new Date() }: Props) {
  const cargo = role ? NOMBRE_CARGO[role] ?? '' : ''
  const unaLinea = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const

  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column', gap: 'clamp(4px, 1vh, 10px)', minWidth: 0,
        // En pantallas muy bajas solo queda el saludo: el curso necesita el sitio.
        '@media (max-height: 700px) and (max-width: 719px)': { '& .secundaria': { display: 'none' } },
      }}
    >
      <Typography className="secundaria" sx={{ ...VERSALITAS, ...unaLinea, fontSize: 11.5, letterSpacing: '0.22em' }}>
        {hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </Typography>
      <Typography component="h1" sx={{ ...SERIF, fontSize: 'clamp(24px, min(5.4vh, 7vw), 54px)', lineHeight: 1.05 }}>
        Buenos días{cargo && `, ${cargo}`}
      </Typography>
      {actividad && (
        <Typography className="secundaria" sx={{ ...unaLinea, fontSize: 'clamp(13px, 1.7vh, 15px)', color: 'text.secondary' }}>
          En la web: {contar(actividad.noticias.publicadas, 'noticia publicada', 'noticias publicadas')} ·{' '}
          {contar(actividad.publicaciones.total, 'publicación', 'publicaciones')}
          {actividad.publicaciones.ultima && `, la última el ${fechaCorta(actividad.publicaciones.ultima)}`}
        </Typography>
      )}
    </Box>
  )
}
