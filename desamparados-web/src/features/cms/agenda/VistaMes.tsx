import { Box, ButtonBase, Paper } from '@mui/material'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { useTemaCms } from '../../../app/useTemaCms'
import type { EventoDelCalendario } from '../../../lib/api/agenda'
import { segunModo } from '../../../theme/cms'
import { claveDia, colores, type Tramo } from './calendario'
import { hora, loQueFalta } from './fechas'
import { MARCA, alfa } from '../../../theme/marca'

const DIAS_SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

/** Cuántos actos caben escritos en una casilla con el alto de siempre; el resto, «y 2 más». */
const EN_CASILLA = 2
/** Lo que miden, más o menos, la fila de los días de la semana, la leyenda, el número del día y un acto con su hora y dos líneas. */
const CABECERA = 37
const LEYENDA = 42
const NUMERO = 36
const ACTO = 50
const Y_MAS = 16

type ActoDelDia = { evento: EventoDelCalendario; tramo: Tramo }

interface Props {
  /** El primer día del mes que se ve. */
  primero: Date
  dias: Date[]
  porDia: Map<string, ActoDelDia[]>
  /** El día abierto en el panel, como `claveDia`. */
  elegido: string
  portada: number[]
  hoy?: Date
  /** El alto que tiene que llenar, justo hasta el final de la ventana; sin él, el de siempre. */
  alto?: number | null
  onElegir: (dia: Date) => void
}

/**
 * El mes como un calendario de pared, de lunes a domingo. Cada casilla
 * enseña sus actos con la hora y el título; pulsarla abre el día en el panel
 * de al lado, que es donde se edita. En el móvil las casillas se quedan en el
 * número y un punto por acto, del color de su tipo.
 *
 * Los días de reparto de papeletas los pone Procesión: van con el borde
 * discontinuo, como en el calendario del Inicio.
 */
export default function VistaMes({ primero, dias, porDia, elegido, portada, hoy = new Date(), alto, onElegir }: Props) {
  const { superficies } = useTemaCms()
  const claveHoy = claveDia(hoy)
  const semanas = dias.length / 7
  // A la medida de la ventana, las semanas se reparten el alto y en cada
  // casilla caben los actos que quepan; si no, el alto de siempre.
  const altoFila = alto ? (alto - CABECERA - LEYENDA) / semanas : null
  const enCasilla = altoFila ? Math.max(1, Math.floor((altoFila - NUMERO - Y_MAS) / ACTO)) : EN_CASILLA

  return (
    <Paper sx={{ overflow: 'hidden', minWidth: 0, ...(alto && { height: alto, display: 'flex', flexDirection: 'column' }) }}>
      <Box aria-hidden="true" sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {DIAS_SEMANA.map((d) => (
          <Box key={d} sx={{ px: { xs: 0.5, md: 1.25 }, py: 1, fontSize: 11.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary', textAlign: { xs: 'center', md: 'left' } }}>
            {d}
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', ...(alto && { flex: 1, minHeight: 0, gridTemplateRows: `repeat(${semanas}, minmax(0, 1fr))` }) }}>
        {dias.map((dia, i) => {
          const clave = claveDia(dia)
          const actos = porDia.get(clave) ?? []
          const fuera = dia.getMonth() !== primero.getMonth()
          const esHoy = clave === claveHoy
          const abierto = clave === elegido
          const etiqueta = [
            dia.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }),
            actos.length === 0 ? 'sin actos' : actos.length === 1 ? '1 acto' : `${actos.length} actos`,
            esHoy && 'hoy',
          ].filter(Boolean).join(', ')
          return (
            <ButtonBase
              key={clave}
              disableRipple
              onClick={() => onElegir(dia)}
              aria-label={etiqueta}
              aria-pressed={abierto}
              sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start', gap: '3px',
                minWidth: 0, minHeight: alto ? 0 : { xs: 52, md: 118 }, overflow: 'hidden', p: { xs: '4px', md: '6px' }, textAlign: 'left', fontFamily: 'inherit',
                borderTop: 1, borderLeft: i % 7 === 0 ? 0 : 1, borderColor: 'divider',
                backgroundColor: abierto ? segunModo(alfa(MARCA.principal, 0.06), alfa(MARCA.principalPalido, 0.08)) : 'transparent',
                boxShadow: abierto ? `inset 0 0 0 1.5px ${superficies.enlace}` : 'none',
                '&:hover': { backgroundColor: abierto ? undefined : segunModo('rgba(0,0,0,0.025)', 'rgba(255,255,255,0.035)') },
                '&.Mui-focusVisible': { outline: `2px solid ${superficies.enlace}`, outlineOffset: -2 },
              }}
            >
              <Box
                component="span"
                sx={{
                  alignSelf: { xs: 'center', md: 'flex-start' }, width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  display: 'inline-grid', placeItems: 'center', fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                  backgroundColor: esHoy ? superficies.enlace : 'transparent',
                  color: esHoy ? segunModo('#fff', '#0c0b0d') : 'text.primary',
                  opacity: fuera && !esHoy ? 0.4 : 1,
                }}
              >
                {dia.getDate()}
              </Box>

              {/* Escritorio: los actos escritos. */}
              <Box component="span" sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: '3px', opacity: fuera ? 0.6 : 1 }}>
                {actos.slice(0, enCasilla).map(({ evento, tramo }) => (
                  <ChipActo key={evento.id} evento={evento} tramo={tramo} enPortada={portada.includes(evento.id)} />
                ))}
                {actos.length > enCasilla && (
                  <Box component="span" sx={{ fontSize: 11.5, color: 'text.secondary', pl: 0.5 }}>y {actos.length - enCasilla} más</Box>
                )}
              </Box>

              {/* Móvil: un punto por acto. */}
              <Box component="span" aria-hidden="true" sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'center', gap: '3px', flexWrap: 'wrap', opacity: fuera ? 0.6 : 1 }}>
                {actos.slice(0, 4).map(({ evento }) => (
                  <Box
                    key={evento.id}
                    component="span"
                    sx={evento.reparto
                      ? { width: 7, height: 7, borderRadius: '50%', border: 1, borderStyle: 'dashed', borderColor: 'text.secondary' }
                      : { width: 7, height: 7, borderRadius: '50%', backgroundColor: colores(evento.type).filete }}
                  />
                ))}
              </Box>
            </ButtonBase>
          )
        })}
      </Box>
      <Leyenda />
    </Paper>
  )
}

