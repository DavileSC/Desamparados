import { Box, IconButton, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import type { ApiEvent, EventoCalendario } from '../../lib/api/agenda'
import { TIPOS, cubreElDia, diasDeLaRejilla, inicioDelDia, nombreDelMes } from './agenda'
import { GRANATE, PANTALLA_ALTA } from './estilos'
import { CORMORANT } from '../actualidad/agenda/letraAlmanaque'

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const TEXTO = '#1b1c1a'
const TENUE = '#8a8076'

interface MiniCalendarioProps {
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
export default function MiniCalendario({ mes, hoy, eventos, abiertoId, puedeRetroceder, onCambiarMes, onElegir }: MiniCalendarioProps) {
  const hoyMs = inicioDelDia(hoy).getTime()
  const dias = diasDeLaRejilla(mes).map((dia) => {
    const delMes = dia.getMonth() === mes.getMonth()
    return { dia, delMes, actos: delMes ? eventos.filter(e => cubreElDia(e, dia)) : [] }
  })
  // La leyenda solo nombra los tipos que salen en el mes visible.
  const presentes = new Set(dias.flatMap(({ actos }) => actos.map(e => e.type)))
  const leyenda = (Object.keys(TIPOS) as ApiEvent['type'][]).filter(tipo => presentes.has(tipo))

  return (
    // Prieto en un portátil bajo, para que la tarjeta entera quepa; con aire en
    // una pantalla alta (ver PANTALLA_ALTA).
    <Box sx={{ p: { xs: 2.25, md: 2.5 }, [PANTALLA_ALTA]: { p: 3 }, color: TEXTO }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, [PANTALLA_ALTA]: { mb: 1.75 } }}>
        <IconButton aria-label="Mes anterior" disabled={!puedeRetroceder} onClick={() => onCambiarMes(-1)} sx={navSx}>
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        {/* Como la hoja de la Agenda: el mes en letra de almanaque y granate, el año en cursiva. */}
        <Typography aria-live="polite" aria-label={nombreDelMes(mes, true)} sx={{ fontFamily: CORMORANT, fontWeight: 500, fontSize: 25, lineHeight: 1, color: GRANATE }}>
          <span aria-hidden>{nombreDelMes(mes, false)}</span>
          <Box component="span" aria-hidden sx={{ fontStyle: 'italic', fontWeight: 400, fontSize: 17, color: '#7a6c70', ml: 0.75 }}>{mes.getFullYear()}</Box>
        </Typography>
        <IconButton aria-label="Mes siguiente" onClick={() => onCambiarMes(1)} sx={navSx}>
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 0.25, [PANTALLA_ALTA]: { rowGap: 0.5 }, textAlign: 'center' }}>
        {DIAS_SEMANA.map(letra => (
          <Box key={letra} aria-hidden="true" sx={{ fontSize: 10, letterSpacing: '0.12em', color: TENUE, pb: 0.75 }}>
            {letra}
          </Box>
        ))}
        {dias.map(({ dia, delMes, actos }) => {
          const ms = dia.getTime()
          const base = {
            position: 'relative',
            width: 31,
            height: 31,
            [PANTALLA_ALTA]: { width: 36, height: 36 },
            mx: 'auto',
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontFamily: CORMORANT,
            fontSize: 17,
            fontVariantNumeric: 'lining-nums',
            boxShadow: ms === hoyMs ? `inset 0 0 0 1px ${GRANATE}` : 'none',
          } as const

          if (!actos.length) {
            return (
              <Box key={ms} aria-current={ms === hoyMs ? 'date' : undefined} sx={{ ...base, color: dia.getDay() === 0 ? GRANATE : TEXTO, opacity: !delMes ? 0.28 : ms < hoyMs ? 0.45 : 1 }}>
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
                // `font` va antes que la base: el atajo pisaría su letra y su tamaño.
                font: 'inherit',
                ...base,
                p: 0,
                border: 0,
                cursor: 'pointer',
                fontWeight: 600,
                color: elegido ? '#fff' : dia.getDay() === 0 ? GRANATE : TEXTO,
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
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', minHeight: 30, mt: 1.5, pt: 1.5, [PANTALLA_ALTA]: { mt: 2, pt: 2 }, boxShadow: '0 -1px 0 rgba(27, 28, 26, 0.08)' }}>
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
