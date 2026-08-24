import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Box, Typography, TextField, Alert, Grid } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import PageContainer from '../../../components/PageContainer'
import AnimatedSection from '../../../components/AnimatedSection'
import AppButton from '../../../components/AppButton'
import { brotherProfile } from '../../../lib/mocks/brother'
import { profileSchema, type ProfileFormData } from './schema'

export default function EditProfilePage() {
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: brotherProfile.name,
      surname: brotherProfile.surname,
      email: brotherProfile.email,
      phone: brotherProfile.phone,
      address: brotherProfile.address,
      city: brotherProfile.city,
      postalCode: brotherProfile.postalCode,
    },
  })

  const onSubmit = async (data: ProfileFormData) => {
    // TODO: Replace with real API call
    console.log(data)
    setSuccess(true)
  }

  return (
    <>
      <Helmet>
        <title>Editar Perfil | Desamparados</title>
      </Helmet>

      <AnimatedSection component="section" sx={{ py: { xs: 4, md: 6 } }}>
        <PageContainer>
          <Typography variant="h2" component="h1" sx={{ mb: 4 }}>
            Editar Perfil
          </Typography>

          {success && (
            <Alert severity="success" sx={{ mb: 4 }}>
              Perfil actualizado correctamente.
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit(onSubmit)}
            sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: '800px' }}
          >
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Nombre"
                  fullWidth
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  {...register('name')}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Apellidos"
                  fullWidth
                  error={!!errors.surname}
                  helperText={errors.surname?.message}
                  {...register('surname')}
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
                  error={!!errors.phone}
                  helperText={errors.phone?.message}
                  {...register('phone')}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Dirección"
                  fullWidth
                  error={!!errors.address}
                  helperText={errors.address?.message}
                  {...register('address')}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Ciudad"
                  fullWidth
                  error={!!errors.city}
                  helperText={errors.city?.message}
                  {...register('city')}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Código postal"
                  fullWidth
                  error={!!errors.postalCode}
                  helperText={errors.postalCode?.message}
                  {...register('postalCode')}
                />
              </Grid>
            </Grid>

            <AppButton type="submit" disabled={isSubmitting} sx={{ alignSelf: 'flex-start' }}>
              Guardar cambios
            </AppButton>
          </Box>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
