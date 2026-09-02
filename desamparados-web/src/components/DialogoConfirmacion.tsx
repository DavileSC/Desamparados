import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material'

interface Props {
  abierto: boolean
  titulo: string
  mensaje: string
  textoConfirmar?: string
  textoCancelar?: string
  peligro?: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

/**
 * Pregunta antes de hacer algo que cuesta deshacer. Sustituye a los
 * `window.confirm` del CMS, que no dicen sobre qué se está preguntando y no se
 * leen bien en el móvil.
 */
export default function DialogoConfirmacion({
  abierto,
  titulo,
  mensaje,
  textoConfirmar = 'Guardar',
  textoCancelar = 'Volver',
  peligro = false,
  onConfirmar,
  onCancelar,
}: Props) {
  return (
    <Dialog open={abierto} onClose={onCancelar} aria-labelledby="dialogo-confirmacion-titulo">
      <DialogTitle id="dialogo-confirmacion-titulo">{titulo}</DialogTitle>
      <DialogContent>
        <DialogContentText>{mensaje}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancelar}>{textoCancelar}</Button>
        <Button variant="contained" color={peligro ? 'error' : 'primary'} onClick={onConfirmar} autoFocus>
          {textoConfirmar}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
