import { useState } from 'react'
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, InputAdornment, Stack, TextField } from '@mui/material'
import type { AdminReceipt, AdminReceiptStatus, DatosDevolucion } from '../../../lib/api/tesoreria'
import { hoy } from '../../../lib/fechas'
import { diaEnMadrid } from '../../../lib/horaDeMadrid'
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
      return [
        'El recibo deja de contar. En Contabilidad no se apunta nada.',
        ...(recibo.estado === 'REMESADO' ? [ANULAR_REMESADO] : []),
        ...papeleta,
        'No se puede deshacer.',
      ]
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

// Un remesado va en un fichero SEPA ya generado, y anularlo aquí no lo saca de
// él: si el fichero está en el banco, el cargo llega igual, y el abono de la
// remesa deja de cuadrar con lo apuntado (el extracto lo manda a dudosos).
const ANULAR_REMESADO = 'Va en una remesa ya generada. Anularlo aquí no lo saca del fichero: si ya está en el banco, el banco lo cargará igual al hermano, y entonces habrá que devolvérselo aparte. El abono de esa remesa no cuadrará con lo apuntado y el extracto lo dejará como dudoso.'

const comoDia = (dia: string) => dia.split('-').reverse().join('/')

// Lo mismo que acepta el servidor: positivo y con dos decimales como mucho.
const IMPORTE = /^\d{1,8}(?:[.,]\d{1,2})?$/

/**
 * Confirma un cambio de estado. Al devolver, pide también la comisión del
 * banco, si la hubo: se apunta como gasto en «Comisiones bancarias».
 */
export default function DialogoEstado({ cambio, guardando, error, errorDelDia = null, onConfirmar, onCancelar }: {
  cambio: CambioEstado | null
  guardando: boolean
  error: string | null
  /** El servidor rechazó el día de la devolución: se dice junto a ese campo. */
  errorDelDia?: string | null
  onConfirmar: (devolucion: DatosDevolucion) => void
  onCancelar: () => void
}) {
  const [comision, setComision] = useState('')
  const [dia, setDia] = useState(hoy)
  // Se limpia al abrir otro cambio, no al cerrar: así no parpadea mientras se va.
  const [deCambio, setDeCambio] = useState<CambioEstado | null>(null)
  const [aSabiendas, setASabiendas] = useState(false)
  if (cambio && cambio !== deCambio) { setDeCambio(cambio); setComision(''); setDia(hoy()); setASabiendas(false) }

  const devolver = cambio?.destino === 'DEVUELTO'
  const texto = comision.trim()
  const comisionValida = texto === '' || (IMPORTE.test(texto) && Number(texto.replace(',', '.')) > 0)
  // Un día que ya haya llegado y no de antes del cobro: el servidor rechaza los
  // dos (un año mal puesto llevaba el reverso a un ejercicio sin su ingreso).
  // El cobro, en su día de Madrid, que es como lo compara el servidor.
  const diaDelCobro = cambio?.recibo.estado === 'PAGADO' && cambio.recibo.fechaPago ? diaEnMadrid(cambio.recibo.fechaPago) : null
  const formatoValido = /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia <= hoy()
  const antesDelCobro = diaDelCobro !== null && dia < diaDelCobro
  const diaValido = formatoValido && !antesDelCobro
  // Anular un remesado pide decir aparte que se sabe lo del banco.
  const pideASabiendas = cambio?.destino === 'ANULADO' && cambio.recibo.estado === 'REMESADO'
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
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hoy(), ...(diaDelCobro ? { min: diaDelCobro } : {}) } }}
                error={!diaValido || Boolean(errorDelDia)}
                helperText={antesDelCobro && diaDelCobro
                  ? `No puede ser anterior al cobro, el ${comoDia(diaDelCobro)}.`
                  : !formatoValido ? 'Un día que ya haya pasado, o hoy.'
                  : errorDelDia ?? 'El que trae el extracto del banco. El cobro anulado y la comisión se apuntan ese día.'}
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
            {pideASabiendas && (
              <FormControlLabel
                control={<Checkbox checked={aSabiendas} onChange={(e) => setASabiendas(e.target.checked)} />}
                label="Entiendo que, si la remesa ya está subida, el banco lo cargará de todos modos."
              />
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancelar} disabled={guardando}>Volver</Button>
          <Button variant="contained" color={peligro ? 'error' : 'primary'} onClick={confirmar} disabled={guardando || !comisionValida || (devolver && !diaValido) || (pideASabiendas && !aSabiendas)}>
            {accionDeCambio(cambio.destino)}
          </Button>
        </DialogActions>
      </>}
    </Dialog>
  )
}
