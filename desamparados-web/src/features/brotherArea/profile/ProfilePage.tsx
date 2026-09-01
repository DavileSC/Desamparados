import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, Typography, Grid } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import EditIcon from '@mui/icons-material/Edit'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import BadgeIcon from '@mui/icons-material/Badge'
import EmailIcon from '@mui/icons-material/Email'
import PhoneIcon from '@mui/icons-material/Phone'
import HomeIcon from '@mui/icons-material/Home'
import LocationCityIcon from '@mui/icons-material/LocationCity'
import MarkunreadMailboxIcon from '@mui/icons-material/MarkunreadMailbox'
import PageContainer from '../../../components/PageContainer'
import AnimatedSection from '../../../components/AnimatedSection'
import GlassCard from '../../../components/GlassCard'
import AppButton from '../../../components/AppButton'
import { getMyProfiles, type ApiProfile } from '../../../lib/api/profile'

export default function ProfilePage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ApiProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    // Sin argumentos, getMyProfiles pide la familia entera en una sola página:
    // esta pantalla elige una ficha, y un selector paginado escondería alguna.
    getMyProfiles()
      .then((respuesta) => {
        if (!cancelled) {
          setProfile(respuesta.data[0] ?? null)
          if (respuesta.data.length === 0) setError('No se ha encontrado ningún perfil asociado a tu cuenta.')
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se ha podido cargar tu perfil.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const profileFields = profile
    ? [
        { icon: <EmailIcon sx={{ color: 'secondary.main' }} />, label: 'Email', value: profile.email ?? 'No indicado' },
        { icon: <PhoneIcon sx={{ color: 'secondary.main' }} />, label: 'Teléfono', value: profile.telefono ?? 'No indicado' },
        { icon: <HomeIcon sx={{ color: 'secondary.main' }} />, label: 'Dirección', value: profile.direccion ?? 'No indicada' },
        { icon: <LocationCityIcon sx={{ color: 'secondary.main' }} />, label: 'Ciudad', value: profile.poblacion ?? 'No indicada' },
        { icon: <MarkunreadMailboxIcon sx={{ color: 'secondary.main' }} />, label: 'Código postal', value: profile.codigoPostal ?? 'No indicado' },
        { icon: <CalendarTodayIcon sx={{ color: 'secondary.main' }} />, label: 'Hermano desde', value: new Date(profile.fechaAlta).toLocaleDateString('es-ES') },
        { icon: <BadgeIcon sx={{ color: 'secondary.main' }} />, label: 'Número de hermano', value: profile.numeroHermano?.toString() ?? 'Pendiente de asignar' },
      ]
    : []

  return (
    <>
      <Helmet>
        <title>Mi Perfil | Desamparados</title>
      </Helmet>

      <AnimatedSection sx={{ py: { xs: 4, md: 6 } }}>
        <PageContainer>
          {loading && <CircularProgress aria-label="Cargando perfil" />}
          {error && <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>}

          {profile && <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', md: 'center' },
              gap: 2,
              mb: 4,
            }}
          >
            <Typography variant="h2" component="h1">
              Mi Perfil
            </Typography>
            <AppButton
              onClick={() => navigate('/area-hermano/perfil/editar')}
              startIcon={<EditIcon />}
            >
              Editar datos
            </AppButton>
          </Box>}

          {profile && <GlassCard sx={{ p: { xs: 3, md: 5 } }}>
            <Typography variant="h4" component="h2" sx={{ mb: 4 }}>
              {profile.nombre} {profile.apellidos}
            </Typography>

            <Grid container spacing={3}>
              {profileFields.map((field) => (
                <Grid size={{ xs: 12, sm: 6 }} key={field.label}>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    {field.icon}
                    <Box>
                      <Typography variant="overline" sx={{ display: 'block', lineHeight: 1.2 }}>
                        {field.label}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {field.value}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </GlassCard>}
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
