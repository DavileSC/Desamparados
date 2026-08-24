import { Box, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import AnimatedSection from '../../components/AnimatedSection'

export default function AjuarPage() {
  return (
    <>
      <Helmet>
        <title>Ajuar | Desamparados</title>
      </Helmet>

      <PageHeader
        title="Ajuar"
        subtitle="Manto, corona y joyas de la Sagrada Titular."
      />

      <AnimatedSection component="section" sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Box sx={{ maxWidth: '800px', mx: 'auto' }}>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
              El ajuar de la Sagrada Titular está compuesto por piezas de extraordinario
              valor artístico y devocional, fruto del afecto y la generosidad de los
              hermanos a lo largo de la historia de la corporación. Cada elemento ha sido
              confeccionado con los mejores materiales y con el más fino trabajo de
              bordado y orfebrería.
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
              El manto principal, de rico terciopelo, luce bordados en oro que representan
              motivos marianos y los emblemas de la Hermandad. La corona, obra de orfebrería
              detallada, realza la majestad de la imagen, acompañada de joyas, rosarios y
              otros enseres que completan su atavío para las principales celebraciones
              litúrgicas y procesionales.
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              El ajuar se va enriqueciendo con nuevas donaciones y restauraciones que
              garantizan su conservación para las futuras generaciones, manteniendo vivo
              el esplendor con el que la Virgen de los Desamparados preside cada acto de
              culto y cada estación de penitencia.
            </Typography>
          </Box>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
