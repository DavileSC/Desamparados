import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Button,
  useTheme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import PersonIcon from '@mui/icons-material/Person'
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk'
import ReceiptIcon from '@mui/icons-material/Receipt'
import LogoutIcon from '@mui/icons-material/Logout'
import PageTransition from '../components/PageTransition'
import { designTokens } from '../theme'
import { cerrarSesion } from '../features/members/auth/session'

const drawerWidth = 260

const menuItems = [
  { label: 'Mi perfil', href: '/area-hermano/perfil', icon: <PersonIcon /> },
  { label: 'Procesión', href: '/area-hermano/procesion', icon: <DirectionsWalkIcon /> },
  { label: 'Recibos', href: '/area-hermano/recibos', icon: <ReceiptIcon /> },
]

export default function BrotherLayout() {
  const theme = useTheme()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen)

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(`${href}/`)

  const drawer = (
    <Box sx={{ height: '100%', backgroundColor: '#100e11' }}>
      <Box sx={{ p: 3, borderBottom: '1px solid rgba(204, 196, 201, 0.2)' }}>
        <Typography
          component={Link}
          to="/"
          sx={{
            fontFamily: designTokens.fonts.heading,
            fontSize: '20px',
            color: 'text.primary',
            textDecoration: 'none',
            display: 'block',
          }}
        >
          DESAMPARADOS
        </Typography>
        <Typography variant="overline" sx={{ color: 'text.secondary', fontSize: '10px' }}>
          Área de Hermanos
        </Typography>
      </Box>
      <List sx={{ py: 2 }}>
        {menuItems.map((item) => {
          const active = isActive(item.href)
          return (
            <ListItem key={item.label} disablePadding>
              <ListItemButton
                component={Link}
                to={item.href}
                selected={active}
                onClick={() => setMobileOpen(false)}
                sx={{
                  px: 3,
                  py: 1.5,
                  color: active ? 'secondary.contrastText' : 'text.secondary',
                  backgroundColor: active ? 'primary.main' : 'transparent',
                  '&:hover': {
                    backgroundColor: active ? 'primary.main' : 'rgba(255,255,255,0.05)',
                  },
                }}
              >
                <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>{item.icon}</Box>
                <ListItemText
                  primary={item.label}
                  slotProps={{
                    primary: {
                      sx: {
                        fontFamily: theme.typography.button.fontFamily,
                        fontSize: '14px',
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      },
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>
      <Box sx={{ position: 'absolute', bottom: 0, width: '100%', p: 2 }}>
        <Button
          fullWidth
          startIcon={<LogoutIcon />}
          onClick={() => { void cerrarSesion('hermanos') }}
          sx={{
            justifyContent: 'flex-start',
            color: 'text.secondary',
            '&:hover': { color: 'primary.main', backgroundColor: 'rgba(255,255,255,0.05)' },
          }}
        >
          Cerrar sesión
        </Button>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          backgroundColor: 'rgba(38, 35, 38, 0.95)',
          borderBottom: '1px solid rgba(204, 196, 201, 0.2)',
          display: { md: 'none' },
        }}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ fontFamily: designTokens.fonts.heading }}>
            Área de Hermanos
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          slotProps={{
            paper: { sx: { width: drawerWidth, backgroundColor: '#100e11' } },
          }}
          sx={{ display: { xs: 'block', md: 'none' } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          slotProps={{
            paper: { sx: { width: drawerWidth, backgroundColor: '#100e11', borderRight: 'none' } },
          }}
          sx={{ display: { xs: 'none', md: 'block' } }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 3, md: 5 },
          pt: { xs: 10, md: 5 },
          width: { md: `calc(100% - ${drawerWidth}px)` },
          backgroundColor: 'background.default',
        }}
      >
        <PageTransition>
          <Outlet />
        </PageTransition>
      </Box>
    </Box>
  )
}
