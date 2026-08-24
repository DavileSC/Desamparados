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
  Divider,
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
  twoLines?: boolean
}

const navItems: NavItem[] = [
  { label: 'Inicio', href: '/' },
  { label: 'Corporación', href: '/corporacion' },
  { label: 'Sagrada Titular', href: '/sagrada-titular', twoLines: true },
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
  { icon: <FacebookIcon />, href: '#', label: 'Facebook' },
  { icon: <CloseIcon />, href: '#', label: 'X' },
  { icon: <PlayCircleIcon />, href: '#', label: 'YouTube' },
]

export default function Navbar() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
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
            display: { md: 'none' },
          }}
        >
          <Toolbar sx={{ justifyContent: 'space-between', px: '20px !important' }}>
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
          backdropFilter: `blur(${2 + scrollProgress * 12}px) saturate(${100 + scrollProgress * 60}%)`,
          borderBottom: 'none',
          boxShadow: 'none',
          transition: 'background-color 0.35s ease, backdrop-filter 0.35s ease',
          display: { xs: 'none', md: 'flex' },
        }}
      >
        <Toolbar
          sx={{
            position: 'relative',
            zIndex: 2,
            justifyContent: 'space-between',
            maxWidth: '1280px',
            width: '100%',
            mx: 'auto',
            px: '64px !important',
            py: 2,
          }}
        >
          <Box
            component={Link}
            to="/"
            sx={{
              fontFamily: theme.typography.h1.fontFamily,
              fontSize: '28px',
              color: 'text.primary',
              textDecoration: 'none',
              flexShrink: 0,
              pr: 6,
            }}
          >
            DESAMPARADOS
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, justifyContent: 'flex-end' }}>
            {navItems.map((item) => {
              const active = isActive(item.href)
              return (
                <Button
                  key={item.label}
                  component={Link}
                  to={item.href}
                  sx={{
                    fontFamily: theme.typography.button.fontFamily,
                    fontSize: '14px',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    color: active ? 'primary.main' : 'text.primary',
                    borderBottom: active ? '2px solid' : 'none',
                    borderColor: 'primary.main',
                    borderRadius: 0,
                    pb: 0.5,
                    minWidth: 'auto',
                    lineHeight: item.twoLines ? 1.2 : 1,
                    display: 'flex',
                    flexDirection: item.twoLines ? 'column' : 'row',
                    '&:hover': { color: 'primary.main', backgroundColor: 'transparent' },
                  }}
                >
                  {item.twoLines ? (
                    <>
                      <span>Sagrada</span>
                      <span>Titular</span>
                    </>
                  ) : (
                    item.label
                  )}
                </Button>
              )
            })}

            <Button
              component={Link}
              to="/hermanos/acceso"
              variant="contained"
              sx={{
                backgroundColor: '#6e1822',
                color: '#ffffff',
                ml: 1,
                px: 3,
                py: 1,
                borderRadius: '8px',
                '&:hover': { backgroundColor: '#5a131c', opacity: 0.9 },
              }}
            >
              Hermanos
            </Button>

            <Divider
              orientation="vertical"
              flexItem
              sx={{ borderColor: 'rgba(204, 196, 201, 0.2)', ml: 2 }}
            />

            <Box sx={{ display: 'flex', gap: 1.5, ml: 1 }}>
              {socialLinks.map((social) => (
                <IconButton
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  sx={{ color: 'text.primary', '&:hover': { color: 'primary.main' } }}
                >
                  {social.icon}
                </IconButton>
              ))}
            </Box>
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
