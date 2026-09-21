import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Box, Typography, TextField, Alert, CircularProgress, Grid } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import SeccionAnimada from '../../../components/SeccionAnimada'
import Boton from '../../../components/Boton'
import { fichaPropia, misFichas, actualizarMiFicha, type ApiProfile } from '../../../lib/api/perfil'
import { profileSchema, type ProfileFormData } from './schema'

export default function EditarPerfilPage() {
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<ApiProfile | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      surname: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      postalCode: '',
    },
  })

  useEffect(() => {
    let cancelled = false

    // Sin argumentos, misFichas pide la familia entera en una sola página:
    // esta pantalla elige una ficha, y un selector paginado escondería alguna.
    misFichas()
      .then((respuesta) => {
        const currentProfile = fichaPropia(respuesta.data)
        if (cancelled) return
        if (!currentProfile) {
          setError('No se ha encontrado ningún perfil asociado a tu cuenta.')
          return
        }

        setProfile(currentProfile)
        reset({
          name: currentProfile.nombre,
          surname: currentProfile.apellidos,
          email: currentProfile.email ?? '',
          phone: currentProfile.telefono ?? '',
          address: currentProfile.direccion ?? '',
          city: currentProfile.poblacion ?? '',
          postalCode: currentProfile.codigoPostal ?? '',
        })
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se ha podido cargar tu perfil.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reset])

  const onSubmit = async (data: ProfileFormData) => {
    if (!profile) return

    setError(null)
    setSuccess(false)
    try {
      await actualizarMiFicha(profile.id, {
        nombre: data.name,
        apellidos: data.surname,
        email: data.email,
        telefono: data.phone,
        direccion: data.address,
        poblacion: data.city,
        codigoPostal: data.postalCode,
      })
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se ha podido actualizar el perfil.')
    }
  }

  return (
    <>
      <Helmet>
        <title>Editar Perfil | Desamparados</title>
      </Helmet>

      <SeccionAnimada sx={{ py: { xs: 4, md: 6 } }}>
        <ContenedorDePagina>
          <Typography variant="h2" component="h1" sx={{ mb: 4 }}>
            Editar Perfil
          </Typography>

          {loading && <CircularProgress aria-label="Cargando perfil" sx={{ mb: 4 }} />}
          {error && (
            <Alert severity="error" sx={{ mb: 4 }}>
              {error}
            </Alert>
          )}
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
                    disabled={loading || !profile}
                  label="Nombre"
                  fullWidth
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  {...register('name')}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    disabled={loading || !profile}
                  label="Apellidos"
                  fullWidth
                  error={!!errors.surname}
                  helperText={errors.surname?.message}
                  {...register('surname')}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    disabled={loading || !profile}
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
                    disabled={loading || !profile}
                  label="Teléfono"
                  fullWidth
                  error={!!errors.phone}
                  helperText={errors.phone?.message}
                  {...register('phone')}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  disabled={loading || !profile}
                  label="Dirección"
                  fullWidth
                  error={!!errors.address}
                  helperText={errors.address?.message}
                  {...register('address')}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  disabled={loading || !profile}
                  label="Ciudad"
                  fullWidth
                  error={!!errors.city}
                  helperText={errors.city?.message}
                  {...register('city')}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  disabled={loading || !profile}
                  label="Código postal"
                  fullWidth
                  error={!!errors.postalCode}
                  helperText={errors.postalCode?.message}
                  {...register('postalCode')}
                />
              </Grid>
            </Grid>

            <Boton type="submit" disabled={isSubmitting || loading || !profile} sx={{ alignSelf: 'flex-start' }}>
              Guardar cambios
            </Boton>
          </Box>
        </ContenedorDePagina>
      </SeccionAnimada>
    </>
  )
}
