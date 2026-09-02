import { useState, type ReactNode } from 'react'
import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import { useBlocker, useNavigate } from 'react-router-dom'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'

interface Props {
  titulo: string
  nombre: string
  sucio: boolean
  guardando?: boolean
  volverA: string
  onGuardar: () => void | Promise<void>
  children: ReactNode
}

/**
 * Marco de las pantallas de edición del CMS.
 *
 * El aviso de «tienes cambios sin guardar» va con `useBlocker`, no colgado del
 * botón Cancelar: así salta también si se navega con el botón atrás del
 * navegador o pulsando otra sección del menú lateral. Necesita un data router
 * (`createBrowserRouter`), que es lo que monta la aplicación.
 */
export default function PantallaEdicion({ titulo, nombre, sucio, guardando = false, volverA, onGuardar, children }: Props) {
  const navegar = useNavigate()
  const [confirmandoGuardado, setConfirmandoGuardado] = useState(false)

  // `guardando` queda fuera del bloqueo a propósito: la pantalla navega al
  // listado en cuanto el servidor responde, y en ese momento el formulario
  // sigue distinto del que se cargó. Sin esta condición, guardar terminaba
  // preguntando si se pierden los cambios que se acaban de guardar.
  const bloqueo = useBlocker(({ currentLocation, nextLocation }) => sucio && !guardando && currentLocation.pathname !== nextLocation.pathname)

  return (
    <>
      <Typography variant="h2" component="h1" sx={{ mb: 0.5 }}>{titulo}</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>{nombre}</Typography>

      <Paper sx={{ p: { xs: 2.5, md: 4 }, maxWidth: 900 }}>
        {children}

        <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
          <Button variant="contained" disabled={guardando} onClick={() => setConfirmandoGuardado(true)}>Guardar</Button>
          <Button disabled={guardando} onClick={() => navegar(volverA)}>Cancelar</Button>
        </Stack>
      </Paper>

      <DialogoConfirmacion
        abierto={confirmandoGuardado}
        titulo="¿Guardar los cambios?"
        mensaje={nombre}
        textoConfirmar="Guardar cambios"
        onConfirmar={() => { setConfirmandoGuardado(false); void onGuardar() }}
        onCancelar={() => setConfirmandoGuardado(false)}
      />

      <DialogoConfirmacion
        abierto={bloqueo.state === 'blocked'}
        titulo="Hay cambios sin guardar"
        mensaje="Si sales ahora se van a perder los cambios que has hecho en esta ficha."
        textoConfirmar="Salir sin guardar"
        textoCancelar="Seguir editando"
        peligro
        onConfirmar={() => bloqueo.proceed?.()}
        onCancelar={() => bloqueo.reset?.()}
      />

      <Box sx={{ height: 24 }} />
    </>
  )
}
