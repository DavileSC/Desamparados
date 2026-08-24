import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useLocation } from 'react-router-dom'
import { Box, Typography, TextField, FormControlLabel, Checkbox, Alert } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import GlassCard from '../../../components/GlassCard'
import AppButton from '../../../components/AppButton'
import { loginSchema, type LoginFormData } from './schema'
import { useAuthStore } from './store'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((state) => state.login)

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/area-hermano'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  })

  const onSubmit = async (data: LoginFormData) => {
    // TODO: Replace with real API call
    if (data.email === 'hermano@desamparados.es' && data.password === 'password') {
      login({ id: '1', name: 'Hermano Ejemplo', email: data.email })
      navigate(from, { replace: true })
    } else {
      setError('root', { message: 'Email o contraseña incorrectos' })
    }
  }

  return (
    <>
      <Helmet>
        <title>Acceso de Hermanos | Desamparados</title>
      </Helmet>
      <GlassCard sx={{ width: '100%', p: { xs: 3, md: 5 }, maxWidth: 440, mx: 'auto' }}>
        <Typography
          variant="h3"
          component="h1"
          sx={{ mb: 1, textAlign: 'center', fontSize: { xs: '28px', md: '36px' } }}
        >
          Acceso de Hermanos
        </Typography>
        <Typography
          variant="body2"
          sx={{ mb: 4, textAlign: 'center', color: 'text.secondary' }}
        >
          Introduce tus credenciales para acceder a tu área privada.
        </Typography>

        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {errors.root && <Alert severity="error">{errors.root.message}</Alert>}

          <TextField
            label="Email"
            type="email"
            fullWidth
            error={!!errors.email}
            helperText={errors.email?.message}
            {...register('email')}
          />

          <TextField
            label="Contraseña"
            type="password"
            fullWidth
            error={!!errors.password}
            helperText={errors.password?.message}
            {...register('password')}
          />

          <FormControlLabel
            control={<Checkbox {...register('rememberMe')} />}
            label="Recordarme"
            sx={{ color: 'text.secondary' }}
          />

          <AppButton type="submit" fullWidth disabled={isSubmitting}>
            Entrar
          </AppButton>
        </Box>

        <Typography
          variant="body2"
          sx={{ mt: 3, textAlign: 'center', color: 'text.secondary', fontSize: '13px' }}
        >
          Credenciales de prueba: hermano@desamparados.es / password
        </Typography>
      </GlassCard>
    </>
  )
}
