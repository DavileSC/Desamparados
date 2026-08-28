import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Box, Typography, TextField, Alert, Button } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import GlassCard from '../../../components/GlassCard'
import AppButton from '../../../components/AppButton'
import { loginSchema, twoFactorSchema, type LoginFormData, type TwoFactorFormData } from './schema'
import { useAuthStore } from './store'
import { login as apiLogin, verify2FA, type LoginResponse } from '../../../lib/api/auth'
import { ApiError } from '../../../lib/api/client'

function errorMessage(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const entrarSesion = useAuthStore((state) => state.entrarSesion)

  // Segundo paso del login cuando la cuenta tiene 2FA activado. Al usuario lo
  // identifica una cookie de vida corta que emitio el servidor, no este estado.
  const [pending2FA, setPending2FA] = useState<{ message: string } | null>(null)

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/area-hermano'

  const credentialsForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const twoFactorForm = useForm<TwoFactorFormData>({
    resolver: zodResolver(twoFactorSchema),
    defaultValues: { code: '' },
  })

  const handleResponse = (response: LoginResponse) => {
    if (response.status === '2FA_NEEDED') {
      setPending2FA({ message: response.message })
      return
    }
    entrarSesion(response.user)
    navigate(from, { replace: true })
  }

  const onSubmitCredentials = async (data: LoginFormData) => {
    try {
      handleResponse(await apiLogin(data.email, data.password))
    } catch (e) {
      credentialsForm.setError('root', { message: errorMessage(e, 'Email o contraseña incorrectos') })
    }
  }

  const onSubmit2FA = async (data: TwoFactorFormData) => {
    if (!pending2FA) return
    try {
      handleResponse(await verify2FA(data.code))
    } catch (e) {
      twoFactorForm.setError('root', { message: errorMessage(e, 'Código incorrecto o expirado') })
    }
  }

  return (
    <>
      <Helmet>
        <title>Acceso de Hermanos | Desamparados</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <GlassCard sx={{ width: '100%', p: { xs: 3, md: 5 }, maxWidth: 440, mx: 'auto' }}>
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
              <AppButton type="submit" fullWidth disabled={twoFactorForm.formState.isSubmitting}>
                Verificar
              </AppButton>
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

              <TextField
                label="Contraseña"
                type="password"
                autoComplete="current-password"
                fullWidth
                error={!!credentialsForm.formState.errors.password}
                helperText={credentialsForm.formState.errors.password?.message}
                {...credentialsForm.register('password')}
              />

              <AppButton type="submit" fullWidth disabled={credentialsForm.formState.isSubmitting}>
                Entrar
              </AppButton>
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
          <Box component="a" href="/hermanos/hazte-hermano" sx={{ color: 'secondary.main', textDecoration: 'underline' }}>
            Solicita tu alta
          </Box>
        </Typography>
      </GlassCard>
    </>
  )
}
