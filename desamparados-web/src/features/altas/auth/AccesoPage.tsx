import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Box, Typography, TextField, Alert, Button, Checkbox, FormControlLabel } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import TarjetaCristal from '../../../components/TarjetaCristal'
import Boton from '../../../components/Boton'
import CampoContrasena from '../../../components/CampoContrasena'
import { loginSchema, twoFactorSchema, type LoginFormInput, type LoginFormData, type TwoFactorFormData } from './schema'
import { useAuthStore } from './store'
import { login as apiLogin, verify2FA, type LoginResponse } from '../../../lib/api/auth'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { enlaceEsmalte } from '../../../components/esmalte'

function errorMessage(e: unknown, fallback: string) {
  return e instanceof ErrorDeApi ? e.message : fallback
}

export default function AccesoPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const hermano = useAuthStore((state) => state.hermano)
  const entrarSesion = useAuthStore((state) => state.entrarSesion)

  // Segundo paso del login cuando la cuenta tiene 2FA activado. Al usuario lo
  // identifica una cookie de vida corta que emitio el servidor, no este estado.
  const [pending2FA, setPending2FA] = useState<{ message: string } | null>(null)

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/area-hermano'

  const credentialsForm = useForm<LoginFormInput, unknown, LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', recordarme: false },
  })

  const twoFactorForm = useForm<TwoFactorFormData>({
    resolver: zodResolver(twoFactorSchema),
    defaultValues: { code: '' },
  })

  const alResponder = (response: LoginResponse) => {
    if (response.status === '2FA_NEEDED') {
      setPending2FA({ message: response.message })
      return
    }
    // Sin rebote: un cargo que entra por aquí crea sesión de hermano válida y
    // va al área de hermanos igual que cualquiera. Si además quiere el CMS,
    // entra por /cms/acceso, que es el acceso con segundo factor y su propia
    // cookie; por eso las dos sesiones son independientes.
    entrarSesion('hermanos', response.user)
    navigate(from, { replace: true })
  }

  const onSubmitCredentials = async (data: LoginFormData) => {
    try {
      alResponder(await apiLogin(data.email, data.password, data.recordarme, 'hermanos'))
    } catch (e) {
      credentialsForm.setError('root', { message: errorMessage(e, 'Email o contraseña incorrectos') })
    }
  }

  const onSubmit2FA = async (data: TwoFactorFormData) => {
    if (!pending2FA) return
    try {
      alResponder(await verify2FA(data.code))
    } catch (e) {
      twoFactorForm.setError('root', { message: errorMessage(e, 'Código incorrecto o expirado') })
    }
  }

  // Quien ya tiene sesión del área de hermanos no ve este formulario: directo al área.
  if (hermano) {
    return <Navigate to="/area-hermano" replace />
  }

  return (
    <>
      <Helmet>
        <title>Acceso de Hermanos | Desamparados</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <TarjetaCristal sx={{ width: '100%', p: { xs: 3, md: 5 }, maxWidth: 440, mx: 'auto' }}>
        <Typography
          variant="h3"
          component="h1"
          sx={{ mb: 1, textAlign: 'center', fontSize: { xs: '28px', md: '36px' } }}
        >
          Acceso de Hermanos
        </Typography>

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
              <Boton type="submit" fullWidth disabled={twoFactorForm.formState.isSubmitting}>
                Verificar
              </Boton>
              <Button
                type="button"
                onClick={() => setPending2FA(null)}
                sx={{ ...enlaceEsmalte, color: 'text.secondary', alignSelf: 'center' }}
              >
                Volver
              </Button>
            </Box>
          </>
        ) : (
          <>
            <Typography variant="body2" sx={{ mb: 4, textAlign: 'center', color: 'text.secondary' }}>
              Introduce tus credenciales para acceder a tu área privada.
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

              <Boton type="submit" fullWidth disabled={credentialsForm.formState.isSubmitting}>
                Entrar
              </Boton>
              <Box component={Link} to="/reset-password" sx={{ color: 'secondary.main', textAlign: 'center', fontSize: '13px' }}>
                ¿Has olvidado tu contraseña?
              </Box>
            </Box>
          </>
        )}

        <Typography
          variant="body2"
          sx={{ mt: 3, textAlign: 'center', color: 'text.secondary', fontSize: '13px' }}
        >
          ¿Aún no eres hermano?{' '}
          <Box component="a" href="/hazte-hermano" sx={{ color: 'secondary.main', textDecoration: 'underline' }}>
            Solicita tu alta
          </Box>
        </Typography>
      </TarjetaCristal>
    </>
  )
}
