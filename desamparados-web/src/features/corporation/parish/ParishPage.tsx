import { Helmet } from 'react-helmet-async'
import { Box, Typography } from '@mui/material'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import AnimatedSection from '../../../components/AnimatedSection'

export default function ParishPage() {
  return (
    <>
      <Helmet>
        <title>Parroquia - Pasionistas | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Parroquia - Pasionistas"
        subtitle="Nuestra sede canónica y la comunidad pasionista."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Box sx={{ maxWidth: '850px', mx: 'auto' }}>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              La Parroquia de Nuestra Señora de los Desamparados, atendida por la
              Congregación de la Pasión, es la sede canónica de nuestra Hermandad.
              Ubicada en el corazón de Málaga, el templo parroquial acoge no solo la vida
              litúrgica de la comunidad, sino también la devoción particular a la Virgen
              de los Desamparados y al Santo Cristo de la Buena Muerte.
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              Los Padres Pasionistas, con su espiritualidad centrada en la Cruz y en el
              amor misericordioso de Dios, acompañan espiritualmente a la Hermandad desde
              sus orígenes. Su misión evangelizadora y su entrega a los más desfavorecidos
              constituyen un referente para nuestra acción caritativa y formativa.
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              En el templo parroquial se celebran los cultos principales de la Hermandad:
              triduos, besamanos, quinarios y las ceremonias propias de la Semana Santa.
              Es también el lugar de encuentro de los hermanos, donde se reúnen para la
              oración, la formación y la organización de las actividades corporativas.
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
              La comunidad pasionista y la Hermandad mantienen una estrecha colaboración
              que se traduce en un mismo proyecto pastoral: anunciar el Evangelio de la
              Cruz, acoger al que sufre y formar discípulos comprometidos con la fe y la
              caridad.
            </Typography>
          </Box>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
