import { Box, Typography, Grid } from '@mui/material'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber'
import HistoryIcon from '@mui/icons-material/History'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import AnimatedSection from '../../../components/AnimatedSection'
import GlassCard from '../../../components/GlassCard'
import { SECCION_TRAS_CABECERA } from '../../../components/espaciado'

const links = [
  {
    title: 'Papeleta de Sitio',
    description: 'Consulta tu papeleta para la próxima estación de penitencia.',
    href: '/area-hermano/procesion/papeleta',
    icon: <ConfirmationNumberIcon sx={{ fontSize: 40, color: 'secondary.main' }} />,
  },
  {
    title: 'Histórico de Procesiones',
    description: 'Revisa tu participación en años anteriores.',
    href: '/area-hermano/procesion/historico',
    icon: <HistoryIcon sx={{ fontSize: 40, color: 'secondary.main' }} />,
  },
]

export default function ProcessionPage() {
  return (
    <>
      <Helmet>
        <title>Procesión | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Procesión"
        subtitle="Información sobre tu participación en la estación de penitencia."
      />

      <AnimatedSection sx={SECCION_TRAS_CABECERA}>
        <PageContainer>
          <Grid container spacing={4}>
            {links.map((item) => (
              <Grid size={{ xs: 12, md: 6 }} key={item.title}>
                <Link
                  to={item.href}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                >
                  <GlassCard
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      p: 5,
                      '&:hover': { background: 'rgba(255, 255, 255, 0.05)' },
                    }}
                  >
                    <Box sx={{ mb: 2 }}>{item.icon}</Box>
                    <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {item.description}
                    </Typography>
                  </GlassCard>
                </Link>
              </Grid>
            ))}
          </Grid>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
