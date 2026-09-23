import { useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, InputAdornment, Stack, TextField } from '@mui/material'
import type { AdminReceipt, AdminReceiptStatus } from '../../../lib/api/tesoreria'
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
  const papeleta = recibo.tipo === 'PAPELETA_SITIO' && (destino === 'DEVUELTO' || destino === 'ANULADO')
    ? ['Su papeleta de sitio queda anulada y su sitio en la procesión, libre.']
    : []
  switch (destino) {
    case 'REMESADO':
      return ['Queda en el banco, a la espera del cargo. Cuando llegue el dinero, pulsa «Confirmar» y se apunta el ingreso en Contabilidad.']
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
  onConfirmar: (comision?: number) => void
  onCancelar: () => void
}) {
  const [comision, setComision] = useState('')
  // Se limpia al abrir otro cambio, no al cerrar: así no parpadea mientras se va.
  const [deCambio, setDeCambio] = useState<CambioEstado | null>(null)
  if (cambio && cambio !== deCambio) { setDeCambio(cambio); setComision('') }

  const devolver = cambio?.destino === 'DEVUELTO'
  const texto = comision.trim()
  const comisionValida = texto === '' || (IMPORTE.test(texto) && Number(texto.replace(',', '.')) > 0)
  const confirmar = () => onConfirmar(devolver && texto ? Number(texto.replace(',', '.')) : undefined)
  const peligro = cambio?.destino === 'ANULADO' || cambio?.destino === 'DEVUELTO'

  return (
    <Dialog open={cambio !== null} onClose={guardando ? undefined : onCancelar} aria-labelledby="dialogo-estado-titulo" fullWidth maxWidth="xs">
      {cambio && <>
        <DialogTitle id="dialogo-estado-titulo">
          {accionDeCambio(cambio.recibo.estado, cambio.destino)}: {cambio.recibo.concepto}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <DialogContentText>
              {cambio.recibo.hermano.nombre} {cambio.recibo.hermano.apellidos} · {euros(Number(cambio.recibo.importe))}
            </DialogContentText>
            {explicacion(cambio).map((frase) => <DialogContentText key={frase}>{frase}</DialogContentText>)}
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
          <Button variant="contained" color={peligro ? 'error' : 'primary'} onClick={confirmar} disabled={guardando || !comisionValida}>
            {accionDeCambio(cambio.recibo.estado, cambio.destino)}
          </Button>
        </DialogActions>
      </>}
    </Dialog>
  )
}
