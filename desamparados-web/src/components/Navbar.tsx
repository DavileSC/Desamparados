import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  AppBar,
  Toolbar,
  Box,
  Button,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import HomeIcon from '@mui/icons-material/Home'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import ChurchIcon from '@mui/icons-material/Church'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import NewspaperIcon from '@mui/icons-material/Newspaper'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import GroupIcon from '@mui/icons-material/Group'
import MailIcon from '@mui/icons-material/Mail'
import FacebookIcon from '@mui/icons-material/Facebook'
import CloseIcon from '@mui/icons-material/Close'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'

interface NavItem {
  label: string
  href: string
}

const navItems: NavItem[] = [
  { label: 'Inicio', href: '/' },
  { label: 'Corporación', href: '/corporacion' },
  { label: 'Sagrada Titular', href: '/sagrada-titular' },
  { label: 'Actualidad', href: '/actualidad' },
  { label: 'Publicaciones', href: '/publicaciones' },
  { label: 'Contacto', href: '/contacto' },
]

const drawerItems = [
  { label: 'Inicio', href: '/', icon: <HomeIcon /> },
  { label: 'Corporación', href: '/corporacion', icon: <AccountBalanceIcon /> },
  { label: 'Cultos', href: '/corporacion/cultos', icon: <ChurchIcon /> },
  { label: 'Sábado de Pasión', href: '/corporacion/sabado-de-pasion', icon: <AutoStoriesIcon /> },
  { label: 'Sagrada Titular', href: '/sagrada-titular', icon: <Brightness7Icon /> },
  { label: 'Actualidad', href: '/actualidad', icon: <NewspaperIcon /> },
  { label: 'Publicaciones', href: '/publicaciones', icon: <MenuBookIcon /> },
  { label: 'Hermanos', href: '/hermanos', icon: <GroupIcon /> },
  { label: 'Contacto', href: '/contacto', icon: <MailIcon /> },
]

const socialLinks = [
  { icon: <FacebookIcon fontSize="small" />, href: '#', label: 'Facebook' },
  { icon: <CloseIcon fontSize="small" />, href: '#', label: 'X' },
  { icon: <PlayCircleIcon fontSize="small" />, href: '#', label: 'YouTube' },
]

// Anchura mínima a partir de la cual cabe la barra completa (logo + menú + botón + redes)
// con márgenes cómodos. Por debajo se usa el menú hamburguesa.
const DESKTOP_NAV_MIN = 1366
const desktopMq = `@media (min-width:${DESKTOP_NAV_MIN}px)`

