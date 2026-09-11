import { useState } from 'react'
import { Alert, Box, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useAuthStore } from '../members/auth/store'
import { sesionActual, activar2FA, desactivar2FA, generarQr2FA } from '../../lib/api/auth'
import { ApiError } from '../../lib/api/client'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'

function errorMessage(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback
}

/**
 * Gestión del doble factor de la propia cuenta. Solo se ofrece al staff (la
 * ruta y los endpoints del backend lo limitan a roles del CMS).
 *
 * El flujo de activación es el estándar: QR → código → respaldos en claro una
 * sola vez. El de desactivación pide un TOTP o un respaldo para evitar que
 * quien se apodere de una sesión abierta deje la cuenta con un solo factor.
 */
export default function MiSeguridadPage() {
  const user = useAuthStore((state) => state.user)
  const entrarSesion = useAuthStore((state) => state.entrarSesion)

  const [qr, setQr] = useState<{ qrCodeUrl: string; secret: string } | null>(null)
  const [respaldos, setRespaldos] = useState<string[] | null>(null)
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmarBaja, setConfirmarBaja] = useState(false)

  const activo = !!user?.twoFactorEnabled

  /** Refresca el estado de la cuenta (el 2FA cambia y el store debe enterarse). */
  const refrescarSesion = async () => {
    const { user: actualizado } = await sesionActual()
    entrarSesion(actualizado)
  }

  const pedirQr = async () => {
    setOcupado(true)
    setError(null)
    setAviso(null)
    try {
      setQr(await generarQr2FA())
    } catch (e) {
      setError(errorMessage(e, 'No se ha podido generar el QR. Inténtalo de nuevo.'))
      // 409: el servidor dice que ya está activo (activado desde otra pestaña,
      // por ejemplo). Se refresca la cuenta para que la pantalla lo refleje.
      if (e instanceof ApiError && e.status === 409) await refrescarSesion().catch(() => undefined)
    } finally {
      setOcupado(false)
    }
  }

  const activar = async () => {
    setOcupado(true)
    setError(null)
    try {
      const { backupCodes } = await activar2FA(codigo.trim())
      setRespaldos(backupCodes)
      setQr(null)
      setCodigo('')
      await refrescarSesion()
    } catch (e) {
      setError(errorMessage(e, 'Código incorrecto. Comprueba que tu app muestra estos 6 dígitos.'))
    } finally {
      setOcupado(false)
    }
  }

  const desactivar = async () => {
    setOcupado(true)
    setError(null)
    setConfirmarBaja(false)
    try {
      await desactivar2FA(codigo.trim())
      setAviso('El doble factor está desactivado. Tu cuenta vuelve a entrar solo con contraseña.')
      setCodigo('')
      await refrescarSesion()
    } catch (e) {
      setError(errorMessage(e, 'Código incorrecto.'))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Mi seguridad | CMS Desamparados</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <Typography variant="h3" component="h1" sx={{ mb: 0.5 }}>Mi seguridad</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Doble factor de autenticación de tu cuenta ({user?.email}).
      </Typography>

      <Paper sx={{ p: { xs: 2, md: 3 }, maxWidth: 640 }}>
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h5" component="h2">Doble factor (2FA)</Typography>
            <Chip
              label={activo ? 'Activado' : 'Desactivado'}
              color={activo ? 'success' : 'default'}
              size="small"
              variant="outlined"
            />
          </Box>

          {error && <Alert severity="error" role="alert">{error}</Alert>}
          {aviso && <Alert severity="success" role="alert">{aviso}</Alert>}

          {respaldos ? (
            <Stack spacing={2}>
              <Alert severity="warning">
                Guarda ahora estos códigos de respaldo (papel o gestor de contraseñas). Solo se
                muestran esta vez: si pierdes el móvil, son la única forma de entrar.
              </Alert>
              <Box
                component="ul"
                sx={{
                  columns: { xs: 1, sm: 2 },
                  columnGap: 4,
                  m: 0,
                  p: 0,
                  pl: 3,
                  fontFamily: 'monospace',
                }}
              >
                {respaldos.map((code) => (
                  <Box component="li" key={code} sx={{ mb: 0.5 }}>{code}</Box>
                ))}
              </Box>
              <Button variant="contained" sx={{ alignSelf: 'flex-start' }} onClick={() => setRespaldos(null)}>
                Los he guardado
              </Button>
            </Stack>
          ) : activo ? (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Para desactivarlo introduce un código vigente de tu app de autenticación o un
                código de respaldo.
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
                color="error"
                disabled={ocupado || codigo.trim().length < 6}
                onClick={() => setConfirmarBaja(true)}
                sx={{ alignSelf: 'flex-start' }}
              >
                Desactivar 2FA
              </Button>
            </Stack>
          ) : qr ? (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Escanea el QR con tu app de autenticación (Google Authenticator, Aegis, 1Password…)
                e introduce el código de 6 dígitos que muestre.
              </Typography>
              <Box
                component="img"
                src={qr.qrCodeUrl}
                alt="QR para configurar el doble factor"
                sx={{ width: 220, height: 220, border: `1px solid rgba(0,0,0,0.12)`, borderRadius: 1 }}
              />
              <Typography variant="body2" color="text.secondary">
                ¿Sin cámara? Introduce esta clave a mano:{' '}
                <Box component="span" sx={{ fontFamily: 'monospace' }}>{qr.secret}</Box>
              </Typography>
              <TextField
                label="Código de 6 dígitos"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                sx={{ maxWidth: 320 }}
                error={!!error && !ocupado}
              />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="contained"
                  disabled={ocupado || !/^[0-9]{6}$/.test(codigo.trim())}
                  onClick={() => { void activar() }}
                >
                  Activar
                </Button>
                <Button onClick={() => { setQr(null); setCodigo(''); setError(null) }}>Cancelar</Button>
              </Box>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Con el doble factor, entrar exige tu contraseña y un código que genera tu móvil.
                Si lo pierdes, podrás usar los códigos de respaldo que se generan al activarlo.
              </Typography>
              <Button
                variant="contained"
                disabled={ocupado}
                onClick={() => { void pedirQr() }}
                sx={{ alignSelf: 'flex-start' }}
              >
                Activar 2FA
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      <DialogoConfirmacion
        abierto={confirmarBaja}
        titulo="¿Desactivar el doble factor?"
        mensaje="Tu cuenta quedará protegida solo con la contraseña. Podrás volver a activarlo generando un QR nuevo."
        textoConfirmar="Desactivar"
        peligro
        onConfirmar={() => { void desactivar() }}
        onCancelar={() => setConfirmarBaja(false)}
      />
    </>
  )
}
