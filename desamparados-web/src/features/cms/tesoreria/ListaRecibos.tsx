import { useState } from 'react'
import { Box, Button, ButtonBase, Checkbox, Divider, IconButton, ListItemText, Menu, MenuItem, Paper, Typography } from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { Link } from 'react-router-dom'
import type { AdminReceipt, AdminReceiptStatus } from '../../../lib/api/tesoreria'
import { etiquetaMetodo, euros, fechaCorta } from '../contabilidad/formato'
import SelloEstado from './SelloEstado'
import { accionDeCambio, cambiosDe, papeletaPorResolver } from './estados'

interface Props {
  recibos: AdminReceipt[]
  /** Con todos los años a la vista, cada recibo dice el suyo. */
  verAnio: boolean
  /** Mientras se cobra algo, ningún botón responde. */
  ocupado: boolean
  onCobrar: (recibo: AdminReceipt) => void
  onConfirmar: (recibo: AdminReceipt) => void
  onReemitir: (recibo: AdminReceipt) => void
  /** Remesar, devolver, anular o eximir: abre la confirmación. */
  onCambiarEstado: (recibo: AdminReceipt, destino: AdminReceiptStatus) => void
  /** Los elegidos para cobrarlos a la vez. Solo se eligen los pendientes. */
  elegidos: ReadonlySet<number>
  onElegir: (recibos: AdminReceipt[], elegir: boolean) => void
  /** Abre su ficha al lado. */
  onAbrir: (recibo: AdminReceipt) => void
  /** Solo el Hermano Mayor (y Administración) da por perdida una papeleta devuelta. */
  onDarPorPerdida?: (recibo: AdminReceipt) => void
}

/** Los que tienen apuntes en Contabilidad: el cobro, su reverso o la comisión del banco. */
const conApuntes = (r: AdminReceipt) => r.estado === 'PAGADO' || r.estado === 'DEVUELTO' || r.estado === 'REEMBOLSADO'

/** A partir de este ancho del listado, tabla; por debajo, una tarjeta por recibo. */
const ANCHO_TABLA = 760

/**
 * Columnas de la tabla. La de la acción tiene ancho fijo y los botones la
 * llenan: «Cobrar», «Confirmar» y «Reemitir» miden lo mismo y quedan en
 * columna, en vez de bailar según lo largo de cada palabra.
 */
const COLUMNAS = '32px minmax(0, 1.2fr) minmax(0, 1.5fr) 112px 124px 176px'

/** La línea de debajo del concepto: lo que hay que saber del estado. */
function detalle(r: AdminReceipt): string {
  switch (r.estado) {
    case 'PENDIENTE': return `Emitido el ${fechaCorta(r.fechaEmision)}`
    case 'REMESADO': return 'En el banco, sin confirmar'
    case 'PAGADO': return r.fechaPago ? `Cobrado el ${fechaCorta(r.fechaPago)}${r.metodoPago ? ` · ${etiquetaMetodo(r.metodoPago)}` : ''}` : 'Cobrado'
    case 'DEVUELTO': return r.reemitido ? 'Devuelto · ya reemitido o dado por perdido' : r.tipo === 'PAPELETA_SITIO' ? 'Devuelto: se cobra en la mesa cuando vuelva el hermano' : 'Devuelto: hay que reemitirlo'
    case 'REEMBOLSADO': return 'Reembolsado: no se debe nada'
    case 'EXENTO': return 'Exento de pago'
    case 'ANULADO': return 'Anulado'
  }
}

