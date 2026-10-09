import { useState } from 'react'
import { Alert, Box, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useAuthStore } from '../altas/auth/store'
import { sesionActual, desactivar2FA } from '../../lib/api/auth'
import { ErrorDeApi } from '../../lib/api/cliente'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import CambiarContrasena from '../altas/auth/CambiarContrasena'
import { site } from '../../config/site'

function errorMessage(e: unknown, fallback: string) {
  return e instanceof ErrorDeApi ? e.message : fallback
}

/**
 * La contraseña y el doble factor de la propia cuenta. La contraseña es la
 * misma que la del área de hermanos (es una sola cuenta). La pantalla solo
 * se ofrece al staff (la ruta y los endpoints del 2FA la limitan a roles del CMS).
 *
 * El doble factor es obligatorio para el equipo: aquí siempre está activo,
 * porque sin él `ExigeRol` enseña la pantalla de activación en lugar del CMS.
 * Lo que se ofrece es cambiar de móvil: se apaga con un código vigente o de
 * respaldo (para que quien se apodere de una sesión abierta no lo quite sin
 * él) y, al apagarse, esa misma pantalla pide activarlo con el móvil nuevo.
 */
export default function MiSeguridadPage() {
  const cms = useAuthStore((state) => state.cms)
  const entrarSesion = useAuthStore((state) => state.entrarSesion)

  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmarCambio, setConfirmarCambio] = useState(false)

  const cambiarDeMovil = async () => {
    setOcupado(true)
    setError(null)
    setConfirmarCambio(false)
    try {
      await desactivar2FA(codigo.trim())
      // Con la sesión al día, ExigeRol pasa a la pantalla de activación.
      const { cms: actualizado } = await sesionActual()
      if (actualizado) entrarSesion('cms', actualizado)
    } catch (e) {
      setError(errorMessage(e, 'Código incorrecto.'))
      setOcupado(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>{`Mi seguridad | CMS ${site.nombreCorto}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <Typography variant="h3" component="h1" sx={{ mb: 0.5 }}>Mi seguridad</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Contraseña y doble factor de autenticación de tu cuenta ({cms?.email}).
      </Typography>

      <Paper sx={{ p: { xs: 2, md: 3 }, maxWidth: 640, mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ mb: 1 }}>Contraseña</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Es la misma con la que entras en el área de hermanos. Al cambiarla se cierran las sesiones abiertas en otros dispositivos.
        </Typography>
        <CambiarContrasena variante="cms" />
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 3 }, maxWidth: 640 }}>
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h5" component="h2">Doble factor (2FA)</Typography>
            <Chip
              label="Activado"
              color="success"
              size="small"
              variant="outlined"
            />
          </Box>

          {error && <Alert severity="error" role="alert">{error}</Alert>}

          <Typography variant="body2" color="text.secondary">
            Para entrar en la administración hace falta, además de la contraseña, el código de tu
            app de autenticación. ¿Has cambiado de móvil? Escribe un código vigente de la app (o uno
            de respaldo) y a continuación podrás activarlo en el nuevo.
          </Typography>
          <TextField
            label="Código de verificación"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            sx={{ maxWidth: 320 }}
          />
          <Button
            variant="outlined"
            disabled={ocupado || codigo.trim().length < 6}
            onClick={() => setConfirmarCambio(true)}
            sx={{ alignSelf: 'flex-start' }}
          >
            Cambiar de móvil
          </Button>
        </Stack>
      </Paper>

      <DialogoConfirmacion
        abierto={confirmarCambio}
        titulo="¿Cambiar de móvil?"
        mensaje="El código de tu móvil actual dejará de valer. Antes de seguir en el CMS tendrás que escanear un QR nuevo con el otro móvil."
        textoConfirmar="Cambiar de móvil"
        onConfirmar={() => { void cambiarDeMovil() }}
        onCancelar={() => setConfirmarCambio(false)}
      />
    </>
  )
}