/**
 * Un acto en su casilla: la hora y el título en dos líneas como mucho, con
 * el filete de su tipo. En los días que siguen al primero de un triduo, sin
 * hora y con el filete punteado: es el mismo acto que continúa.
 */
function ChipActo({ evento, tramo, enPortada }: { evento: EventoDelCalendario; tramo: Tramo; enPortada: boolean }) {
  const { superficies } = useTemaCms()
  const sigue = tramo === 'medio' || tramo === 'fin'
  const falta = loQueFalta(evento).length > 0 && !evento.reparto
  const { fondo, filete } = colores(evento.type)
  const marcas = enPortada || falta
  return (
    <Box
      component="span"
      sx={{
        position: 'relative', display: 'block', minWidth: 0, borderRadius: '4px', py: '3px', pl: 0.75, pr: marcas ? 2.5 : 0.75,
        fontSize: 12, lineHeight: 1.25, color: 'text.primary',
        ...(evento.reparto
          ? { border: 1, borderStyle: 'dashed', borderColor: 'text.secondary' }
          : { backgroundColor: fondo, borderLeft: `3px ${sigue ? 'dotted' : 'solid'} ${filete}` }),
      }}
    >
      {!sigue && (
        <Box component="span" sx={{ display: 'block', fontSize: 11, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
          {hora(new Date(evento.startDate))}
        </Box>
      )}
      <Box component="span" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontWeight: 500, wordBreak: 'break-word' }}>
        {evento.title}
      </Box>
      {marcas && (
        <Box component="span" aria-hidden="true" sx={{ position: 'absolute', top: 3, right: 3, display: 'flex', flexDirection: 'column', gap: '1px', '& svg': { fontSize: 13 } }}>
          {enPortada && <HomeOutlinedIcon sx={{ color: superficies.enlace }} />}
          {falta && <WarningAmberIcon sx={{ color: superficies.avisoTexto }} />}
        </Box>
      )}
    </Box>
  )
}

/** Lo que no dice el color del tipo, que ya está en los filtros de arriba. */
function Leyenda() {
  const { superficies } = useTemaCms()
  const muestra = { display: 'inline-flex', alignItems: 'center', gap: 0.75 } as const
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', px: 2, py: 1.25, borderTop: 1, borderColor: 'divider', fontSize: 12.5, color: 'text.secondary', '& svg': { fontSize: 15 } }}>
      <Box component="span" sx={muestra}>
        <Box component="span" sx={{ width: 14, height: 10, borderRadius: '3px', border: 1, borderStyle: 'dashed', borderColor: 'text.secondary' }} />Reparto de papeletas
      </Box>
      <Box component="span" sx={{ ...muestra, gap: 0.5 }}><HomeOutlinedIcon sx={{ color: superficies.enlace }} />En portada</Box>
      <Box component="span" sx={{ ...muestra, gap: 0.5 }}><WarningAmberIcon sx={{ color: superficies.avisoTexto }} />Le falta el lugar o la descripción</Box>
    </Box>
  )
}
