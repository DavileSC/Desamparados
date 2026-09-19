import { Helmet } from 'react-helmet-async'
import { Box } from '@mui/material'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import AnimatedSection from '../../components/AnimatedSection'
import { SECCION_TRAS_CABECERA } from '../../components/espaciado'

interface LegalPageLayoutProps {
  title: string
  children: React.ReactNode
}

export default function LegalPageLayout({ title, children }: LegalPageLayoutProps) {
  return (
    <>
      <Helmet>
        <title>{`${title} | Desamparados`}</title>
      </Helmet>
      <PageHeader title={title} />
      <AnimatedSection sx={SECCION_TRAS_CABECERA}>
        <PageContainer>
          <Box sx={{ maxWidth: '850px', mx: 'auto', color: 'text.secondary', lineHeight: 1.8 }}>
            {children}
          </Box>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
