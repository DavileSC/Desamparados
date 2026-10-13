import { Box, Typography, useMediaQuery } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { EventoCalendario } from '../../lib/api/agenda'
import { SERIF, TIPOS, nombreDelMes } from './agenda'
import { CONSULTA_ALTA, CONSULTA_MUY_ALTA, GRANATE, PANTALLA_ALTA } from './estilos'
import { CORMORANT } from '../actualidad/agenda/letraAlmanaque'
import Hueso, { Lineas } from '../../components/esqueleto/Hueso'
import { diaDelCalendario, fechaEnMadrid, horaEnMadrid } from '../../lib/horaDeMadrid'

/**
 * Cuántos actos caben en portada, según el alto de la pantalla: cuatro en un
 * portátil bajo (la tarjeta entera tiene que verse sin bajar), cinco en uno
 * normal y seis en un monitor alto. En el móvil la tarjeta va apilada y no
 * cabe de todos modos: cinco, como siempre. El resto, en la agenda completa.
 */
function useFilasQueCaben(): number {
  const escritorio = useMediaQuery('(min-width: 900px)')
  const alta = useMediaQuery(CONSULTA_ALTA)
  const muyAlta = useMediaQuery(CONSULTA_MUY_ALTA)
  if (!escritorio) return 5
  return muyAlta ? 6 : alta ? 5 : 4
}
const TEXTO = '#1b1c1a'
const TENUE = '#8a8076'
const FILETE = 'inset 0 1px 0 #e3dccf'

interface ListaDeAgendaProps {
  eventos: EventoCalendario[]
  abiertoId: string | null
  hoy: Date
  onAlternar: (id: string) => void
}

/** La rejilla de una fila: el día, el acto y su etiqueta. La comparten la fila y su esqueleto. */
const filaSx = {
  width: '100%',
  display: 'grid',
  gridTemplateColumns: { xs: '56px 1fr', sm: '60px 1fr auto' },
  columnGap: { xs: 1.75, sm: 2.25 },
  rowGap: 1,
  alignItems: 'center',
  px: { xs: 2, sm: 3 },
  py: 1.4,
  [PANTALLA_ALTA]: { py: 2 },
} as const
const mesSx = { px: { xs: 2, sm: 3 }, pt: 1.5, pb: 0.25, [PANTALLA_ALTA]: { pt: 2, pb: 0.5 } } as const

// El día y la hora, los de Madrid: a la que hay que estar, se mire desde donde se mire.
const hora = (fecha: Date) => horaEnMadrid(fecha)
const diaSemana = (fecha: Date) => fechaEnMadrid(fecha, { weekday: 'short' }).replace('.', '')

function Fila({ evento, abierto, onAlternar }: { evento: EventoCalendario; abierto: boolean; onAlternar: (id: string) => void }) {
  const tipo = TIPOS[evento.type]
  const panelId = `agenda-acto-${evento.id}`
  const inicio = diaDelCalendario(evento.start)
  const ultimo = evento.end ? diaDelCalendario(evento.end) : null
  const fin = ultimo && ultimo.getTime() !== inicio.getTime() ? ultimo : null

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
          ...filaSx,
          border: 0,
          background: 'none',
          color: TEXTO,
          font: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <Box component="span" sx={{ textAlign: 'center' }}>
          <Box component="span" sx={{ display: 'block', fontFamily: CORMORANT, fontWeight: 500, fontVariantNumeric: 'lining-nums', fontSize: fin ? { xs: 21, sm: 24 } : 31, lineHeight: 1, whiteSpace: 'nowrap', color: GRANATE, [PANTALLA_ALTA]: { fontSize: fin ? 24 : 34 } }}>
            {fin ? `${inicio.getDate()}–${fin.getDate()}` : inicio.getDate()}
          </Box>
          <Box component="span" sx={{ display: 'block', mt: 0.5, fontSize: 11, letterSpacing: fin ? '0.06em' : '0.16em', whiteSpace: 'nowrap', textTransform: 'uppercase', color: TENUE }}>
            {fin ? `${diaSemana(evento.start)}–${diaSemana(evento.end!)}` : diaSemana(evento.start)}
          </Box>
        </Box>
        <Box component="span" sx={{ minWidth: 0 }}>
          <Box component="span" className="agenda-titulo" sx={{ display: 'block', fontFamily: SERIF, fontSize: { xs: 16, md: 17 }, lineHeight: 1.3, color: TEXTO, mb: 0.5, transition: 'color .3s ease' }}>
            {evento.title}
          </Box>
          <Box component="span" sx={{ display: 'block', fontSize: 13, lineHeight: 1.45, color: '#6a6258' }}>
            {[evento.sinHora ? null : hora(evento.start), evento.location].filter(Boolean).join(' · ')}
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
            fontSize: 11,
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
          sx={{ pl: { xs: 'calc(16px + 56px + 14px)', sm: 'calc(24px + 60px + 18px)' }, pr: { xs: 2, sm: 3 }, pb: 1.75, mt: -0.5, fontSize: 13.5, lineHeight: 1.55, color: '#4a454a' }}
        >
          {evento.description}
        </Typography>
      )}
    </Box>
  )
}

