import { Helmet } from 'react-helmet-async'
import { Box, Typography } from '@mui/material'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import AnimatedSection from '../../../components/AnimatedSection'

export default function FormacionPage() {
  return (
    <>
      <Helmet>
        <title>Formación | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Formación"
        subtitle="Educación en la fe y transmisión de valores."
      />

      <AnimatedSection component="section" sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Box sx={{ maxWidth: '850px', mx: 'auto' }}>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              La formación cristiana es uno de los pilares sobre los que se sustenta la
              vida de nuestra Hermandad. Entendida como educación permanente en la fe,
              busca ayudar a cada hermano a crecer en el conocimiento de Dios, en la
              vivencia de los valores evangélicos y en la entrega a la misión de la Iglesia.
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              Durante el año se organizan diferentes actividades formativas: conferencias,
              retiros, grupos de oración, sesiones de catequesis y encuentros dirigidos a
              hermanos, cofrades y devotos. Estas iniciativas tienen como objetivo profundizar
              en la espiritualidad de la Pasión, en la devoción mariana y en la identidad
              propia de la corporación.
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              La formación también abarca la transmisión de los valores cofrades a las
              nuevas generaciones. Los jóvenes y los nuevos hermanos reciben una atención
              especial para que puedan conocer la historia, los fines y las tradiciones de
              la Hermandad, insertándose plenamente en su vida comunitaria.
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
              Desde la Vocalía de Formación se promueve un itinerario formativo continuo,
              abierto a todos y adaptado a las distintas edades y sensibilidades, con el
              deseo de que cada hermano viva su pertenencia a la Hermandad como un auténtico
              camino de fe y santidad.
            </Typography>
          </Box>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
