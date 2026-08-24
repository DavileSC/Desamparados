import { Helmet } from 'react-helmet-async'
import { Box, Typography } from '@mui/material'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import AnimatedSection from '../../../components/AnimatedSection'

export default function HistoryPage() {
  return (
    <>
      <Helmet>
        <title>Historia | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Historia"
        subtitle="Orígenes y evolución de nuestra Hermandad."
      />

      <AnimatedSection component="section" sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Box sx={{ maxWidth: '850px', mx: 'auto' }}>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              Los orígenes de la Hermandad de los Desamparados se encuentran en la devoción
              popular que, a lo largo del siglo XX, fue creciendo en torno a la imagen de
              Nuestra Señora de los Desamparados en la Parroquia de los Padres Pasionistas.
              Lo que comenzó como un pequeño grupo de fieles animados por el amor a la Virgen
              fue conformándose paulatinamente en una corporación religiosa con identidad
              propia.
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              En sus primeros años, la Hermandad se dedicó especialmente a la promoción del
              culto a la Virgen y a la organización de las celebraciones litúrgicas propias
              de la parroquia. Con el tiempo, fue ampliando sus fines y actividades,
              incorporando la caridad hacia los más necesitados y la formación religiosa de
              hermanos y devotos como ejes fundamentales de su acción.
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              La consolidación de la corporación como Hermandad y Cofradía de Nazarenos
              permitió dar un paso decisivo en su vida pública: la salida procesional del
              Sábado de Pasión, momento en el que la imagen de la Sagrada Titular recorre
              las calles del centro histórico de Málaga, acompañada por sus hermanos y por
              una numerosa feligresía.
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              A lo largo de su historia, la Hermandad ha vivido momentos de esplendor y
              otros de dificultad, pero siempre ha mantenido firme su compromiso con la fe,
              la tradición y el servicio a la comunidad. Cada generación de hermanos ha
              heredado la responsabilidad de conservar y transmitir el legado recibido.
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
              Hoy, la Hermandad de los Desamparados continúa su camino con la mirada puesta
              en la Virgen María, buscando ser signo de esperanza en la Iglesia de Málaga y
              testigo vivo de la misericordia de Dios hacia todos, especialmente hacia los
              más desamparados.
            </Typography>
          </Box>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