/** La lista de la tarjeta de papel, agrupada por meses; el acto abierto enseña su descripción. */
export default function ListaDeAgenda({ eventos, abiertoId, hoy, onAlternar }: ListaDeAgendaProps) {
  const MAX_FILAS = useFilasQueCaben()
  // Si el acto abierto desde el calendario cae más allá de la quinta fila, la lista corre hasta él.
  const indice = eventos.findIndex(e => e.id === abiertoId)
  const desde = indice < MAX_FILAS ? 0 : indice - MAX_FILAS + 1
  const grupos: { clave: string; titulo: string; eventos: EventoCalendario[] }[] = []
  for (const evento of eventos.slice(desde, desde + MAX_FILAS)) {
    const dia = diaDelCalendario(evento.start)
    const clave = `${dia.getFullYear()}-${dia.getMonth()}`
    const ultimo = grupos[grupos.length - 1]
    if (ultimo?.clave === clave) ultimo.eventos.push(evento)
    else grupos.push({ clave, titulo: nombreDelMes(dia, dia.getFullYear() !== hoy.getFullYear()), eventos: [evento] })
  }

  return (
    <Box sx={{ py: 1 }}>
      {grupos.map((grupo, i) => (
        <Box key={grupo.clave} sx={{ boxShadow: i ? FILETE : 'none' }}>
          <Typography component="h3" sx={{ ...mesSx, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7b6f5e' }}>
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

/**
 * La lista mientras llegan los actos: el mes y tantas filas como caben, con el
 * día, el título, la hora y la etiqueta en huesos del tamaño de los de verdad.
 */
export function ListaDeAgendaEsqueleto() {
  const filas = useFilasQueCaben()
  return (
    <Box sx={{ py: 1 }}>
      <Box sx={mesSx}><Lineas papel anchos={['84px']} linea={16.5} grosor={8} /></Box>
      {Array.from({ length: filas }, (_, i) => (
        <Box key={i} sx={{ ...filaSx, boxShadow: i ? FILETE : 'none' }}>
          <Box sx={{ display: 'grid', justifyItems: 'center', gap: 0.75 }}>
            <Hueso papel sx={{ width: 30, height: 25, [PANTALLA_ALTA]: { height: 28 } }} />
            <Hueso papel sx={{ width: 26, height: 8 }} />
          </Box>
          <Box>
            <Lineas papel anchos={[`${72 - (i % 3) * 12}%`]} linea={{ xs: 20.8, md: 22.1 }} grosor={12} />
            <Box sx={{ mt: 0.5 }}><Lineas papel anchos={['46%']} linea={18.85} grosor={9} /></Box>
          </Box>
          <Hueso papel sx={{ gridColumn: { xs: 2, sm: 'auto' }, width: 76, height: 20, borderRadius: '99px' }} />
        </Box>
      ))}
    </Box>
  )
}
