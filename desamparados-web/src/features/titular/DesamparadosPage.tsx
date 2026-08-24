import { Box, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import AnimatedSection from '../../components/AnimatedSection'

export default function DesamparadosPage() {
  return (
    <>
      <Helmet>
        <title>Desamparados | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Desamparados"
        subtitle="Historia y devoción a nuestra Amantísima Titular."
      />

      <AnimatedSection component="section" sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Box sx={{ maxWidth: '800px', mx: 'auto' }}>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
              La devoción a Nuestra Señora de los Desamparados tiene sus raíces en la
              tradición mariana valenciana, extendiéndose posteriormente por todo el
              territorio español. En nuestra Hermandad, la Virgen de los Desamparados es
              acogida como Madre y Titular, patrona de aquellos que se sienten solos,
              olvidados o necesitados de misericordia.
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
              A lo largo de los años, la imagen titular ha sido venerada en la Sede
              Canónica de la corporación, siendo centro de los cultos más solemnes y de
              la piedad de hermanos y devotos. Su rostro sereno y su manto protector
              invitan a la confianza, recordando que nadre queda desamparado bajo la
              mirada de María.
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              Cada noviembre, la Hermandad celebra solemne triduo en su honor, culminando
              con un devoto besamanos que congrega a fieles de toda la ciudad. Estas
              celebraciones son expresión viva de la fe puesta en la Virgen y del
              compromiso de la corporación con su advocación.
            </Typography>
          </Box>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
