import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Box, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import TarjetaCristal from '../../../components/TarjetaCristal'
import Boton from '../../../components/Boton'
import CampoContrasena from '../../../components/CampoContrasena'
import { requestPasswordReset as apiRequestPasswordReset, resetPassword as apiResetPassword } from '../../../lib/api/auth'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { requestPasswordResetSchema, resetPasswordSchema, type RequestPasswordResetFormData, type ResetPasswordFormData } from './schema'
import { site } from '../../../config/site'

export default function NuevaContrasenaPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''
  // Quien viene del CMS vuelve a la entrada del CMS: la de hermanos no es la
  // suya y, en una instalación sin área de hermanos, ni siquiera deja entrar.
  const area = searchParams.get('area') === 'cms' ? 'cms' : 'hermanos'
  const acceso = area === 'cms' ? '/cms/acceso' : '/acceso'
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
      window.setTimeout(() => navigate(acceso, { replace: true }), 1800)
    } catch (error) {
      setSubmitError(error instanceof ErrorDeApi ? error.message : 'No se ha podido actualizar la contraseña.')
    }
  }

  const onRequestSubmit = async (data: RequestPasswordResetFormData) => {
    setSubmitError(null)
    try {
      await apiRequestPasswordReset(data.email, area)
      setRequestSent(true)
    } catch (error) {
      setSubmitError(error instanceof ErrorDeApi ? error.message : 'No se ha podido solicitar la recuperación.')
    }
  }

  return (
    <>
      <Helmet><title>{`${token ? 'Nueva contraseña' : 'Recuperar contraseña'} | ${site.nombreCorto}`}</title></Helmet>
      <TarjetaCristal sx={{ width: '100%', p: { xs: 3, md: 5 }, maxWidth: 440, mx: 'auto' }}>
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
            <Boton type="submit" fullWidth disabled={requestForm.formState.isSubmitting}>Enviar enlace</Boton>
          </Box>
        ) : (
          <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Introduce una nueva contraseña para tu cuenta.
            </Typography>
            {submitError && <Alert severity="error">{submitError}</Alert>}
            <CampoContrasena label="Nueva contraseña" autoComplete="new-password" fullWidth error={!!errors.password} helperText={errors.password?.message} {...register('password')} />
            <CampoContrasena label="Confirmar contraseña" autoComplete="new-password" fullWidth error={!!errors.confirmation} helperText={errors.confirmation?.message} {...register('confirmation')} />
            <Boton type="submit" fullWidth disabled={isSubmitting}>Actualizar contraseña</Boton>
          </Box>
        )}
        <Typography component={Link} to={acceso} sx={{ display: 'block', mt: 3, textAlign: 'center', color: 'secondary.main' }}>
          Volver al acceso
        </Typography>
      </TarjetaCristal>
    </>
  )
}
