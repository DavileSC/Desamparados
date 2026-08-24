import { Outlet } from 'react-router-dom'
import { Box } from '@mui/material'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import CookieBanner from '../components/CookieBanner'
import PageTransition from '../components/PageTransition'

export default function PublicLayout() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <Box
        component="main"
        sx={{
          flex: 1,
        }}
      >
        <PageTransition>
          <Outlet />
        </PageTransition>
      </Box>
      <Footer />
      <CookieBanner />
    </Box>
  )
}
