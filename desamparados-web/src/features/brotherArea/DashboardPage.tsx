import { Box, Typography } from '@mui/material'
import PageContainer from '../../components/PageContainer'

export default function DashboardPage() {
  return (
    <Box component="section" sx={{ py: { xs: 8, md: 12 } }}>
      <PageContainer>
        <Typography variant="h2" component="h1" sx={{ textAlign: 'center' }}>
          Mi Área de Hermano
        </Typography>
      </PageContainer>
    </Box>
  )
}
