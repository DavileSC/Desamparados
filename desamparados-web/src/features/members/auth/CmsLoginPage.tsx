import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import {
  Alert, Box, Button, Checkbox, FormControlLabel, Paper, TextField, ThemeProvider, Typography,
} from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { cmsTheme } from '../../../theme/cms'
import { loginSchema, twoFactorSchema, type LoginFormData, type TwoFactorFormData } from './schema'
import { useAuthStore, isStaffRole } from './store'
import { login as apiLogin, verify2FA, cerrarSesionApi, type LoginResponse } from '../../../lib/api/auth'
import { ApiError } from '../../../lib/api/client'

function errorMessage(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback
}

/**
 * Acceso propio del CMS. Misma cuentas que el área de hermanos, pero aquí solo
 * entra el equipo: una cuenta USER con credenciales válidas no consigue sesión,
 * se le cierra y se le indica el acceso que le corresponde.
 */
export default function CmsLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const entrarSesion = useAuthStore((state) => state.entrarSesion)
  const salirSesion = useAuthStore((state) => state.salirSesion)

  const [pending2FA, setPending2FA] = useState<{ message: string } | null>(null)
  const [rechazado, setRechazado] = useState(false)

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/cms'

  const credentialsForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', recordarme: false },
  })

  const twoFactorForm = useForm<TwoFactorFormData>({
    resolver: zodResolver(twoFactorSchema),
    defaultValues: { code: '' },
  })

  const handleResponse = async (response: LoginResponse) => {
    if (response.status === '2FA_NEEDED') {
      setPending2FA({ message: response.message })
      return
    }

    // Cuenta válida pero sin rol del CMS: la sesión que acaba de crear se
    // cierra en el acto. Este acceso no reparte sesiones del área de hermanos.
    if (!isStaffRole(response.user.role)) {
      await cerrarSesionApi().catch(() => undefined)
      salirSesion()
      setRechazado(true)
      return
    }

    entrarSesion(response.user)
    navigate(from, { replace: true })
  }

  const onSubmitCredentials = async (data: LoginFormData) => {
    try {
      await handleResponse(await apiLogin(data.email, data.password, data.recordarme, 'cms'))
    } catch (e) {
      credentialsForm.setError('root', { message: errorMessage(e, 'Email o contraseña incorrectos') })
    }
  }

  const onSubmit2FA = async (data: TwoFactorFormData) => {
    try {
      await handleResponse(await verify2FA(data.code))
    } catch (e) {
      twoFactorForm.setError('root', { message: errorMessage(e, 'Código incorrecto o expirado') })
    }
  }

  // Quien ya tiene sesión de staff no ve este formulario: directo al panel.
  if (status === 'autenticado' && isStaffRole(user?.role)) {
    return <Navigate to="/cms" replace />
  }

  return (
    <ThemeProvider theme={cmsTheme}>
      <Helmet>
        <title>Acceso a la administración | CMS Desamparados</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.default',
          color: 'text.primary',
          p: 2,
        }}
      >
        <Paper sx={{ p: { xs: 3, md: 5 }, maxWidth: 440, width: '100%' }}>
          <Typography
            variant="h3"
            component="h1"
            sx={{ mb: 1, textAlign: 'center', fontSize: { xs: '26px', md: '32px' } }}
          >
            Acceso a la administración
          </Typography>

          {rechazado && (
            <Alert severity="error" role="alert" sx={{ mb: 2 }}>
              Esta cuenta no pertenece al equipo del CMS. Si eres hermano, entra por el{' '}
              <Link to="/hermanos/acceso">acceso del área de hermanos</Link>.
            </Alert>
          )}

          {status === 'autenticado' && !isStaffRole(user?.role) ? (
            <Alert severity="info" role="alert">
              Tu sesión actual no tiene acceso a la administración.{' '}
              <Link to="/area-hermano">Vuelve al área de hermanos</Link>.
            </Alert>
          ) : pending2FA ? (
            <>
              <Typography variant="body2" sx={{ mb: 4, textAlign: 'center', color: 'text.secondary' }}>
                {pending2FA.message}
              </Typography>
              <Box
                component="form"
                onSubmit={twoFactorForm.handleSubmit(onSubmit2FA)}
                sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
              >
                {twoFactorForm.formState.errors.root && (
                  <Alert severity="error" role="alert">{twoFactorForm.formState.errors.root.message}</Alert>
                )}
                <TextField
                  label="Código de verificación"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  autoFocus
                  fullWidth
                  error={!!twoFactorForm.formState.errors.code}
                  helperText={twoFactorForm.formState.errors.code?.message ?? 'Código de tu app de autenticación o un código de respaldo.'}
                  {...twoFactorForm.register('code')}
                />
                <Button type="submit" variant="contained" fullWidth disabled={twoFactorForm.formState.isSubmitting}>
                  Verificar
                </Button>
                <Button
                  type="button"
                  onClick={() => setPending2FA(null)}
                  sx={{ color: 'text.secondary', alignSelf: 'center' }}
                >
                  Volver
                </Button>
              </Box>
            </>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 4, textAlign: 'center', color: 'text.secondary' }}>
                Área reservada al equipo del Grupo Parroquial.
              </Typography>
              <Box
                component="form"
                onSubmit={credentialsForm.handleSubmit(onSubmitCredentials)}
                sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
              >
                {credentialsForm.formState.errors.root && (
                  <Alert severity="error" role="alert">{credentialsForm.formState.errors.root.message}</Alert>
                )}

                <TextField
                  label="Email"
                  type="email"
                  autoComplete="email"
                  fullWidth
                  error={!!credentialsForm.formState.errors.email}
                  helperText={credentialsForm.formState.errors.email?.message}
                  {...credentialsForm.register('email')}
                />

                <TextField
                  label="Contraseña"
                  type="password"
                  autoComplete="current-password"
                  fullWidth
                  error={!!credentialsForm.formState.errors.password}
                  helperText={credentialsForm.formState.errors.password?.message}
                  {...credentialsForm.register('password')}
                />

                <FormControlLabel
                  control={<Checkbox {...credentialsForm.register('recordarme')} />}
                  label="Recordarme: mantener la sesión iniciada 72 horas"
                />

                <Button type="submit" variant="contained" fullWidth disabled={credentialsForm.formState.isSubmitting}>
                  Entrar
                </Button>
                <Box component={Link} to="/reset-password" sx={{ color: 'secondary.main', textAlign: 'center', fontSize: '13px' }}>
                  ¿Has olvidado tu contraseña?
                </Box>
              </Box>
            </>
          )}
        </Paper>
      </Box>
    </ThemeProvider>
  )
}
