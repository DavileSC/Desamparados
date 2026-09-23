import { Box, Paper, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import type { PanelResponse, TipoEvento } from '../../../lib/api/panel'
import { useTemaCms } from '../../../app/useTemaCms'
import { rolesPorRutaCms } from '../../../app/cmsNavegacion'
import { entrada } from './animaciones'

const DIAS_SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

type Clase = 'culto' | 'reunion' | 'otro'
/** Tres familias bastan para leer el mes de un vistazo; el detalle está en la Agenda. */
const CLASE: Record<TipoEvento, Clase> = {
  CULTO: 'culto', PROCESION: 'culto',
  REUNION: 'reunion', FORMACION: 'reunion',
  ENSAYO: 'otro', SOCIAL: 'otro', OTRO: 'otro',
}
const NOMBRE_CLASE: Record<Clase, string> = { culto: 'Culto y procesión', reunion: 'Reunión y formación', otro: 'Otros actos' }

/** Día del mes (en la hora de España) de un instante ISO. */
const diaEnMadrid = (iso: string) => Number(new Intl.DateTimeFormat('es-ES', { day: 'numeric', timeZone: 'Europe/Madrid' }).format(new Date(iso)))

/**
 * El mes en curso de un vistazo: qué días hay actos, de qué clase, y qué días
 * hay turno de reparto de papeletas. Lunes primero, como en España.
 */
export default function CalendarioMes({ calendario, role, hoy = new Date(), orden = 0 }: {
  calendario: PanelResponse['calendario']
  role?: string
  hoy?: Date
  orden?: number
}) {
  const { modo } = useTemaCms()
  const oscuro = modo === 'oscuro'
  const COLOR: Record<Clase, { fondo: string; texto: string; muestra: string }> = {
    culto: { fondo: oscuro ? 'rgba(160,61,68,0.55)' : 'rgba(110,24,34,0.12)', texto: oscuro ? '#fff' : '#6e1822', muestra: oscuro ? '#a03d44' : '#6e1822' },
    reunion: { fondo: oscuro ? 'rgba(255,255,255,0.14)' : '#e9e6e2', texto: oscuro ? '#fff' : '#1b1c1a', muestra: oscuro ? 'rgba(255,255,255,0.4)' : '#b9b3b0' },
    otro: { fondo: oscuro ? 'rgba(222,199,43,0.2)' : 'rgba(193,172,0,0.16)', texto: oscuro ? '#fff' : '#514700', muestra: oscuro ? 'rgba(222,199,43,0.6)' : '#c1ac00' },
  }

  const [anio, mes] = calendario.mes.split('-').map(Number)
  const primero = new Date(anio, mes - 1, 1)
  const diasDelMes = new Date(anio, mes, 0).getDate()
  const huecos = (primero.getDay() + 6) % 7
  const esteMes = hoy.getFullYear() === anio && hoy.getMonth() === mes - 1
  const reparto = new Set(calendario.diasDeReparto.map((d) => Number(d.slice(8, 10))))
  const actosPorDia = new Map<number, PanelResponse['calendario']['eventos']>()
  for (const evento of calendario.eventos) {
    const dia = diaEnMadrid(evento.startDate)
    actosPorDia.set(dia, [...(actosPorDia.get(dia) ?? []), evento])
  }
  const clasesDelMes = [...new Set(calendario.eventos.map((e) => CLASE[e.type]))]
  const veAgenda = role !== undefined && rolesPorRutaCms.agenda.includes(role)
  const titulo = `${MESES[mes - 1][0].toUpperCase()}${MESES[mes - 1].slice(1)} de ${anio}`

  return (
    <Paper component="section" aria-labelledby="calendario-mes" sx={{ borderRadius: 1.75, p: { xs: 2, md: 2.5 }, height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0, containerType: 'inline-size', containerName: 'calendario', ...entrada(orden) }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1.5 }}>
        <Typography id="calendario-mes" variant="h5" component="h2">{titulo}</Typography>
        {veAgenda && (
          <Typography component={Link} to="/cms/agenda" variant="body2" sx={{ fontWeight: 600, textDecoration: 'none', color: 'primary.main' }}>
            Agenda →
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: { xs: '3px', sm: '5px' } }}>
        {DIAS_SEMANA.map((d) => (
          <Typography key={d} aria-hidden="true" sx={{ fontSize: 11, textAlign: 'center', color: 'text.secondary', pb: 0.25 }}>{d}</Typography>
        ))}
        {Array.from({ length: huecos }, (_, i) => <Box key={`hueco-${i}`} />)}
        {Array.from({ length: diasDelMes }, (_, i) => {
          const dia = i + 1
          const actos = actosPorDia.get(dia) ?? []
          const clase = actos[0] ? CLASE[actos[0].type] : null
          const hayReparto = reparto.has(dia)
          const esHoy = esteMes && hoy.getDate() === dia
          const semana = Math.floor((huecos + i) / 7)
          const descripcion = [
            `${dia} de ${MESES[mes - 1]}`,
            ...actos.map((a) => a.title),
            ...(hayReparto ? ['reparto de papeletas'] : []),
          ].join(', ')
          return (
            <Box
              key={dia}
              title={actos.length || hayReparto ? descripcion : undefined}
              aria-label={descripcion}
              sx={{
                minHeight: 40,
                '@container calendario (min-width: 380px)': { minHeight: 52 },
                borderRadius: 1,
                p: '4px 5px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0,
                fontSize: 11.5,
                backgroundColor: clase ? COLOR[clase].fondo : oscuro ? 'rgba(255,255,255,0.035)' : '#f4f2ee',
                color: clase ? COLOR[clase].texto : 'text.secondary',
                outline: esHoy ? `1.5px solid ${oscuro ? '#ffb3b4' : '#1b1c1a'}` : hayReparto ? `1px dashed ${oscuro ? 'rgba(255,255,255,0.45)' : '#7b757a'}` : 'none',
                outlineOffset: -1,
                ...entrada(orden + semana),
              }}
            >
              <Box component="span" sx={{ fontWeight: esHoy ? 700 : 500 }}>{dia}</Box>
              {actos[0] && (
                <Box component="span" sx={{ display: 'none', '@container calendario (min-width: 380px)': { display: 'block' }, fontSize: 10.5, fontWeight: 600, lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {actos[0].title}{actos.length > 1 ? ` +${actos.length - 1}` : ''}
                </Box>
              )}
              {!actos[0] && hayReparto && (
                <Box component="span" sx={{ display: 'none', '@container calendario (min-width: 380px)': { display: 'block' }, fontSize: 10.5, lineHeight: 1.15 }}>Reparto</Box>
              )}
            </Box>
          )
        })}
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', mt: 'auto', pt: 1.5, fontSize: 12, color: 'text.secondary' }}>
        {clasesDelMes.map((c) => (
          <Box component="span" key={c} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <Box component="span" sx={{ width: 10, height: 10, borderRadius: '3px', backgroundColor: COLOR[c].muestra }} />
            {NOMBRE_CLASE[c]}
          </Box>
        ))}
        {reparto.size > 0 && (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <Box component="span" sx={{ width: 10, height: 10, borderRadius: '3px', border: `1px dashed ${oscuro ? 'rgba(255,255,255,0.6)' : '#7b757a'}` }} />
            Reparto de papeletas
          </Box>
        )}
        {calendario.eventos.length === 0 && reparto.size === 0 && <span>Sin actos este mes.</span>}
      </Box>
    </Paper>
  )
}
