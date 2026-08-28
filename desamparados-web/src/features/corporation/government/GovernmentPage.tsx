import { Helmet } from 'react-helmet-async'
import { Box, Grid, Typography } from '@mui/material'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import SectionTitle from '../../../components/SectionTitle'
import AnimatedSection from '../../../components/AnimatedSection'
import GlassCard from '../../../components/GlassCard'

const offices = [
  {
    title: 'Hermano Mayor',
    description: 'Máximo responsable de la corporación, representa al Grupo Parroquial y dirige sus actuaciones con autoridad espiritual y gobierno.',
  },
  {
    title: 'Teniente Hermano Mayor',
    description: 'Segunda autoridad del Grupo Parroquial, asiste al Hermano Mayor en sus funciones y le sustituye en caso de ausencia.',
  },
  {
    title: 'Secretario',
    description: 'Gestiona la documentación, actas de reuniones, correspondencia oficial y archivo histórico de la corporación.',
  },
  {
    title: 'Tesorero',
    description: 'Administra los bienes económicos del Grupo Parroquial, elabora los presupuestos y controla los recursos con transparencia.',
  },
  {
    title: 'Vocal de Cultos',
    description: 'Coordina la celebración de los cultos, ceremonias y actos de devoción en honor a nuestra Sagrada Titular.',
  },
  {
    title: 'Vocal de Caridad',
    description: 'Impulsa las obras asistenciales y canaliza la ayuda social del Grupo Parroquial hacia quienes más lo necesitan.',
  },
  {
    title: 'Vocal de Formación',
    description: 'Promueve la educación en la fe, los encuentros formativos y la transmisión de los valores de la corporación.',
  },
]

export default function GovernmentPage() {
  return (
    <>
      <Helmet>
        <title>Órganos de Gobierno | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Órganos de Gobierno"
        subtitle="Junta de Gobierno y órganos de dirección de la corporación."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Box sx={{ maxWidth: '850px', mx: 'auto', mb: 6 }}>
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8, textAlign: 'center' }}>
              La Junta de Gobierno es el órgano colegiado encargado de la dirección,
              administración y representación del Grupo Parroquial. Desde sus distintas vocales,
              trabaja unida al servicio de los hermanos y de la misión evangelizadora de la
              corporación.
            </Typography>
          </Box>

          <SectionTitle title="Cargos de la Junta de Gobierno" centered />
          <Grid container spacing={3}>
            {offices.map((office) => (
              <Grid key={office.title} size={{ xs: 12, md: 6 }}>
                <GlassCard sx={{ p: 4, height: '100%' }}>
                  <Typography variant="h6" component="h3" sx={{ mb: 1.5, color: 'text.primary' }}>
                    {office.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                    {office.description}
                  </Typography>
                </GlassCard>
              </Grid>
            ))}
          </Grid>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
