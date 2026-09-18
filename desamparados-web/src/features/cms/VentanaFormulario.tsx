import { useId, useState, type ReactNode } from 'react'
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'

interface Props {
  abierto: boolean
  titulo: string
  /** Hay algo escrito: cerrar sin guardar pregunta antes de tirarlo. */
  sucio: boolean
  guardando?: boolean
  /** Faltan datos obligatorios: el botón de guardar queda deshabilitado. */
  puedeGuardar?: boolean
  textoGuardar?: string
  /** Motivo del último fallo al guardar; se enseña dentro de la ventana. */
  error?: string | null
  /** `md` para los formularios largos (noticias, publicaciones). */
  ancho?: 'sm' | 'md'
  onGuardar: () => void | Promise<void>
  /** Cierra sin guardar. Quien la abre decide si limpia el formulario. */
  onCerrar: () => void
  children: ReactNode
}

/**
 * Ventana de alta de los listados del CMS: el historial se ve al entrar y el
 * formulario sale encima al pulsar «Nuevo…».
 *
 * Un clic fuera, la tecla Esc o Cancelar con algo escrito preguntan antes de
 * cerrar: en una ventana es fácil perder una noticia a medias sin querer. Si
 * guardar falla, el motivo sale aquí dentro y lo escrito sigue en su sitio.
 */
export default function VentanaFormulario({
  abierto,
  titulo,
  sucio,
  guardando = false,
  puedeGuardar = true,
  textoGuardar = 'Guardar',
  error = null,
  ancho = 'sm',
  onGuardar,
  onCerrar,
  children,
}: Props) {
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false)
  const idTitulo = useId()

  const pedirCierre = () => {
    // Mientras guarda no se cierra: la respuesta del servidor aún puede traer un error que enseñar.
    if (guardando) return
    if (sucio) setConfirmandoDescarte(true)
    else onCerrar()
  }

  return (
    <>
      <Dialog open={abierto} onClose={pedirCierre} fullWidth maxWidth={ancho} scroll="paper" aria-labelledby={idTitulo}>
        <DialogTitle id={idTitulo} sx={{ fontFamily: (t) => t.typography.h1.fontFamily, fontWeight: 400, fontSize: 24, pb: 1 }}>
          {titulo}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.25} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {children}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={pedirCierre} disabled={guardando}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => void onGuardar()}
            disabled={guardando || !puedeGuardar}
            startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {textoGuardar}
          </Button>
        </DialogActions>
      </Dialog>

      <DialogoConfirmacion
        abierto={confirmandoDescarte}
        titulo="¿Descartar lo escrito?"
        mensaje={`Si cierras ahora, se pierde lo que has escrito en «${titulo}».`}
        textoConfirmar="Descartar"
        textoCancelar="Seguir escribiendo"
        peligro
        onConfirmar={() => { setConfirmandoDescarte(false); onCerrar() }}
        onCancelar={() => setConfirmandoDescarte(false)}
      />
    </>
  )
}
