import { Box, IconButton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type { ApiEvent, EventoCalendario } from '../../lib/api/agenda'
import { SERIF, TIPOS, cubreElDia, diasDeLaRejilla, inicioDelDia, nombreDelMes } from './agenda'
import { GRANATE } from './estilos'

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const TEXTO = '#1b1c1a'
const TENUE = '#8a8076'

interface MiniCalendarProps {
  /** Primer día del mes visible. */
  mes: Date
  hoy: Date
  eventos: EventoCalendario[]
  abiertoId: string | null
  puedeRetroceder: boolean
  onCambiarMes: (salto: number) => void
  onElegir: (evento: EventoCalendario) => void
}

const navSx = {
  width: 36,
  height: 36,
  color: '#7b6f5e',
  '&:hover': { backgroundColor: alpha(GRANATE, 0.08), color: GRANATE },
  '&.Mui-disabled': { color: 'rgba(27, 28, 26, 0.22)' },
}

/** El calendario del mes en la tarjeta de papel: los días con acto son botones con un punto del color de su tipo. */
export default function MiniCalendario({ mes, hoy, eventos, abiertoId, puedeRetroceder, onCambiarMes, onElegir }: MiniCalendarProps) {
  const hoyMs = inicioDelDia(hoy).getTime()
  const dias = diasDeLaRejilla(mes).map((dia) => {
    const delMes = dia.getMonth() === mes.getMonth()
    return { dia, delMes, actos: delMes ? eventos.filter(e => cubreElDia(e, dia)) : [] }
  })
  // La leyenda solo nombra los tipos que salen en el mes visible.
  const presentes = new Set(dias.flatMap(({ actos }) => actos.map(e => e.type)))
  const leyenda = (Object.keys(TIPOS) as ApiEvent['type'][]).filter(tipo => presentes.has(tipo))

  return (
    <Box sx={{ p: { xs: 2.5, md: 3 }, color: TEXTO }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.75 }}>
        <IconButton aria-label="Mes anterior" disabled={!puedeRetroceder} onClick={() => onCambiarMes(-1)} sx={navSx}>
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <Typography aria-live="polite" sx={{ fontFamily: SERIF, fontSize: 19, color: TEXTO }}>
          {nombreDelMes(mes, true)}
        </Typography>
        <IconButton aria-label="Mes siguiente" onClick={() => onCambiarMes(1)} sx={navSx}>
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 0.5, textAlign: 'center' }}>
        {DIAS_SEMANA.map(letra => (
          <Box key={letra} aria-hidden="true" sx={{ fontSize: 10, letterSpacing: '0.12em', color: TENUE, pb: 0.75 }}>
            {letra}
          </Box>
        ))}
        {dias.map(({ dia, delMes, actos }) => {
          const ms = dia.getTime()
          const base = {
            position: 'relative',
            width: 34,
            height: 34,
            mx: 'auto',
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontSize: 13,
            boxShadow: ms === hoyMs ? `inset 0 0 0 1px ${GRANATE}` : 'none',
          } as const

          if (!actos.length) {
            return (
              <Box key={ms} aria-current={ms === hoyMs ? 'date' : undefined} sx={{ ...base, color: TEXTO, opacity: !delMes ? 0.28 : ms < hoyMs ? 0.45 : 1 }}>
                {dia.getDate()}
              </Box>
            )
          }

          const elegido = actos.some(e => e.id === abiertoId)
          const fecha = dia.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
          return (
            <Box
              key={ms}
              component="button"
              type="button"
              aria-label={`${fecha}, ${actos.length} ${actos.length === 1 ? 'acto' : 'actos'}`}
              aria-pressed={elegido}
              aria-current={ms === hoyMs ? 'date' : undefined}
              onClick={() => onElegir(actos[0])}
              sx={{
                // `font` va antes que la base: el atajo pisaría su tamaño de 13 px.
                font: 'inherit',
                ...base,
                p: 0,
                border: 0,
                cursor: 'pointer',
                fontWeight: elegido ? 600 : 500,
                color: elegido ? '#fff' : TEXTO,
                backgroundColor: elegido ? GRANATE : 'transparent',
                transition: 'background-color .2s ease',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  bottom: 3,
                  left: 'calc(50% - 2px)',
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  backgroundColor: elegido ? '#fff' : TIPOS[actos[0].type].color,
                },
                '@media (hover: hover)': { '&:hover': { backgroundColor: elegido ? GRANATE : alpha(GRANATE, 0.1) } },
              }}
            >
              {dia.getDate()}
            </Box>
          )
        })}
      </Box>

      {/* La leyenda guarda su línea aunque el mes no tenga actos: así el calendario no cambia de alto. */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', minHeight: 34, mt: 2, pt: 2, boxShadow: '0 -1px 0 rgba(27, 28, 26, 0.08)' }}>
        {leyenda.map(tipo => (
          <Box key={tipo} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 12, lineHeight: '18px', color: '#6a6258' }}>
            <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: TIPOS[tipo].color }} />
            {TIPOS[tipo].nombre}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
