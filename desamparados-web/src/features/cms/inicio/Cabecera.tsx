import { Box, Typography } from '@mui/material'
import { NOMBRE_CARGO } from '../../../app/cmsNavegacion'
import { contar } from './plural'
import { fechaCorta } from '../contabilidad/formato'
import type { PanelResponse } from '../../../lib/api/panel'
import { SERIF, VERSALITAS } from './estiloRetablo'
import { useAhora } from '../../../hooks/useAhora'

interface Props {
  role?: string
  /** Noticias y publicaciones de la web, en una línea bajo el saludo. */
  actividad?: PanelResponse['actividad']
  hoy?: Date
}

/**
 * El saludo del Inicio: «Buenos días» con el cargo y, debajo, la fecha y cómo
 * va la web en una sola línea.
 * Lo que espera lo cuenta la lista de asuntos, justo debajo. Sin botones de
 * crear: cada cosa se crea desde su sección.
 */
export default function Cabecera({ role, actividad, hoy: hoyDado }: Props) {
  const hoy = useAhora(hoyDado)
  const cargo = role ? NOMBRE_CARGO[role] ?? '' : ''
  // En el móvil la página se desplaza: el texto entero cabe partiendo líneas.
  const unaLinea = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', '@container columna (max-width: 559px)': { whiteSpace: 'normal' } } as const

  return (
    <Box
      sx={{
        display: 'flex', flexDirection: 'column', gap: 'clamp(2px, .6vh, 6px)', minWidth: 0,
        // En pantallas muy bajas solo queda el saludo: el año necesita el sitio.
        '@media (max-height: 700px) and (max-width: 719px)': { '& .secundaria': { display: 'none' } },
      }}
    >
      <Typography component="h1" sx={{ ...SERIF, fontSize: 'clamp(24px, min(4.6vh, 7vw), 44px)', lineHeight: 1.05 }}>
        Buenos días{cargo && `, ${cargo}`}
      </Typography>
      {/* La fecha y cómo va la web, en una sola línea: el año necesita el sitio. */}
      <Typography className="secundaria" sx={{ ...unaLinea, fontSize: 13.5, color: 'text.secondary' }}>
        <Box component="span" sx={{ ...VERSALITAS, fontSize: 11.5, letterSpacing: '0.18em' }}>
          {hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Box>
        {actividad && (
          <>
            {' · '}En la web: {contar(actividad.noticias.publicadas, 'noticia publicada', 'noticias publicadas')} ·{' '}
            {contar(actividad.publicaciones.total, 'publicación', 'publicaciones')}
            {actividad.publicaciones.ultima && `, la última el ${fechaCorta(actividad.publicaciones.ultima)}`}
          </>
        )}
      </Typography>
    </Box>
  )
}