export default function ListaRecibos({ recibos, verAnio, ocupado, onCobrar, onConfirmar, onReemitir, onCambiarEstado, elegidos, onElegir, onAbrir, onDarPorPerdida }: Props) {
  const enTabla = `@container (min-width: ${ANCHO_TABLA}px)`
  const [menu, setMenu] = useState<{ ancla: HTMLElement; recibo: AdminReceipt } | null>(null)
  const cerrar = () => setMenu(null)
  // Solo se eligen los pendientes: lo remesado lo cobra el banco y lo demás ya no se cobra.
  const elegibles = recibos.filter((r) => r.estado === 'PENDIENTE')
  const todosElegidos = elegibles.length > 0 && elegibles.every((r) => elegidos.has(r.id))
  const algunoElegido = elegibles.some((r) => elegidos.has(r.id))

  return (
    <Paper sx={{ containerType: 'inline-size', overflow: 'hidden' }}>
      {elegibles.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: { xs: 1.25, sm: 2 }, pt: 1, fontSize: 13, color: 'text.secondary' }}>
          <Checkbox
            size="small"
            checked={todosElegidos}
            indeterminate={algunoElegido && !todosElegidos}
            onChange={(e) => onElegir(elegibles, e.target.checked)}
            slotProps={{ input: { 'aria-label': `Elegir los ${elegibles.length} pendientes de esta página` } }}
          />
          Elegir los pendientes de esta página
        </Box>
      )}
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
        <span /><span>Hermano</span><span>Concepto</span><Box component="span" sx={{ textAlign: 'right' }}>Importe</Box><span>Estado</span><span />
      </Box>
      {recibos.map((r) => {
        const nombre = `${r.hermano.nombre} ${r.hermano.apellidos}`
        const apagado = r.estado === 'EXENTO' || r.estado === 'ANULADO'
        const pendiente = r.estado === 'DEVUELTO' && !r.reemitido
        // Un devuelto ya resuelto no pide nada: se ve, atenuado, para que cuadre la cuenta de los devueltos.
        const resuelto = r.estado === 'DEVUELTO' && r.reemitido
        const reemitible = pendiente && r.tipo !== 'PAPELETA_SITIO'
        const boton = (texto: string, etiqueta: string, accion: () => void) => (
          <Button
            variant="outlined"
            onClick={accion}
            disabled={ocupado}
            aria-label={etiqueta}
            sx={{ minWidth: 124, height: 40, whiteSpace: 'nowrap', [enTabla]: { flex: 1, minWidth: 0, height: 36 } }}
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
              ...(elegidos.has(r.id) ? { backgroundColor: 'action.selected' } : {}),
              px: { xs: 2, sm: 2.75 }, py: 1.75,
              borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 },
              // Un devuelto pide que alguien haga algo: se distingue también por el fondo.
              backgroundColor: pendiente ? 'rgba(227,73,72,0.07)' : 'transparent',
              ...(resuelto ? { opacity: 0.6 } : {}),
              [enTabla]: { gridTemplateColumns: COLUMNAS, gridTemplateAreas: '"elegir hermano concepto importe estado accion"', columnGap: 2.5, py: 1.5, minHeight: 64 },
            }}
          >
            <Box sx={{ display: 'none', [enTabla]: { display: 'block', gridArea: 'elegir', ml: -1 } }}>
              {r.estado === 'PENDIENTE' && (
                <Checkbox size="small" checked={elegidos.has(r.id)} onChange={(e) => onElegir([r], e.target.checked)}
                  slotProps={{ input: { 'aria-label': `Elegir ${r.concepto} de ${nombre}` } }} />
              )}
            </Box>
            <Box sx={{ gridArea: 'hermano', minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 15 }}>{nombre}</Typography>
              {r.hermano.numeroHermano !== null && <Typography color="text.secondary" sx={{ fontSize: 13 }}>n.º {r.hermano.numeroHermano}</Typography>}
            </Box>
            <ButtonBase onClick={() => onAbrir(r)} aria-label={`Abrir la ficha de ${r.concepto} de ${nombre}`}
              sx={{ gridArea: 'concepto', minWidth: 0, display: 'block', textAlign: 'left', borderRadius: 1, '&:hover .concepto': { textDecoration: 'underline' }, '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 2 } }}>
              <Typography className="concepto" sx={{ fontSize: 14.5 }}>{r.concepto}{verAnio && ` (${r.year})`}</Typography>
              <Typography color="text.secondary" sx={{ fontSize: 13 }}>{detalle(r)}</Typography>
            </ButtonBase>
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
            <Box sx={{ gridArea: 'accion', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, [enTabla]: { justifyContent: 'stretch' } }}>
              {r.estado === 'PENDIENTE' && boton('Cobrar', `Cobrar ${r.concepto} de ${nombre}`, () => onCobrar(r))}
              {r.estado === 'REMESADO' && boton('Confirmar', `Confirmar el cobro de ${r.concepto} de ${nombre}`, () => onConfirmar(r))}
              {reemitible && boton('Reemitir', `Reemitir ${r.concepto} de ${nombre}`, () => onReemitir(r))}
              {(cambiosDe(r).length > 0 || conApuntes(r) || (onDarPorPerdida && papeletaPorResolver(r))) ? (
                <IconButton aria-label={`Más acciones de ${r.concepto} de ${nombre}`} onClick={(e) => setMenu({ ancla: e.currentTarget, recibo: r })} disabled={ocupado} sx={{ ml: 'auto', [enTabla]: { ml: 0 } }}>
                  <MoreVertIcon />
                </IconButton>
              ) : <Box sx={{ width: 40, flexShrink: 0 }} />}
            </Box>
          </Box>
        )
      })}
      <Menu anchorEl={menu?.ancla} open={menu !== null} onClose={cerrar}>
        {menu && cambiosDe(menu.recibo).map((destino) => (
          <MenuItem key={destino} onClick={() => { cerrar(); onCambiarEstado(menu.recibo, destino) }}>
            {accionDeCambio(destino)}
          </MenuItem>
        ))}
        {menu && cambiosDe(menu.recibo).length > 0 && conApuntes(menu.recibo) && <Divider />}
        {menu && onDarPorPerdida && papeletaPorResolver(menu.recibo) && (
          <MenuItem onClick={() => { cerrar(); onDarPorPerdida(menu.recibo) }}>
            <ListItemText primary="Darla por perdida" secondary="No se va a cobrar: lo decide el Hermano Mayor" />
          </MenuItem>
        )}
        {menu && conApuntes(menu.recibo) && (
          <MenuItem component={Link} to={`/cms/contabilidad?recibo=${menu.recibo.id}`} onClick={cerrar}>
            <ListItemText primary="Ver en Contabilidad" secondary="Sus apuntes en el libro de caja" />
          </MenuItem>
        )}
      </Menu>
    </Paper>
  )
}
