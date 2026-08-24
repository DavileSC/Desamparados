import { Box, Typography, Grid } from '@mui/material'
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
import { brotherProfile } from '../../../lib/mocks/brother'

const profileFields = [
  { icon: <EmailIcon sx={{ color: 'secondary.main' }} />, label: 'Email', value: brotherProfile.email },
  { icon: <PhoneIcon sx={{ color: 'secondary.main' }} />, label: 'Teléfono', value: brotherProfile.phone },
  { icon: <HomeIcon sx={{ color: 'secondary.main' }} />, label: 'Dirección', value: brotherProfile.address },
  { icon: <LocationCityIcon sx={{ color: 'secondary.main' }} />, label: 'Ciudad', value: brotherProfile.city },
  { icon: <MarkunreadMailboxIcon sx={{ color: 'secondary.main' }} />, label: 'Código postal', value: brotherProfile.postalCode },
  { icon: <CalendarTodayIcon sx={{ color: 'secondary.main' }} />, label: 'Hermano desde', value: new Date(brotherProfile.memberSince).toLocaleDateString('es-ES') },
  { icon: <BadgeIcon sx={{ color: 'secondary.main' }} />, label: 'Número de hermano', value: brotherProfile.brotherNumber },
]

export default function ProfilePage() {
  const navigate = useNavigate()

  return (
    <>
      <Helmet>
        <title>Mi Perfil | Desamparados</title>
      </Helmet>

      <AnimatedSection component="section" sx={{ py: { xs: 4, md: 6 } }}>
        <PageContainer>
          <Box
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
          </Box>

          <GlassCard sx={{ p: { xs: 3, md: 5 } }}>
            <Typography variant="h4" component="h2" sx={{ mb: 4 }}>
              {brotherProfile.name} {brotherProfile.surname}
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
          </GlassCard>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
