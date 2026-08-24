import { Helmet } from 'react-helmet-async'
import { Box } from '@mui/material'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import AnimatedSection from '../../components/AnimatedSection'

interface LegalPageLayoutProps {
  title: string
  children: React.ReactNode
}

export default function LegalPageLayout({ title, children }: LegalPageLayoutProps) {
  return (
    <>
      <Helmet>
        <title>{title} | Desamparados</title>
      </Helmet>
      <PageHeader title={title} />
      <AnimatedSection component="section" sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Box sx={{ maxWidth: '850px', mx: 'auto', color: 'text.secondary', lineHeight: 1.8 }}>
            {children}
          </Box>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
