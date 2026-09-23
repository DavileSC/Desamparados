import { Box, ButtonBase, Typography } from '@mui/material'
import type { AdminReceiptStatus, ResumenRecibos } from '../../../lib/api/tesoreria'
import { euros } from '../contabilidad/formato'
import { ESTADOS_RECIBO, ORDEN_ESTADOS, tonoDeEstado } from './estados'
import { segunModo } from '../../../theme/cms'

interface Props {
  /** `null` mientras llega: los contadores se pintan en gris, sin cifras. */
  resumen: ResumenRecibos | null
  /** El estado elegido; `''` es «Todos». */
  elegido: AdminReceiptStatus | ''
  onElegir: (estado: AdminReceiptStatus | '') => void
}

/** A partir de este ancho de la barra caben los siete en una fila; por debajo, se deslizan. */
const ANCHO_EN_FILA = 880

/**
 * Cuántos recibos hay en cada estado y cuánto suman, y a la vez el filtro de
 * estado: pulsar uno enseña solo esos, pulsar «Todos» los enseña todos. Así
 * «¿cómo vamos?» se contesta sin leer el listado.
 *
 * Las cifras salen del servidor con la búsqueda, el año y el tipo del listado,
 * no de la página que se ve: con veinte recibos por página, contar en la
 * pantalla diría 20 pendientes cuando hay 300.
 */
export default function ContadoresEstado({ resumen, elegido, onElegir }: Props) {
  const estados = resumen?.estados
  const todos = estados ? ORDEN_ESTADOS.reduce((suma, e) => suma + (estados[e]?.cuenta ?? 0), 0) : null

  const contadores = [
    { clave: '' as const, etiqueta: 'Todos', color: segunModo('#4a454a', '#cbc5c8'), fondo: segunModo('rgba(0,0,0,0.05)', 'rgba(255,255,255,0.08)'), cuenta: todos, pie: 'recibos' },
    ...ORDEN_ESTADOS.map((clave) => {
      const estado = ESTADOS_RECIBO[clave]
      const tono = tonoDeEstado(clave)
      const dato = estados?.[clave]
      return {
        clave,
        etiqueta: estado.plural,
        color: tono.texto,
        fondo: tono.fondo,
        cuenta: dato?.cuenta ?? null,
        // Exentos y anulados no suman en ningún total: enseñar su importe invitaría a sumarlo.
        pie: estado.cuenta === 'nada' ? 'no cuentan' : dato ? euros(dato.total) : '',
      }
    }),
  ]

  return (
    <Box role="group" aria-label="Recibos por estado" sx={{ containerType: 'inline-size', mb: 2.5 }}>
      <Box
        sx={{
          display: 'flex', gap: 1.25, overflowX: 'auto', scrollSnapType: 'x proximity', pb: 0.5,
          // Sin barra: el contador cortado en el borde ya dice que la fila sigue.
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
          [`@container (min-width: ${ANCHO_EN_FILA}px)`]: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', overflowX: 'visible', pb: 0 },
        }}
      >
        {contadores.map((c) => {
          const activo = elegido === c.clave
          return (
            <ButtonBase
              key={c.clave || 'todos'}
              onClick={() => onElegir(c.clave)}
              aria-pressed={activo}
              sx={{
                flex: '0 0 140px', scrollSnapAlign: 'start',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.75,
                p: 1.75, borderRadius: 3, textAlign: 'left',
                border: 1, borderColor: activo ? c.color : 'divider',
                backgroundColor: activo ? c.fondo : 'background.paper',
                transition: 'background-color 120ms, border-color 120ms',
                '&:hover': { backgroundColor: c.fondo },
                '&.Mui-focusVisible': { outline: '2px solid', outlineColor: c.color, outlineOffset: 2 },
              }}
            >
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.875, fontSize: 13, fontWeight: 600, color: c.color }}>
                <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: c.color }} />
                {c.etiqueta}
              </Box>
              <Typography component="span" sx={{ fontFamily: (theme) => theme.typography.h1.fontFamily, fontSize: 28, lineHeight: 1, color: 'text.primary' }}>
                {c.cuenta ?? '–'}
              </Typography>
              <Typography component="span" sx={{ fontSize: 12.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums', minHeight: '1.25em' }}>
                {c.pie}
              </Typography>
            </ButtonBase>
          )
        })}
      </Box>
    </Box>
  )
}
