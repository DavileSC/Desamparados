import { Typography, Grid } from '@mui/material'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useQuery } from '@tanstack/react-query'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import AnimatedSection from '../../components/AnimatedSection'
import GlassCard from '../../components/GlassCard'
import GaleriaMedios from '../../components/GaleriaMedios'
import { CLAVE_TITULAR, getContenido, type ContenidoTitular } from '../../lib/api/contenido'

const links = [
  {
    title: 'Desamparados',
    description: 'Historia y devoción a nuestra Amantísima Titular.',
    href: '/sagrada-titular/desamparados',
  },
  {
    title: 'Ajuar',
    description: 'Manto, corona y joyas de la Sagrada Titular.',
    href: '/sagrada-titular/ajuar',
  },
]

export default function TitularPage() {
  // El texto y la galería los edita el Grupo Parroquial desde el CMS. Antes las
  // cuatro fotos estaban escritas aquí dentro y no había forma de cambiarlas.
  const { data } = useQuery({
    queryKey: CLAVE_TITULAR,
    queryFn: () => getContenido<ContenidoTitular>('titular'),
  })

  return (
    <>
      <Helmet>
        <title>Sagrada Titular | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Sagrada Titular"
        subtitle="Nuestra Señora de los Desamparados."
        image="/images/hero-960.jpg"
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Typography
            variant="body1"
            sx={{
              maxWidth: '800px',
              mx: 'auto',
              textAlign: 'center',
              color: 'text.secondary',
              mb: 8,
              fontSize: { xs: '16px', md: '18px' },
            }}
          >
            {data?.subtitulo}
          </Typography>

          <GaleriaMedios medios={data?.galeria ?? []} />

          <Grid container spacing={4} sx={{ mt: 2 }}>
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
                      p: 4,
                      '&:hover': { background: 'rgba(255, 255, 255, 0.05)' },
                    }}
                  >
                    <Typography
                      variant="h4"
                      component="h3"
                      sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      {item.title}
                      <ArrowForwardIcon sx={{ color: 'secondary.main', fontSize: 24 }} />
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
