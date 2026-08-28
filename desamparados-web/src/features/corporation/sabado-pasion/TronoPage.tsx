import { Helmet } from 'react-helmet-async'
import { Box, Typography } from '@mui/material'
import PageContainer from '../../../components/PageContainer'
import PageHeader from '../../../components/PageHeader'
import AnimatedSection from '../../../components/AnimatedSection'

export default function TronoPage() {
  return (
    <>
      <Helmet>
        <title>Trono | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Trono"
        subtitle="El trono de nuestra Sagrada Titular."
      />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Box sx={{ maxWidth: '850px', mx: 'auto' }}>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              El trono de Nuestra Señora de los Desamparados es una de las piezas más
              destacadas del patrimonio artístico y devocional del Grupo Parroquial. Diseñado
              para resaltar la belleza de la Sagrada Titular, combina la solidez de la
              ebanistería con el brillo de los metales, los bordados y las flores que lo
              adornan en su salida procesional.
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              Cada detalle del trono ha sido pensado para crear un conjunto armonioso que
              acompañe la imagen de la Virgen. Sus líneas, inspiradas en la tradición
              cofrade malagueña, se enriquecen con apliques dorados, lámparas de cristal y
              un exorno floral que varía cada año para vestir de manera única el paso de
              palio.
            </Typography>
            <Typography variant="body1" sx={{ mb: 3, color: 'text.secondary', lineHeight: 1.8 }}>
              El trono es portado por una cuadrilla de costaleros que, con esfuerzo y
              devoción, hacen posible que la Virgen avance entre el pueblo. Su andar
              pausado y solemne marca el ritmo de la procesión, generando momentos de
              gran emoción en cada una de las calles que recorre.
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
              Alrededor del trono se organizan los cargos de la procesión, los hermanos de
              luz y la música, configurando una comitiva que honra a la Sagrada Titular y
              que expresa la identidad propia del Grupo Parroquial en el Sábado de Pasión.
            </Typography>
          </Box>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
