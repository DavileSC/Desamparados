import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Box, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import GlassCard from '../../../components/GlassCard'
import AppButton from '../../../components/AppButton'
import { requestPasswordReset as apiRequestPasswordReset, resetPassword as apiResetPassword } from '../../../lib/api/auth'
import { ApiError } from '../../../lib/api/client'
import { requestPasswordResetSchema, resetPasswordSchema, type RequestPasswordResetFormData, type ResetPasswordFormData } from './schema'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''
  const [success, setSuccess] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmation: '' },
  })
  const requestForm = useForm<RequestPasswordResetFormData>({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = async (data: ResetPasswordFormData) => {
    setSubmitError(null)
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      setSubmitError('El enlace de recuperación no es válido o ha caducado.')
      return
    }
    try {
      await apiResetPassword(token, data.password)
      setSuccess(true)
      window.setTimeout(() => navigate('/hermanos/acceso', { replace: true }), 1800)
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : 'No se ha podido actualizar la contraseña.')
    }
  }

  const onRequestSubmit = async (data: RequestPasswordResetFormData) => {
    setSubmitError(null)
    try {
      await apiRequestPasswordReset(data.email)
      setRequestSent(true)
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : 'No se ha podido solicitar la recuperación.')
    }
  }

  return (
    <>
      <Helmet><title>{token ? 'Nueva contraseña' : 'Recuperar contraseña'} | Desamparados</title></Helmet>
      <GlassCard sx={{ width: '100%', p: { xs: 3, md: 5 }, maxWidth: 440, mx: 'auto' }}>
        <Typography variant="h3" component="h1" sx={{ mb: 1, textAlign: 'center', fontSize: { xs: '28px', md: '36px' } }}>
          {token ? 'Nueva contraseña' : 'Recuperar contraseña'}
        </Typography>
        {!token && requestSent ? (
          <Alert severity="success">Si el correo está registrado, recibirás un enlace de recuperación.</Alert>
        ) : success ? (
          <Alert severity="success">Contraseña actualizada. Redirigiendo al acceso...</Alert>
        ) : !token ? (
          <Box component="form" onSubmit={requestForm.handleSubmit(onRequestSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Introduce tu email y te enviaremos un enlace para cambiar la contraseña.</Typography>
            {submitError && <Alert severity="error">{submitError}</Alert>}
            <TextField label="Email" type="email" autoComplete="email" fullWidth error={!!requestForm.formState.errors.email} helperText={requestForm.formState.errors.email?.message} {...requestForm.register('email')} />
            <AppButton type="submit" fullWidth disabled={requestForm.formState.isSubmitting}>Enviar enlace</AppButton>
          </Box>
        ) : (
          <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Introduce una nueva contraseña para tu cuenta.
            </Typography>
            {submitError && <Alert severity="error">{submitError}</Alert>}
            <TextField label="Nueva contraseña" type="password" autoComplete="new-password" fullWidth error={!!errors.password} helperText={errors.password?.message} {...register('password')} />
            <TextField label="Confirmar contraseña" type="password" autoComplete="new-password" fullWidth error={!!errors.confirmation} helperText={errors.confirmation?.message} {...register('confirmation')} />
            <AppButton type="submit" fullWidth disabled={isSubmitting}>Actualizar contraseña</AppButton>
          </Box>
        )}
        <Typography component={Link} to="/hermanos/acceso" sx={{ display: 'block', mt: 3, textAlign: 'center', color: 'secondary.main' }}>
          Volver al acceso
        </Typography>
      </GlassCard>
    </>
  )
}