export default function Navbar() {
  const theme = useTheme()
  const isMobile = useMediaQuery(`(max-width:${DESKTOP_NAV_MIN - 1}px)`)
  const location = useLocation()
  const [scrollProgress, setScrollProgress] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    let targetProgress = 0
    let currentProgress = 0
    let animationFrameId: number

    const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor

    const updateProgress = () => {
      currentProgress = lerp(currentProgress, targetProgress, 0.08)
      if (Math.abs(currentProgress - targetProgress) > 0.001) {
        setScrollProgress(currentProgress)
        animationFrameId = requestAnimationFrame(updateProgress)
      } else {
        setScrollProgress(targetProgress)
      }
    }

    const handleScroll = () => {
      const maxScroll = 120
      targetProgress = Math.min(window.scrollY / maxScroll, 1)
      cancelAnimationFrame(animationFrameId)
      animationFrameId = requestAnimationFrame(updateProgress)
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => {
      window.removeEventListener('scroll', handleScroll)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  const toggleDrawer = (open: boolean) => () => setDrawerOpen(open)

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/'
    return location.pathname === href || location.pathname.startsWith(`${href}/`)
  }

  return (
    <>
      {isMobile && (
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            backgroundColor: 'rgba(38, 35, 38, 0.9)',
            borderBottom: '1px solid rgba(204, 196, 201, 0.2)',
            display: 'flex',
            [desktopMq]: { display: 'none' },
          }}
        >
          {/* Mismos márgenes laterales que PageContainer para que el logo quede alineado con los títulos */}
          <Toolbar sx={{ justifyContent: 'space-between', px: { xs: '20px !important', md: '64px !important' } }}>
            <Box
              component={Link}
              to="/"
              sx={{
                fontFamily: theme.typography.h1.fontFamily,
                fontSize: '24px',
                color: 'text.primary',
                textDecoration: 'none',
              }}
            >
              DESAMPARADOS
            </Box>
            <IconButton
              edge="end"
              aria-label="menu"
              onClick={toggleDrawer(true)}
              sx={{ color: 'text.primary' }}
            >
              <MenuIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
      )}

      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          backgroundColor: `rgba(38, 35, 38, ${0.12 + scrollProgress * 0.66})`,
          backgroundImage: 'none',
          backdropFilter: `blur(${10 + scrollProgress * 14}px) saturate(${110 + scrollProgress * 60}%)`,
          WebkitBackdropFilter: `blur(${10 + scrollProgress * 14}px) saturate(${110 + scrollProgress * 60}%)`,
          borderBottom: 'none',
          boxShadow: 'none',
          transition: 'background-color 0.35s ease, backdrop-filter 0.35s ease',
          display: 'none',
          [desktopMq]: { display: 'flex' },
        }}
      >
        <Toolbar
          disableGutters
          sx={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexWrap: 'nowrap',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: { xs: 4, xl: 6 }, // separación logo → menú: 32px en portátiles, 48px en pantallas grandes
            // Barra a todo el ancho: logo y menú pegados a la izquierda, acciones a la derecha
            width: '100%',
            minHeight: '72px !important',
            px: { xs: '40px', xl: '48px' },
          }}
        >
          <Box
            component={Link}
            to="/"
            sx={{
              fontFamily: theme.typography.h1.fontFamily,
              fontSize: '28px',
              lineHeight: 1,
              color: 'text.primary',
              textDecoration: 'none',
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            DESAMPARADOS
          </Box>

          {/* Todo en una sola línea, centrado verticalmente: enlaces, botón e iconos comparten
              la misma altura (40px) para que queden alineados entre sí y con el logo. */}
          <Box
            component="nav"
            aria-label="Navegación principal"
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'nowrap',
              gap: { xs: 1.5, xl: 2 },
              minWidth: 0,
            }}
          >
            {navItems.map((item) => {
              const active = isActive(item.href)
              return (
                <Button
                  key={item.label}
                  component={Link}
                  to={item.href}
                  sx={{
                    position: 'relative',
                    fontFamily: theme.typography.button.fontFamily,
                    fontSize: '16px',
                    fontWeight: 600,
                    letterSpacing: 0,
                    textTransform: 'none',
                    whiteSpace: 'nowrap',
                    lineHeight: 1,
                    height: 40,
                    px: 0.75,
                    minWidth: 'auto',
                    borderRadius: 0,
                    color: active ? 'secondary.main' : 'text.primary',
                    // Subrayado del activo como pseudo-elemento: no altera la altura del botón
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      left: 6,
                      right: 6,
                      bottom: 6,
                      height: 2,
                      backgroundColor: 'secondary.main',
                      transform: active ? 'scaleX(1)' : 'scaleX(0)',
                      transformOrigin: 'center',
                      transition: 'transform 0.25s ease',
                    },
                    '&:hover': { color: 'secondary.main', backgroundColor: 'transparent' },
                    '&:hover::after': { transform: 'scaleX(1)' },
                  }}
                >
                  {item.label}
                </Button>
              )
            })}
          </Box>

          {/* Bloque derecho (como en la referencia): redes · filete · botón píldora, pegado al extremo */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, ml: 'auto', gap: 2 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                pr: 2,
                borderRight: '1px solid rgba(204, 196, 201, 0.25)',
                height: 24,
              }}
            >
              {socialLinks.map((social) => (
                <IconButton
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  size="small"
                  sx={{ width: 32, height: 32, p: 0, color: 'text.primary', '&:hover': { color: 'secondary.main' } }}
                >
                  {social.icon}
                </IconButton>
              ))}
            </Box>

            <Button
              component={Link}
              to="/hermanos/acceso"
              variant="contained"
              disableElevation
              sx={{
                backgroundColor: '#6e1822',
                color: '#ffffff',
                px: 3,
                height: 44,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                // Mismo redondeo y estilo que AppButton ("Conoce la Hermandad")
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                '&:hover': { backgroundColor: '#5a131c' },
              }}
            >
              Acceso hermanos
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={toggleDrawer(false)}
        slotProps={{
          paper: {
            sx: {
              width: 288,
              backgroundColor: '#100e11',
              borderRight: '1px solid rgba(204, 196, 201, 0.2)',
            },
          },
        }}
      >
        <Box sx={{ p: 3, borderBottom: '1px solid rgba(204, 196, 201, 0.2)' }}>
          <Box
            component={Link}
            to="/"
            sx={{
              fontFamily: theme.typography.h1.fontFamily,
              fontSize: '22px',
              color: 'text.primary',
              mb: 0.5,
              textDecoration: 'none',
            }}
          >
            DESAMPARADOS DE MÁLAGA
          </Box>
          <Box sx={{ typography: 'overline', color: 'text.secondary', fontSize: '11px' }}>
            Venerable Corporación
          </Box>
        </Box>
        <List sx={{ py: 2 }}>
          {drawerItems.map((item) => {
            const active = isActive(item.href)
            return (
              <ListItem key={item.label} disablePadding>
                <ListItemButton
                  component={Link}
                  to={item.href}
                  selected={active}
                  onClick={toggleDrawer(false)}
                  sx={{
                    px: 3,
                    py: 1.5,
                    color: active ? 'secondary.contrastText' : 'text.secondary',
                    backgroundColor: active ? 'primary.main' : 'transparent',
                    '&:hover': {
                      backgroundColor: active ? 'primary.main' : 'rgba(255,255,255,0.05)',
                    },
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'secondary.contrastText',
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
      </Drawer>
    </>
  )
}
