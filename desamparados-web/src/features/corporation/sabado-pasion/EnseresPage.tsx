import { Helmet } from 'react-helmet-async'
import { Box, Typography } from '@mui/material'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import AnimatedSection from '../../../components/AnimatedSection'

export default function EnseresPage() {
  return (
    <>
      <Helmet>
        <title>Enseres | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Enseres"
        subtitle="Acompañamiento musical e insignias."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Box sx={{ maxWidth: '850px', mx: 'auto' }}>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              Los enseres procesionales son elementos fundamentales que acompañan a la
              Grupo Parroquial durante su estación de penitencia. Entre ellos destacan el
              acompañamiento musical, las insignias corporativas, las lámparas, los
              varales del palio y los distintivos que identifican a los hermanos en la
              calle.
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              La música acompaña el paso de Nuestra Señora de los Desamparados, creando
              una atmósfera de recogimiento y solemnidad. La banda o agrupación musical
              interpreta marchas procesionales compuestas expresamente para la Virgen,
              muchas de ellas fruto del cariño y la devoción de músicos y cofrades.
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              Las insignias del Grupo Parroquial, como el estandarte, el guión o la criz de
              guía, abren y cierran la comitiva, mostrando los símbolos de la corporación.
              Cada una de ellas ha sido confeccionada con materiales de calidad y diseños
              que reflejan la espiritualidad y la historia de los Desamparados.
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
              El cuidado de los enseres es tarea de todos los hermanos, conscientes de que
              estos objetos no son meros adornos, sino signos visibles de una identidad
              cofrade que se transmite de generación en generación con respeto y cariño.
            </Typography>
          </Box>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
