import { Box, Button, Paper, Typography } from '@mui/material'
import type { AdminReceipt } from '../../../lib/api/treasury'
import { etiquetaMetodo, euros, fechaCorta } from '../contabilidad/formato'
import SelloEstado from './SelloEstado'

interface Props {
  recibos: AdminReceipt[]
  /** Con todos los años a la vista, cada recibo dice el suyo. */
  verAnio: boolean
  /** Mientras se cobra algo, ningún botón responde. */
  ocupado: boolean
  onCobrar: (recibo: AdminReceipt) => void
  onConfirmar: (recibo: AdminReceipt) => void
  onReemitir: (recibo: AdminReceipt) => void
}

/** A partir de este ancho del listado, tabla; por debajo, una tarjeta por recibo. */
const ANCHO_TABLA = 760

/**
 * Columnas de la tabla. La de la acción tiene ancho fijo y los botones la
 * llenan: «Cobrar», «Confirmar» y «Reemitir» miden lo mismo y quedan en
 * columna, en vez de bailar según lo largo de cada palabra.
 */
const COLUMNAS = 'minmax(0, 1.2fr) minmax(0, 1.5fr) 112px 124px 132px'

/** La línea de debajo del concepto: lo que hay que saber del estado. */
function detalle(r: AdminReceipt): string {
  switch (r.estado) {
    case 'PENDIENTE': return `Emitido el ${fechaCorta(r.fechaEmision)}`
    case 'REMESADO': return 'En el banco, sin confirmar'
    case 'PAGADO': return r.fechaPago ? `Cobrado el ${fechaCorta(r.fechaPago)}${r.metodoPago ? ` · ${etiquetaMetodo(r.metodoPago)}` : ''}` : 'Cobrado'
    case 'DEVUELTO': return r.tipo === 'PAPELETA_SITIO' ? 'Devuelto: se reemite en la mesa de reparto' : 'Devuelto: hay que reemitirlo'
    case 'EXENTO': return 'Exento de pago'
    case 'ANULADO': return 'Anulado'
  }
}

export default function ListaRecibos({ recibos, verAnio, ocupado, onCobrar, onConfirmar, onReemitir }: Props) {
  const enTabla = `@container (min-width: ${ANCHO_TABLA}px)`

  return (
    <Paper sx={{ containerType: 'inline-size', overflow: 'hidden' }}>
      <Box
        aria-hidden="true"
        sx={{
          display: 'none',
          [enTabla]: {
            display: 'grid', gridTemplateColumns: COLUMNAS, columnGap: 2.5, px: 2.75, py: 1.5,
            fontSize: 11.5, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.secondary',
            borderBottom: 1, borderColor: 'divider',
          },
        }}
      >
        <span>Hermano</span><span>Concepto</span><Box component="span" sx={{ textAlign: 'right' }}>Importe</Box><span>Estado</span><span />
      </Box>
      {recibos.map((r) => {
        const nombre = `${r.hermano.nombre} ${r.hermano.apellidos}`
        const apagado = r.estado === 'EXENTO' || r.estado === 'ANULADO'
        const reemitible = r.estado === 'DEVUELTO' && r.tipo !== 'PAPELETA_SITIO'
        const boton = (texto: string, etiqueta: string, accion: () => void) => (
          <Button
            variant="outlined"
            onClick={accion}
            disabled={ocupado}
            aria-label={etiqueta}
            sx={{ gridArea: 'accion', justifySelf: 'end', minWidth: 124, height: 40, whiteSpace: 'nowrap', [enTabla]: { justifySelf: 'stretch', minWidth: 0, height: 36 } }}
          >
            {texto}
          </Button>
        )
        return (
          <Box
            key={r.id}
            sx={{
              display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', columnGap: 2, rowGap: 1, alignItems: 'center',
              gridTemplateAreas: '"hermano importe" "concepto concepto" "estado accion"',
              px: { xs: 2, sm: 2.75 }, py: 1.75,
              borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 },
              // Un devuelto pide que alguien haga algo: se distingue también por el fondo.
              backgroundColor: r.estado === 'DEVUELTO' ? 'rgba(227,73,72,0.07)' : 'transparent',
              [enTabla]: { gridTemplateColumns: COLUMNAS, gridTemplateAreas: '"hermano concepto importe estado accion"', columnGap: 2.5, py: 1.5, minHeight: 64 },
            }}
          >
            <Box sx={{ gridArea: 'hermano', minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 15 }}>{nombre}</Typography>
              {r.hermano.numeroHermano !== null && <Typography color="text.secondary" sx={{ fontSize: 13 }}>n.º {r.hermano.numeroHermano}</Typography>}
            </Box>
            <Box sx={{ gridArea: 'concepto', minWidth: 0 }}>
              <Typography sx={{ fontSize: 14.5 }}>{r.concepto}{verAnio && ` (${r.year})`}</Typography>
              <Typography color="text.secondary" sx={{ fontSize: 13 }}>{detalle(r)}</Typography>
            </Box>
            <Typography
              sx={{
                gridArea: 'importe', textAlign: 'right', alignSelf: 'start', fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
                color: apagado ? 'text.secondary' : 'text.primary', textDecoration: r.estado === 'ANULADO' ? 'line-through' : 'none',
                [enTabla]: { alignSelf: 'center' },
              }}
            >
              {euros(Number(r.importe))}
            </Typography>
            <Box sx={{ gridArea: 'estado' }}><SelloEstado estado={r.estado} /></Box>
            {r.estado === 'PENDIENTE' && boton('Cobrar', `Cobrar ${r.concepto} de ${nombre}`, () => onCobrar(r))}
            {r.estado === 'REMESADO' && boton('Confirmar', `Confirmar el cobro de ${r.concepto} de ${nombre}`, () => onConfirmar(r))}
            {reemitible && boton('Reemitir', `Reemitir ${r.concepto} de ${nombre}`, () => onReemitir(r))}
          </Box>
        )
      })}
    </Paper>
  )
}
