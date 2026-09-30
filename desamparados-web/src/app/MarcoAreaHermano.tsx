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
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom'
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk'
import ReceiptIcon from '@mui/icons-material/Receipt'
import LogoutIcon from '@mui/icons-material/Logout'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EscudoDelGrupo from '../components/EscudoDelGrupo'
import TransicionDePagina from '../components/TransicionDePagina'
import { designTokens } from '../theme'
import { cerrarSesion } from '../features/altas/auth/session'
import { site } from '../config/site'

const ANCHO_CAJON = 260

const entradasDelMenu = [
  { label: 'Mi perfil', href: '/area-hermano/perfil', icon: <PersonIcon /> },
  // Las fichas de quienes están a su cargo: un menor apuntado por su padre, su
  // tío o su padrino. Sin esta pantalla, el alta de un menor solo se podía
  // hacer el día del registro y nunca más.
  { label: 'Mi familia', href: '/area-hermano/familia', icon: <FamilyRestroomIcon /> },
  { label: 'Procesión', href: '/area-hermano/procesion', icon: <DirectionsWalkIcon /> },
  { label: 'Recibos', href: '/area-hermano/recibos', icon: <ReceiptIcon /> },
]

export default function MarcoAreaHermano() {
  const theme = useTheme()
  const location = useLocation()
  const [cajonAbierto, setCajonAbierto] = useState(false)

  const alternarCajon = () => setCajonAbierto(!cajonAbierto)

  const esActiva = (href: string) =>
    location.pathname === href || location.pathname.startsWith(`${href}/`)

  const cajon = (
    <Box sx={{ height: '100%', backgroundColor: '#070608' }}>
      <Box sx={{ p: 3, borderBottom: '1px solid rgba(204, 196, 201, 0.2)' }}>
        <Box
          component={Link}
          to="/"
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none' }}
        >
          <EscudoDelGrupo alto={40} />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontFamily: designTokens.fonts.heading,
                fontSize: '20px',
                lineHeight: 1.15,
                color: 'text.primary',
                display: 'block',
              }}
            >
              {site.nombreCorto.toUpperCase()}
            </Typography>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontSize: '11px' }}>
              Área de hermanos
            </Typography>
          </Box>
        </Box>
      </Box>
      <List sx={{ py: 2 }}>
        {entradasDelMenu.map((item) => {
          const activa = esActiva(item.href)
          return (
            <ListItem key={item.label} disablePadding>
              <ListItemButton
                component={Link}
                to={item.href}
                selected={activa}
                onClick={() => setCajonAbierto(false)}
                sx={{
                  px: 3,
                  py: 1.5,
                  color: activa ? 'secondary.contrastText' : 'text.secondary',
                  backgroundColor: activa ? 'primary.main' : 'transparent',
                  '&:hover': {
                    backgroundColor: activa ? 'primary.main' : 'rgba(255,255,255,0.05)',
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
                        // Como el menú de la web, no como el del CMS: sin
                        // mayúsculas ni espaciado.
                        fontSize: '15px',
                        fontWeight: activa ? 600 : 500,
                      },
                    },
                  }}
                />
              </ListItemButton>
            </ListItem>
          )
        })}
      </List>
      <Box sx={{ position: 'absolute', bottom: 0, width: '100%', p: 2, display: 'grid', gap: 0.5 }}>
        {/* El área es parte de la web: siempre se puede volver a ella. */}
        <Button
          fullWidth
          component={Link}
          to="/"
          startIcon={<ArrowBackIcon />}
          onClick={() => setCajonAbierto(false)}
          sx={{
            justifyContent: 'flex-start',
            color: 'text.secondary',
            textTransform: 'none', letterSpacing: 0, fontSize: 15, fontWeight: 500,
            '&:hover': { color: 'text.primary', backgroundColor: 'rgba(255,255,255,0.05)' },
          }}
        >
          Volver a la web
        </Button>
        <Button
          fullWidth
          startIcon={<LogoutIcon />}
          onClick={() => { void cerrarSesion('hermanos') }}
          sx={{
            justifyContent: 'flex-start',
            color: 'text.secondary',
            textTransform: 'none', letterSpacing: 0, fontSize: 15, fontWeight: 500,
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
          width: { md: `calc(100% - ${ANCHO_CAJON}px)` },
          ml: { md: `${ANCHO_CAJON}px` },
          backgroundColor: 'rgba(18, 17, 19, 0.95)',
          borderBottom: '1px solid rgba(204, 196, 201, 0.2)',
          display: { md: 'none' },
        }}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={alternarCajon} sx={{ mr: 2 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ fontFamily: designTokens.fonts.heading }}>
            Área de hermanos
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: ANCHO_CAJON }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={cajonAbierto}
          onClose={alternarCajon}
          ModalProps={{ keepMounted: true }}
          slotProps={{
            paper: { sx: { width: ANCHO_CAJON, backgroundColor: '#070608' } },
          }}
          sx={{ display: { xs: 'block', md: 'none' } }}
        >
          {cajon}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          slotProps={{
            paper: { sx: { width: ANCHO_CAJON, backgroundColor: '#070608', borderRight: 'none' } },
          }}
          sx={{ display: { xs: 'none', md: 'block' } }}
        >
          {cajon}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 3, md: 5 },
          pt: { xs: 10, md: 5 },
          width: { md: `calc(100% - ${ANCHO_CAJON}px)` },
          backgroundColor: 'background.default',
        }}
      >
        <TransicionDePagina>
          <Outlet />
        </TransicionDePagina>
      </Box>
    </Box>
  )
}
