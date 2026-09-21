import { Outlet } from 'react-router-dom'
import { Box } from '@mui/material'
import BarraDeNavegacion from '../components/BarraDeNavegacion'
import PieDePagina from '../components/PieDePagina'
import AvisoDeCookies from '../components/AvisoDeCookies'
import TransicionDePagina from '../components/TransicionDePagina'

export default function MarcoPublico() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <BarraDeNavegacion />
      <Box
        component="main"
        sx={{
          flex: 1,
        }}
      >
        <TransicionDePagina>
          <Outlet />
        </TransicionDePagina>
      </Box>
      <PieDePagina />
      <AvisoDeCookies />
    </Box>
  )
}
