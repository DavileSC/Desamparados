import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Box, Typography, TextField, FormControlLabel, Checkbox, Alert, Grid } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import AnimatedSection from '../../../components/AnimatedSection'
import AppButton from '../../../components/AppButton'
import CampoContrasena from '../../../components/CampoContrasena'
import { membershipSchema, type MembershipFormData } from './schema'
import { register as apiRegister } from '../../../lib/api/auth'
import { ApiError } from '../../../lib/api/client'

export default function HazteHermanoPage() {
  const [success, setSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<MembershipFormData>({
    resolver: zodResolver(membershipSchema),
    defaultValues: {
      nombre: '',
      apellidos: '',
      email: '',
      password: '',
      dni: '',
      telefono: '',
      direccion: '',
      ciudad: '',
      codigoPostal: '',
      fechaNacimiento: '',
      aceptarPolitica: false,
    },
  })

  /** Del `usuario.dni` que manda el servidor al `dni` que conoce el formulario. */
  const CAMPOS_API: Record<string, keyof MembershipFormData> = {
    'usuario.dni': 'dni',
    'usuario.email': 'email',
    'usuario.telefono': 'telefono',
    'usuario.nombre': 'nombre',
    'usuario.apellidos': 'apellidos',
    'usuario.direccion': 'direccion',
    'usuario.poblacion': 'ciudad',
    'usuario.codigoPostal': 'codigoPostal',
    'usuario.password': 'password',
    'hermano.fechaNacimiento': 'fechaNacimiento',
  }

  const onSubmit = async (data: MembershipFormData) => {
    setSubmitError(null)
    try {
      await apiRegister({
        ...data,
        poblacion: data.ciudad,
      })
      setSuccess(true)
      reset()
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
        // El servidor dice qué campo falla; enseñarlo bajo su casilla en vez
        // de un «Error de validación» suelto que no dice qué corregir.
        let colocado = false
        for (const [campoApi, mensaje] of Object.entries(error.fields)) {
          const campo = CAMPOS_API[campoApi]
          if (campo) { setError(campo, { type: 'server', message: mensaje }); colocado = true }
        }
        if (colocado) return
      }
      setSubmitError(error instanceof ApiError ? error.message : 'No se ha podido enviar la solicitud.')
    }
  }

  return (
    <>
      <Helmet>
        <title>Hazte Hermano | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Hazte Hermano"
        subtitle="Únete al Grupo Parroquial de los Desamparados."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Box sx={{ maxWidth: '800px', mx: 'auto' }}>
            {success && (
              <Alert severity="success" sx={{ mb: 4 }}>
                Solicitud enviada correctamente. Nos pondremos en contacto contigo pronto.
              </Alert>
            )}
            {submitError && <Alert severity="error" sx={{ mb: 4 }}>{submitError}</Alert>}

            <Box
              component="form"
              onSubmit={handleSubmit(onSubmit)}
              sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
            >
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Nombre"
                    fullWidth
                    error={!!errors.nombre}
                    helperText={errors.nombre?.message}
                    {...register('nombre')}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="DNI/NIE"
                    fullWidth
                    error={!!errors.dni}
                    helperText={errors.dni?.message}
                    {...register('dni')}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <CampoContrasena
                    label="Contraseña"
                    fullWidth
                    error={!!errors.password}
                    helperText={errors.password?.message}
                    {...register('password')}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Apellidos"
                    fullWidth
                    error={!!errors.apellidos}
                    helperText={errors.apellidos?.message}
                    {...register('apellidos')}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Fecha de nacimiento"
                    type="date"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                    error={!!errors.fechaNacimiento}
                    helperText={errors.fechaNacimiento?.message}
                    {...register('fechaNacimiento')}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Email"
                    type="email"
                    fullWidth
                    error={!!errors.email}
                    helperText={errors.email?.message}
                    {...register('email')}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Teléfono"
                    fullWidth
                    error={!!errors.telefono}
                    helperText={errors.telefono?.message}
                    {...register('telefono')}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Dirección"
                    fullWidth
                    error={!!errors.direccion}
                    helperText={errors.direccion?.message}
                    {...register('direccion')}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Ciudad"
                    fullWidth
                    error={!!errors.ciudad}
                    helperText={errors.ciudad?.message}
                    {...register('ciudad')}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Código postal"
                    fullWidth
                    error={!!errors.codigoPostal}
                    helperText={errors.codigoPostal?.message}
                    {...register('codigoPostal')}
                  />
                </Grid>
              </Grid>

              <FormControlLabel
                control={<Checkbox {...register('aceptarPolitica')} />}
                label="Acepto la política de privacidad"
                sx={{ color: errors.aceptarPolitica ? 'error.main' : 'text.secondary' }}
              />
              {errors.aceptarPolitica && (
                <Typography variant="caption" color="error">
                  {errors.aceptarPolitica.message}
                </Typography>
              )}

              <AppButton type="submit" disabled={isSubmitting} sx={{ mt: 2 }}>
                Enviar solicitud
              </AppButton>
            </Box>
          </Box>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
