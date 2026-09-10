import { Box, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { EventoCalendario } from '../../lib/api/events'
import { SERIF, TIPOS, inicioDelDia, nombreDelMes } from './agenda'
import { GRANATE } from './estilos'

// En portada caben cinco actos; el resto está en la agenda completa.
const MAX_FILAS = 5
const TEXTO = '#1b1c1a'
const TENUE = '#8a8076'
const FILETE = 'inset 0 1px 0 #e3dccf'

interface AgendaListProps {
  eventos: EventoCalendario[]
  abiertoId: string | null
  hoy: Date
  onAlternar: (id: string) => void
}

const hora = (fecha: Date) => fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
const diaSemana = (fecha: Date) => fecha.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '')

function Fila({ evento, abierto, onAlternar }: { evento: EventoCalendario; abierto: boolean; onAlternar: (id: string) => void }) {
  const tipo = TIPOS[evento.type]
  const panelId = `agenda-acto-${evento.id}`
  const fin = evento.end && inicioDelDia(evento.end).getTime() !== inicioDelDia(evento.start).getTime() ? evento.end : null

  return (
    <Box
      component="li"
      sx={{
        backgroundColor: abierto ? '#efe8dc' : 'transparent',
        transition: 'background-color .3s ease',
        '& + &': { boxShadow: FILETE },
        '@media (hover: hover)': {
          '&:hover': { backgroundColor: abierto ? '#efe8dc' : '#f2ece2' },
          '&:hover .agenda-titulo': { color: GRANATE },
        },
      }}
    >
      <Box
        component="button"
        type="button"
        aria-expanded={abierto}
        aria-controls={abierto ? panelId : undefined}
        onClick={() => onAlternar(evento.id)}
        sx={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: { xs: '56px 1fr', sm: '60px 1fr auto' },
          columnGap: { xs: 1.75, sm: 2.25 },
          rowGap: 1,
          alignItems: 'center',
          px: { xs: 2, sm: 3 },
          py: 2,
          border: 0,
          background: 'none',
          color: TEXTO,
          font: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <Box component="span" sx={{ textAlign: 'center' }}>
          <Box component="span" sx={{ display: 'block', fontFamily: SERIF, fontSize: fin ? { xs: 17, sm: 20 } : 28, lineHeight: 1, whiteSpace: 'nowrap', color: GRANATE }}>
            {fin ? `${evento.start.getDate()}–${fin.getDate()}` : evento.start.getDate()}
          </Box>
          <Box component="span" sx={{ display: 'block', mt: 0.75, fontSize: 10, letterSpacing: fin ? '0.06em' : '0.16em', whiteSpace: 'nowrap', textTransform: 'uppercase', color: TENUE }}>
            {fin ? `${diaSemana(evento.start)}–${diaSemana(fin)}` : diaSemana(evento.start)}
          </Box>
        </Box>
        <Box component="span" sx={{ minWidth: 0 }}>
          <Box component="span" className="agenda-titulo" sx={{ display: 'block', fontFamily: SERIF, fontSize: { xs: 16, md: 17 }, lineHeight: 1.3, color: TEXTO, mb: 0.5, transition: 'color .3s ease' }}>
            {evento.title}
          </Box>
          <Box component="span" sx={{ display: 'block', fontSize: 13, lineHeight: 1.45, color: '#6a6258' }}>
            {[hora(evento.start), evento.location].filter(Boolean).join(' · ')}
          </Box>
        </Box>
        <Box
          component="span"
          sx={{
            gridColumn: { xs: 2, sm: 'auto' },
            justifySelf: 'start',
            px: 1,
            py: 0.375,
            borderRadius: '99px',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: tipo.color,
            backgroundColor: alpha(tipo.color, 0.1),
          }}
        >
          {tipo.nombre}
        </Box>
      </Box>
      {abierto && evento.description && (
        <Typography
          id={panelId}
          sx={{ pl: { xs: 'calc(16px + 56px + 14px)', sm: 'calc(24px + 60px + 18px)' }, pr: { xs: 2, sm: 3 }, pb: 2.25, mt: -0.5, fontSize: 13.5, lineHeight: 1.55, color: '#4a454a' }}
        >
          {evento.description}
        </Typography>
      )}
    </Box>
  )
}

/** La lista de la tarjeta de papel, agrupada por meses; el acto abierto enseña su descripción. */
export default function AgendaList({ eventos, abiertoId, hoy, onAlternar }: AgendaListProps) {
  // Si el acto abierto desde el calendario cae más allá de la quinta fila, la lista corre hasta él.
  const indice = eventos.findIndex(e => e.id === abiertoId)
  const desde = indice < MAX_FILAS ? 0 : indice - MAX_FILAS + 1
  const grupos: { clave: string; titulo: string; eventos: EventoCalendario[] }[] = []
  for (const evento of eventos.slice(desde, desde + MAX_FILAS)) {
    const clave = `${evento.start.getFullYear()}-${evento.start.getMonth()}`
    const ultimo = grupos[grupos.length - 1]
    if (ultimo?.clave === clave) ultimo.eventos.push(evento)
    else grupos.push({ clave, titulo: nombreDelMes(evento.start, evento.start.getFullYear() !== hoy.getFullYear()), eventos: [evento] })
  }

  return (
    <Box sx={{ py: 1 }}>
      {grupos.map((grupo, i) => (
        <Box key={grupo.clave} sx={{ boxShadow: i ? FILETE : 'none' }}>
          <Typography component="h3" sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 0.5, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7b6f5e' }}>
            {grupo.titulo}
          </Typography>
          <Box component="ul" role="list" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {grupo.eventos.map(evento => (
              <Fila key={evento.id} evento={evento} abierto={evento.id === abiertoId} onAlternar={onAlternar} />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  )
}
