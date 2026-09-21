import { Box, Typography } from '@mui/material'
import ContenedorDePagina from '../../components/ContenedorDePagina'

export default function PanelHermanoPage() {
  return (
    <Box component="section" sx={{ py: { xs: 8, md: 12 } }}>
      <ContenedorDePagina>
        <Typography variant="h2" component="h1" sx={{ textAlign: 'center' }}>
          Mi Área de Hermano
        </Typography>
      </ContenedorDePagina>
    </Box>
  )
}
