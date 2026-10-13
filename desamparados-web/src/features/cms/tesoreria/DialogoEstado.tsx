import { useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, InputAdornment, Stack, TextField } from '@mui/material'
import type { AdminReceipt, AdminReceiptStatus, DatosDevolucion } from '../../../lib/api/tesoreria'
import { hoy } from '../../../lib/fechas'
import { euros } from '../contabilidad/formato'
import { accionDeCambio } from './estados'

/** Lo que el diálogo necesita saber de un cambio: el recibo y a dónde va. */
export interface CambioEstado {
  recibo: AdminReceipt
  destino: AdminReceiptStatus
}

/**
 * Qué pasa con el recibo y, sobre todo, qué pasa en Contabilidad: es lo que
 * Tesorería tiene que saber antes de confirmar, porque desde Contabilidad los
 * apuntes de un recibo no se pueden tocar.
 */
function explicacion({ recibo, destino }: CambioEstado): string[] {
  const importe = euros(Number(recibo.importe))
  const papeleta = recibo.tipo === 'PAPELETA_SITIO' && (destino === 'DEVUELTO' || destino === 'REEMBOLSADO' || destino === 'ANULADO')
    ? ['Su papeleta de sitio queda anulada y su sitio en la procesión, libre.']
    : []
  switch (destino) {
    case 'EXENTO':
      return ['El hermano no paga este recibo. En Contabilidad no se apunta nada.', 'No se puede deshacer.']
    case 'ANULADO':
      return ['El recibo deja de contar. En Contabilidad no se apunta nada.', ...papeleta, 'No se puede deshacer.']
    case 'DEVUELTO':
      return [
        recibo.estado === 'PAGADO'
          ? `En Contabilidad se apunta un gasto de ${importe} que anula el cobro.`
          : 'No llegó a entrar dinero, así que en Contabilidad no hay cobro que anular.',
        ...papeleta,
        'Para volver a cobrarlo, se reemite como recibo nuevo.',
      ]
    case 'REEMBOLSADO':
      return [
        `En Contabilidad se apunta un gasto de ${importe} que anula el cobro.`,
        ...papeleta,
        'Es dinero que se le devuelve al hermano: no queda nada por cobrar y no se reemite.',
        'No se puede deshacer.',
      ]
    default:
      return []
  }
}

// Lo mismo que acepta el servidor: positivo y con dos decimales como mucho.
const IMPORTE = /^\d{1,8}(?:[.,]\d{1,2})?$/

/**
 * Confirma un cambio de estado. Al devolver, pide también la comisión del
 * banco, si la hubo: se apunta como gasto en «Comisiones bancarias».
 */
export default function DialogoEstado({ cambio, guardando, error, onConfirmar, onCancelar }: {
  cambio: CambioEstado | null
  guardando: boolean
  error: string | null
  onConfirmar: (devolucion: DatosDevolucion) => void
  onCancelar: () => void
}) {
  const [comision, setComision] = useState('')
  const [dia, setDia] = useState(hoy)
  // Se limpia al abrir otro cambio, no al cerrar: así no parpadea mientras se va.
  const [deCambio, setDeCambio] = useState<CambioEstado | null>(null)
  if (cambio && cambio !== deCambio) { setDeCambio(cambio); setComision(''); setDia(hoy()) }

  const devolver = cambio?.destino === 'DEVUELTO'
  const texto = comision.trim()
  const comisionValida = texto === '' || (IMPORTE.test(texto) && Number(texto.replace(',', '.')) > 0)
  // Un día que ya haya llegado: el servidor rechaza los de mañana.
  const diaValido = /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia <= hoy()
  const confirmar = () => onConfirmar(devolver
    ? { ...(texto ? { comision: Number(texto.replace(',', '.')) } : {}), fechaDevolucion: dia }
    : {})
  const peligro = cambio?.destino === 'ANULADO' || cambio?.destino === 'DEVUELTO' || cambio?.destino === 'REEMBOLSADO'

  return (
    <Dialog open={cambio !== null} onClose={guardando ? undefined : onCancelar} aria-labelledby="dialogo-estado-titulo" fullWidth maxWidth="xs">
      {cambio && <>
        <DialogTitle id="dialogo-estado-titulo">
          {accionDeCambio(cambio.destino)}: {cambio.recibo.concepto}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <DialogContentText>
              {cambio.recibo.hermano.nombre} {cambio.recibo.hermano.apellidos} · {euros(Number(cambio.recibo.importe))}
            </DialogContentText>
            {explicacion(cambio).map((frase) => <DialogContentText key={frase}>{frase}</DialogContentText>)}
            {devolver && (
              <TextField
                type="date"
                label="Día de la devolución"
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hoy() } }}
                error={!diaValido}
                helperText={diaValido ? 'El que trae el extracto del banco. El cobro anulado y la comisión se apuntan ese día.' : 'Un día que ya haya pasado, o hoy.'}
                fullWidth
              />
            )}
            {devolver && (
              <TextField
                label="Comisión del banco (opcional)"
                value={comision}
                onChange={(e) => setComision(e.target.value)}
                slotProps={{ htmlInput: { inputMode: 'decimal' }, input: { endAdornment: <InputAdornment position="end">€</InputAdornment> } }}
                error={!comisionValida}
                helperText={comisionValida ? 'Lo que cobró el banco por la devolución. Se apunta como gasto en «Comisiones bancarias».' : 'Un importe mayor que cero, con dos decimales como mucho (por ejemplo, 3,50).'}
                fullWidth
              />
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancelar} disabled={guardando}>Volver</Button>
          <Button variant="contained" color={peligro ? 'error' : 'primary'} onClick={confirmar} disabled={guardando || !comisionValida || (devolver && !diaValido)}>
            {accionDeCambio(cambio.destino)}
          </Button>
        </DialogActions>
      </>}
    </Dialog>
  )
}
