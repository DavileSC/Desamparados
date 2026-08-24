import { Helmet } from 'react-helmet-async'
import { Box, Typography } from '@mui/material'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import AnimatedSection from '../../../components/AnimatedSection'

export default function CaridadPage() {
  return (
    <>
      <Helmet>
        <title>Caridad | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Caridad"
        subtitle="Ayuda social y obra asistencial de la Hermandad."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Box sx={{ maxWidth: '850px', mx: 'auto' }}>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              La caridad constituye uno de los fines fundamentales de nuestra Hermandad.
              Inspirados en la advocación de Nuestra Señora de los Desamparados, buscamos
              ser signo vivo de la misericordia de Dios, acogiendo a quienes viven en
              situación de soledad, enfermedad o exclusión social.
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              A través de la Vocalía de Caridad, la Hermandad pone en marcha diferentes
              iniciativas de ayuda social: reparto de alimentos, atención a familias en
              dificultades, visitas a enfermos y personas mayores, así como colaboración
              con otras entidades del ámbito social de Málaga.
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              La obra asistencial no se entiende sin la participación activa de los
              hermanos. Muchos de ellos dedican parte de su tiempo al servicio voluntario,
              convencidos de que la fe se hace visible cuando se traduce en gestos concretos
              de amor y solidaridad.
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
              Queremos que nuestra Hermandad sea una comunidad acogedora, capaz de mirar
              con los ojos de la Virgen a cuantos sufren y de extender la mano a quienes
              más lo necesitan. La caridad, en definitiva, es el criterio último que da
              sentido a nuestra existencia como corporación.
            </Typography>
          </Box>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
