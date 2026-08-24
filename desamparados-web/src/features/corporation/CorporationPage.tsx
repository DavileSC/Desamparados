import { Helmet } from 'react-helmet-async'
import { Box, Grid, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import SectionTitle from '../../components/SectionTitle'
import AnimatedSection from '../../components/AnimatedSection'
import GlassCard from '../../components/GlassCard'

const sections = [
  { label: 'Historia', description: 'Orígenes y evolución de nuestra Hermandad.', to: '/corporacion/historia' },
  { label: 'Parroquia', description: 'Nuestra sede canónica y la comunidad pasionista.', to: '/corporacion/parroquia-pasionistas' },
  { label: 'Nuestros fines', description: 'Caridad y formación como ejes de nuestra acción.', to: '/corporacion/nuestros-fines' },
  { label: 'Cultos', description: 'Celebraciones y devociones en honor a nuestra Sagrada Titular.', to: '/corporacion/cultos' },
  { label: 'Sábado de Pasión', description: 'Nuestra salida procesional por las calles de Málaga.', to: '/corporacion/sabado-de-pasion' },
]

export default function CorporationPage() {
  return (
    <>
      <Helmet>
        <title>Corporación | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Corporación"
        subtitle="Grupo Parroquial de Nuestra Señora de los Desamparados."
      />

      <AnimatedSection component="section" sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Box sx={{ maxWidth: '850px', mx: 'auto', mb: 6 }}>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              La Hermandad y Cofradía de Nazarenos de Nuestra Señora de los Desamparados,
              Santo Cristo de la Buena Muerte y San Juan de la Palma es una corporación
              religiosa fundada en el seno de la Parroquia de los Padres Pasionistas de
              Málaga. Desde sus orígenes, la Hermandad ha vivido su fe a través de la
              devoción a la Santísima Virgen bajo la advocación de los Desamparados,
              acogiendo a cuantos buscan consuelo y esperanza.
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              Como Grupo Parroquial, desarrollamos una intensa labor espiritual, caritativa
              y formativa al servicio de la Iglesia y de la ciudad. Nuestra comunidad de
              hermanos y cofrades se reúne en torno a los cultos, la oración, la enseñanza
              de la fe y la entrega a los más necesitados, manteniendo vivas las tradiciones
              que nos definen.
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
              A continuación puedes conocer más sobre nuestra historia, nuestra sede
              parroquial, los fines que nos mueven, los cultos que celebramos y nuestra
              estación de penitencia del Sábado de Pasión.
            </Typography>
          </Box>

          <SectionTitle title="Explora la sección" centered />
          <Grid container spacing={3}>
            {sections.map((section) => (
              <Grid key={section.label} size={{ xs: 12, md: 6, lg: 4 }}>
                <Box component={Link} to={section.to} sx={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                  <GlassCard
                    sx={{
                      p: 4,
                      '&:hover': {
                        borderColor: 'rgba(193, 172, 0, 0.3)',
                        transform: 'translateY(-4px)',
                      },
                    }}
                  >
                    <Typography variant="h6" component="h3" sx={{ mb: 1, color: 'text.primary' }}>
                      {section.label}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                      {section.description}
                    </Typography>
                  </GlassCard>
                </Box>
              </Grid>
            ))}
          </Grid>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
