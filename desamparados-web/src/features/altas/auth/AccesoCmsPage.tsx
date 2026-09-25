import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import {
  Alert, Box, Button, Checkbox, FormControlLabel, GlobalStyles, Paper, TextField, ThemeProvider, Typography,
} from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { ESTILOS_GLOBALES_CMS, crearTemaCms } from '../../../theme/cms'
import CampoContrasena from '../../../components/CampoContrasena'
import { loginSchema, twoFactorSchema, type LoginFormInput, type LoginFormData, type TwoFactorFormData } from './schema'
import { useAuthStore, isStaffRole } from './store'
import { login as apiLogin, verify2FA, cerrarSesionApi, type LoginResponse } from '../../../lib/api/auth'
import { ErrorDeApi } from '../../../lib/api/cliente'

function errorMessage(e: unknown, fallback: string) {
  return e instanceof ErrorDeApi ? e.message : fallback
}

/** Código de error que acompaña al mensaje en las respuestas del login. */
function codigoError(e: unknown): string | undefined {
  if (!(e instanceof ErrorDeApi) || !e.payload || typeof e.payload !== 'object') return undefined
  const { error } = e.payload as { error?: unknown }
  return typeof error === 'string' ? error : undefined
}

// Modo fijo en esta pantalla: se calcula una sola vez al cargar el módulo, no
// en cada render. `crearTemaCms` construye el tema entero con `createTheme`;
// repetirlo en cada re-render (el 2FA y react-hook-form provocan varios) es
// trabajo de más y, sobre todo, rompe la identidad del objeto del tema, así
// que Emotion reinyecta estilos y se invalida cualquier hijo que dependa de esa identidad.
const TEMA_ACCESO = crearTemaCms('claro')

/**
 * Acceso propio del CMS. Misma cuentas que el área de hermanos, pero aquí solo
 * entra el equipo: una cuenta USER con credenciales válidas no consigue sesión,
 * se le cierra y se le indica el acceso que le corresponde.
 */
export default function AccesoCmsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const cms = useAuthStore((state) => state.cms)
  const entrarSesion = useAuthStore((state) => state.entrarSesion)
  const salirSesion = useAuthStore((state) => state.salirSesion)

  const [pending2FA, setPending2FA] = useState<{ message: string } | null>(null)
  const [rechazado, setRechazado] = useState(false)

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/cms'

  const credentialsForm = useForm<LoginFormInput, unknown, LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', recordarme: false },
  })

  const twoFactorForm = useForm<TwoFactorFormData>({
    resolver: zodResolver(twoFactorSchema),
    defaultValues: { code: '' },
  })

  const alResponder = async (response: LoginResponse) => {
    if (response.status === '2FA_NEEDED') {
      setPending2FA({ message: response.message })
      return
    }

    // Red de seguridad: el backend ya no da sesión del CMS a una cuenta sin
    // rol del equipo (responde 403 CUENTA_SIN_CMS). Si aun así llegara una,
    // se cierra en el acto: este acceso no reparte sesiones del área de hermanos.
    if (!isStaffRole(response.user.role)) {
      await cerrarSesionApi('cms').catch(() => undefined)
      salirSesion('cms')
      setRechazado(true)
      return
    }

    entrarSesion('cms', response.user)
    navigate(from, { replace: true })
  }

  const onSubmitCredentials = async (data: LoginFormData) => {
    setRechazado(false)
    try {
      await alResponder(await apiLogin(data.email, data.password, data.recordarme, 'cms'))
    } catch (e) {
      // Cuenta de hermano con la contraseña correcta: el servidor no crea la
      // sesión y se le indica su acceso, con enlace, en vez del error genérico.
      if (codigoError(e) === 'CUENTA_SIN_CMS') {
        setRechazado(true)
        return
      }
      credentialsForm.setError('root', { message: errorMessage(e, 'Email o contraseña incorrectos') })
    }
  }

  const onSubmit2FA = async (data: TwoFactorFormData) => {
    try {
      await alResponder(await verify2FA(data.code))
    } catch (e) {
      // El paso de la contraseña caducó (5 min) o su testigo ya se usó: de
      // nada sirve seguir probando códigos, hay que volver al primer paso.
      if (codigoError(e) === 'PENDING_2FA_REQUIRED') {
        setPending2FA(null)
        twoFactorForm.reset()
        credentialsForm.setError('root', { message: errorMessage(e, 'La verificación ha caducado. Vuelve a introducir tu email y contraseña.') })
        return
      }
      twoFactorForm.setError('root', { message: errorMessage(e, 'Código incorrecto o expirado') })
    }
  }

  // Quien ya tiene sesión del CMS no ve este formulario: directo al panel. Una
  // sesión del área de hermanos no cuenta aquí: es una cookie distinta, y esta
  // pantalla ni la mira. Esa persona tiene que identificarse aquí, donde se le
  // pide el segundo factor.
  if (cms) {
    return <Navigate to="/cms" replace />
  }

  return (
    <ThemeProvider theme={TEMA_ACCESO}>
      <GlobalStyles styles={ESTILOS_GLOBALES_CMS} />
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
              <Link to="/acceso">acceso del área de hermanos</Link>.
            </Alert>
          )}

          {pending2FA ? (
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

                <CampoContrasena
                  label="Contraseña"
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
