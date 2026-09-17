import { useState, type ReactNode } from 'react'
import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import { useBlocker, useNavigate } from 'react-router-dom'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'

/** Ancho de la columna de edición. Antes era 900 y pegada a la izquierda. */
export const ANCHO_EDICION = 1100

interface Props {
  titulo: string
  nombre: string
  sucio: boolean
  guardando?: boolean
  volverA: string
  onGuardar: () => void | Promise<void>
  /**
   * Con esto, Guardar y Descartar van en una barra pegada al borde de abajo de
   * la ventana, siempre a la vista: para pantallas largas (la portada), donde
   * los botones del final quedan a varias pantallas del campo que se cambia.
   * Descartar vuelve el formulario a lo guardado, sin salir de la pantalla.
   */
  onDescartar?: () => void
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
export default function PantallaEdicion({ titulo, nombre, sucio, guardando = false, volverA, onGuardar, onDescartar, children }: Props) {
  const navegar = useNavigate()
  const [confirmandoGuardado, setConfirmandoGuardado] = useState(false)
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false)

  // `guardando` queda fuera del bloqueo a propósito: la pantalla navega al
  // listado en cuanto el servidor responde, y en ese momento el formulario
  // sigue distinto del que se cargó. Sin esta condición, guardar terminaba
  // preguntando si se pierden los cambios que se acaban de guardar.
  const bloqueo = useBlocker(({ currentLocation, nextLocation }) => sucio && !guardando && currentLocation.pathname !== nextLocation.pathname)

  return (
    <>
      {/* Título, subtítulo y panel van juntos en una columna centrada: en un
          monitor ancho quedan márgenes iguales a los dos lados en vez de todo
          el aire a la derecha, y en un portátil la columna ocupa casi todo.
          El tope no es la pantalla entera: un formulario de lado a lado se
          lee peor y los campos cortos se estirarían sin motivo. */}
      <Box sx={{ maxWidth: ANCHO_EDICION, mx: 'auto' }}>
        <Typography variant="h2" component="h1" sx={{ mb: 0.5 }}>{titulo}</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>{nombre}</Typography>

        <Paper sx={{ p: { xs: 2.5, md: 4 } }}>
          {children}

          {!onDescartar && (
            <Stack direction="row" spacing={2} sx={{ mt: 4 }}>
              <Button variant="contained" disabled={guardando} onClick={() => setConfirmandoGuardado(true)}>Guardar</Button>
              <Button disabled={guardando} onClick={() => navegar(volverA)}>Cancelar</Button>
            </Stack>
          )}
        </Paper>

        {onDescartar && (
          <Paper
            role="region"
            aria-label="Guardar o descartar los cambios"
            elevation={8}
            sx={{
              position: 'sticky',
              bottom: { xs: 12, md: 20 },
              zIndex: (tema) => tema.zIndex.appBar,
              mt: 2,
              px: { xs: 2, md: 3 },
              py: 1.5,
              display: 'flex',
              // En un móvil, el aviso arriba y los dos botones en su fila: con
              // `wrap` cada botón caía en una línea y la barra se comía la pantalla.
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              gap: 1.5,
              border: 1,
              borderColor: sucio ? 'primary.main' : 'divider',
            }}
          >
            <Typography variant="body2" aria-live="polite" sx={{ flex: '1 1 auto', fontWeight: sucio ? 600 : 400, color: sucio ? 'text.primary' : 'text.secondary' }}>
              {guardando ? 'Guardando…' : sucio ? 'Hay cambios sin guardar' : 'Sin cambios pendientes'}
            </Typography>
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ justifyContent: 'flex-end', '& .MuiButton-root': { whiteSpace: 'nowrap', px: { xs: 1.5, sm: 2 } } }}
            >
              <Button disabled={!sucio || guardando} onClick={() => setConfirmandoDescarte(true)}>Descartar cambios</Button>
              <Button variant="contained" disabled={!sucio || guardando} onClick={() => setConfirmandoGuardado(true)}>Guardar</Button>
            </Stack>
          </Paper>
        )}
      </Box>

      <DialogoConfirmacion
        abierto={confirmandoGuardado}
        titulo="¿Guardar los cambios?"
        mensaje={nombre}
        textoConfirmar="Guardar cambios"
        onConfirmar={() => { setConfirmandoGuardado(false); void onGuardar() }}
        onCancelar={() => setConfirmandoGuardado(false)}
      />

      <DialogoConfirmacion
        abierto={confirmandoDescarte}
        titulo="¿Descartar los cambios?"
        mensaje="Todo lo que has cambiado desde la última vez que guardaste vuelve a como estaba. No se puede deshacer."
        textoConfirmar="Descartar cambios"
        textoCancelar="Seguir editando"
        peligro
        onConfirmar={() => { setConfirmandoDescarte(false); onDescartar?.() }}
        onCancelar={() => setConfirmandoDescarte(false)}
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
