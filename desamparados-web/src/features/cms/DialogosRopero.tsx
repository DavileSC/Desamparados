import { useState, type FormEvent } from 'react'
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, TextField } from '@mui/material'
import { asignarPrenda, buscarHermanoPorNumero, type HermanoDelRopero, type Prenda } from '../../lib/api/inventario'

const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error ? e.message : porDefecto)

interface DialogoPrestamoProps {
  /** La prenda que se va a prestar; null con el diálogo cerrado. */
  prenda: Prenda | null
  onCerrar: () => void
  onPrestada: (aviso: string) => void
}

/**
 * Prestar una prenda del ropero. Se busca al hermano por su número y se enseña
 * su nombre antes de confirmar: antes se tecleaba el id interno de la base de
 * datos, que nadie conoce, y un dígito de más prestaba la túnica a otro sin
 * que nada lo avisara.
 *
 * El padre lo monta con `key` de la prenda: cada préstamo empieza en blanco.
 */
export function DialogoPrestamo({ prenda, onCerrar, onPrestada }: DialogoPrestamoProps) {
  const [numero, setNumero] = useState('')
  const [hermano, setHermano] = useState<HermanoDelRopero | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buscar = async (evento?: FormEvent) => {
    evento?.preventDefault()
    const pedido = Number(numero)
    setHermano(null)
    setError(null)
    if (!Number.isInteger(pedido) || pedido <= 0) {
      setError('Escribe el número de hermano, solo con cifras.')
      return
    }
    setBuscando(true)
    try { setHermano(await buscarHermanoPorNumero(pedido)) }
    catch (e: unknown) { setError(mensaje(e, 'No se ha podido buscar al hermano.')) }
    finally { setBuscando(false) }
  }

  const prestar = async () => {
    if (!prenda || !hermano) return
    setGuardando(true)
    setError(null)
    try {
      await asignarPrenda(prenda.id, hermano.numeroHermano)
      onPrestada(`Prenda ${prenda.numero} prestada a ${hermano.nombre} ${hermano.apellidos}.`)
    } catch (e: unknown) {
      setError(mensaje(e, 'No se ha podido prestar la prenda.'))
      setGuardando(false)
    }
  }

  return (
    <Dialog open={prenda !== null} onClose={guardando ? undefined : onCerrar} aria-labelledby="dialogo-prestamo-titulo" fullWidth maxWidth="xs">
      <DialogTitle id="dialogo-prestamo-titulo">{prenda ? `Prestar la prenda ${prenda.numero}` : 'Prestar'}</DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={buscar} noValidate sx={{ pt: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <TextField
              label="Número de hermano"
              value={numero}
              onChange={(e) => { setNumero(e.target.value); setHermano(null) }}
              slotProps={{ htmlInput: { inputMode: 'numeric' } }}
              size="small"
              autoFocus
              fullWidth
            />
            <Button type="submit" variant="outlined" disabled={buscando || !numero.trim()} startIcon={buscando ? <CircularProgress size={16} /> : undefined}>
              Buscar
            </Button>
          </Stack>
        </Box>
        {hermano && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Nº {hermano.numeroHermano} · {hermano.nombre} {hermano.apellidos}
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button variant="contained" onClick={() => void prestar()} disabled={!hermano || guardando}>
          {hermano ? `Prestar a ${hermano.nombre}` : 'Prestar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

interface DialogoDevolucionProps {
  /** La prenda que vuelve; null con el diálogo cerrado. */
  prenda: Prenda | null
  onElegir: (necesitaLavado: boolean) => void
  onCancelar: () => void
}

/**
 * Registrar la devolución de una prenda: tres salidas claras. Antes era un
 * `window.confirm` que preguntaba por el lavado, y su «Cancelar» no cancelaba:
 * devolvía la prenda igualmente, como si no necesitara lavado.
 */
export function DialogoDevolucion({ prenda, onElegir, onCancelar }: DialogoDevolucionProps) {
  return (
    <Dialog open={prenda !== null} onClose={onCancelar} aria-labelledby="dialogo-devolucion-titulo">
      <DialogTitle id="dialogo-devolucion-titulo">{prenda ? `¿Cómo vuelve la prenda ${prenda.numero}?` : 'Devolver'}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {prenda?.hermano ? `La tenía ${prenda.hermano.nombre} ${prenda.hermano.apellidos}. ` : ''}
          Si necesita lavado o algún arreglo, pasa al taller; si vuelve en buen estado, queda disponible para prestarla otra vez.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap' }}>
        <Button onClick={onCancelar}>Cancelar</Button>
        <Button variant="outlined" onClick={() => onElegir(true)}>Con lavado: al taller</Button>
        <Button variant="contained" onClick={() => onElegir(false)}>Sin lavado: disponible</Button>
      </DialogActions>
    </Dialog>
  )
}
