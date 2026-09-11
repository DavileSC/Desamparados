import { Fragment, useState, useEffect, useRef, type ReactNode, type FocusEvent, type KeyboardEvent } from 'react'
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
  Collapse,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import HomeIcon from '@mui/icons-material/Home'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import NewspaperIcon from '@mui/icons-material/Newspaper'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import GroupIcon from '@mui/icons-material/Group'
import MailIcon from '@mui/icons-material/Mail'
import FacebookIcon from '@mui/icons-material/Facebook'
import CloseIcon from '@mui/icons-material/Close'
import InstagramIcon from '@mui/icons-material/Instagram'
import XIcon from '@mui/icons-material/X'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { site } from '../config/site'
import { menuPublico, type EntradaMenu } from '../config/navegacion'

// Iconos del cajón móvil, por sección. Viven aquí y no en `config/navegacion.ts`
// para que el árbol del menú siga siendo datos puros, sin React.
const iconosPorSeccion: Record<string, ReactNode> = {
  '/': <HomeIcon />,
  '/corporacion': <AccountBalanceIcon />,
  '/sagrada-titular': <Brightness7Icon />,
  '/actualidad': <NewspaperIcon />,
  '/publicaciones': <MenuBookIcon />,
  '/hermanos': <GroupIcon />,
  '/contacto': <MailIcon />,
}

// El menú debe seguir siendo de escritorio en portátiles con escalado de Windows
// (la anchura CSS puede ser bastante menor que la resolución física).
const DESKTOP_NAV_MIN = 1024
const desktopMq = `@media (min-width:${DESKTOP_NAV_MIN}px)`
const compactMq = `@media (max-width:1199px)`
const socialMq = `@media (min-width:1700px)`

// Velo de la barra de escritorio, en opacidad de la tinta #100e11. 0,72 es el
// mínimo: sobre una foto blanca deja el texto blanco en 7,7:1 y el dorado del
// enlace activo justo en 4,5:1 (AA); por debajo, el dorado deja de leerse.
// Al hacer scroll sube a 0,86.
const tinta = (opacidad: number) => `rgba(16, 14, 17, ${opacidad.toFixed(3)})`
const VELO_ARRIBA = 0.72
const VELO_SCROLL = 0.86

const socialLinks = [
  { icon: <InstagramIcon fontSize="small" />, href: site.redes.instagram, label: 'Instagram' },
  { icon: <XIcon fontSize="small" />, href: site.redes.x, label: 'X' },
  { icon: <FacebookIcon fontSize="small" />, href: site.redes.facebook, label: 'Facebook' },
  { icon: <PlayCircleIcon fontSize="small" />, href: site.redes.youtube, label: 'YouTube' },
].flatMap(social => social.href ? [{ ...social, href: social.href }] : [])

function esActiva(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Enlace de una subpágina dentro del desplegable de escritorio. */
function EnlaceDesplegable({ entrada, secundario = false }: { entrada: EntradaMenu; secundario?: boolean }) {
  const theme = useTheme()
  const location = useLocation()
  const activa = esActiva(location.pathname, entrada.href)
  return (
    <Box
      component={Link}
      to={entrada.href}
      sx={{
        display: 'block',
        px: 1.5,
        py: 0.75,
        borderRadius: '6px',
        fontFamily: theme.typography.button.fontFamily,
        fontSize: secundario ? '13px' : '14px',
        fontWeight: secundario ? 500 : 600,
        color: activa ? 'secondary.main' : secundario ? 'text.secondary' : 'text.primary',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        '&:hover, &:focus-visible': { color: 'secondary.main', backgroundColor: 'rgba(255,255,255,0.05)' },
      }}
    >
      {entrada.label}
    </Box>
  )
}

/**
 * Entrada de primer nivel del menú de escritorio. Si tiene subpáginas, despliega
 * un panel al pasar el ratón o al llegar con el teclado; Escape lo cierra y
 * devuelve el foco al enlace de la sección.
 */
function SeccionEscritorio({ entrada }: { entrada: EntradaMenu }) {
  const theme = useTheme()
  const location = useLocation()
  // Se guarda la ruta en la que se abrió: al navegar deja de coincidir y el panel
  // se cierra solo, sin efecto ni `setState` en cascada.
  const [abiertaEn, setAbiertaEn] = useState<string | null>(null)
  const abierta = abiertaEn === location.pathname
  const setAbierta = (valor: boolean) => setAbiertaEn(valor ? location.pathname : null)
  const enlaceRef = useRef<HTMLAnchorElement>(null)
  const hijos = entrada.hijos ?? []
  const desplegable = hijos.length > 0
  const activa = esActiva(location.pathname, entrada.href)

  const vieneDeFuera = (e: FocusEvent<HTMLDivElement>) => !e.currentTarget.contains(e.relatedTarget as Node | null)

  const alPulsarTecla = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape') return
    setAbierta(false)
    enlaceRef.current?.focus()
  }

  return (
    <Box
      sx={{ position: 'relative', flexShrink: 0 }}
      onMouseEnter={desplegable ? () => setAbierta(true) : undefined}
      onMouseLeave={desplegable ? () => setAbierta(false) : undefined}
      onFocus={desplegable ? (e) => { if (vieneDeFuera(e)) setAbierta(true) } : undefined}
      onBlur={desplegable ? (e) => { if (vieneDeFuera(e)) setAbierta(false) } : undefined}
      onKeyDown={desplegable ? alPulsarTecla : undefined}
    >
      <Button
        ref={enlaceRef}
        component={Link}
        to={entrada.href}
        aria-haspopup={desplegable ? 'true' : undefined}
        aria-expanded={desplegable ? abierta : undefined}
        // Chevron solo en las secciones que despliegan; gira al abrirse.
        endIcon={
          desplegable ? (
            <ExpandMoreIcon
              sx={{
                fontSize: '16px !important',
                transition: 'transform 0.2s ease',
                transform: abierta ? 'rotate(180deg)' : 'none',
              }}
            />
          ) : undefined
        }
        sx={{
          position: 'relative',
          fontFamily: theme.typography.button.fontFamily,
          fontSize: '15px',
          fontWeight: 600,
          letterSpacing: 0,
          textTransform: 'none',
          whiteSpace: 'nowrap',
          lineHeight: 1,
          height: 40,
          px: 0.75,
          minWidth: 'auto',
          borderRadius: 0,
          color: activa ? 'secondary.main' : 'text.primary',
          '& .MuiButton-endIcon': { ml: 0.25, mr: -0.25 },
          // Subrayado del activo como pseudo-elemento: no altera la altura del botón
          '&::after': {
            content: '""',
            position: 'absolute',
            left: 6,
            right: 6,
            bottom: 6,
            height: 2,
            backgroundColor: 'secondary.main',
            transform: activa || abierta ? 'scaleX(1)' : 'scaleX(0)',
            transformOrigin: 'center',
            transition: 'transform 0.25s ease',
          },
          '&:hover': { color: 'secondary.main', backgroundColor: 'transparent' },
          '&:hover::after': { transform: 'scaleX(1)' },
          [compactMq]: { fontSize: '13px', px: 0.35, '&::after': { left: 3, right: 3 } },
        }}
      >
        {entrada.label}
      </Button>

      {desplegable && abierta && (
        // El relleno superior cubre el hueco entre el enlace y el panel: así el
        // ratón puede bajar hasta las subpáginas sin que el desplegable se cierre.
        <Box sx={{ position: 'absolute', top: '100%', left: 0, pt: '16px', zIndex: 1 }}>
          <Box
            component="ul"
            sx={{
              listStyle: 'none',
              m: 0,
              p: 1,
              minWidth: 260,
              borderRadius: '10px',
              backgroundColor: tinta(0.97),
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.55)',
            }}
          >
            {hijos.map((hijo) => (
              <Box component="li" key={hijo.href}>
                <EnlaceDesplegable entrada={hijo} />
                {hijo.hijos && hijo.hijos.length > 0 && (
                  <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, pl: 2 }}>
                    {hijo.hijos.map((nieto) => (
                      <Box component="li" key={nieto.href}>
                        <EnlaceDesplegable entrada={nieto} secundario />
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  )
}

/** Subpágina dentro del cajón móvil; `nivel` 1 son hijas de la sección y 2 sus nietas. */
function EnlaceCajon({ entrada, nivel, alNavegar }: { entrada: EntradaMenu; nivel: 1 | 2; alNavegar: () => void }) {
  const theme = useTheme()
  const location = useLocation()
  const activa = esActiva(location.pathname, entrada.href)
  return (
    <ListItemButton
      component={Link}
      to={entrada.href}
      onClick={alNavegar}
      sx={{
        pl: nivel === 1 ? 7 : 9,
        py: 1,
        color: activa ? 'secondary.main' : 'text.secondary',
        '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' },
      }}
    >
      <ListItemText
        primary={entrada.label}
        slotProps={{
          primary: {
            sx: {
              fontFamily: theme.typography.button.fontFamily,
              fontSize: nivel === 1 ? '13px' : '12px',
              fontWeight: nivel === 1 ? 600 : 500,
              letterSpacing: '0.03em',
            },
          },
        }}
      />
    </ListItemButton>
  )
}

export default function Navbar() {
  const theme = useTheme()
  const isMobile = useMediaQuery(`(max-width:${DESKTOP_NAV_MIN - 1}px)`)
  const location = useLocation()
  const [scrollProgress, setScrollProgress] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Record<string, boolean>>({})

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

  const isActive = (href: string) => esActiva(location.pathname, href)
  const velo = VELO_ARRIBA + (VELO_SCROLL - VELO_ARRIBA) * scrollProgress

  // El cajón se abre con la sección de la página actual ya desplegada.
  const abrirCajon = () => {
    const seccionActual = menuPublico.find((entrada) => entrada.href !== '/' && isActive(entrada.href))
    setSeccionesAbiertas(seccionActual ? { [seccionActual.href]: true } : {})
    setDrawerOpen(true)
  }
  const cerrarCajon = () => setDrawerOpen(false)
  const alternarSeccion = (href: string) => setSeccionesAbiertas((prev) => ({ ...prev, [href]: !prev[href] }))

  return (
    <>
      {isMobile && (
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            backgroundColor: tinta(VELO_SCROLL),
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
              aria-label="Abrir menú"
              aria-expanded={drawerOpen}
              onClick={abrirCajon}
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
          // Banda de tinta casi opaca desde el primer píxel y con corte limpio: las
          // fotos del hero las cambia el cliente y no se puede contar con que sean
          // oscuras, y al bajar la barra pasa por encima de tarjetas de papel.
          backgroundColor: tinta(velo),
          backgroundImage: 'none',
          backdropFilter: `blur(${10 + scrollProgress * 14}px) saturate(${110 + scrollProgress * 40}%)`,
          WebkitBackdropFilter: `blur(${10 + scrollProgress * 14}px) saturate(${110 + scrollProgress * 40}%)`,
          borderBottom: 'none',
          boxShadow: 'none',
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
            gap: { xs: 2, xl: 4 }, // separación logo → menú, reservando espacio para las acciones
            // Barra a todo el ancho: logo y menú pegados a la izquierda, acciones a la derecha
            width: '100%',
            minHeight: '72px !important',
            px: { xs: '40px', xl: '48px' },
            [compactMq]: { gap: 1.5, px: '24px' },
          }}
        >
          <Box
            component={Link}
            to="/"
            sx={{
              fontFamily: theme.typography.h1.fontFamily,
              fontSize: '26px',
              lineHeight: 1,
              color: 'text.primary',
              textDecoration: 'none',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              [compactMq]: { fontSize: '23px' },
            }}
          >
            DESAMPARADOS
          </Box>

          {/* Todo en una sola línea, centrado verticalmente: enlaces, botón e iconos comparten
              la misma altura (40px) para que queden alineados entre sí y con el logo.
              Sin `overflow: hidden`: los desplegables cuelgan por debajo de la barra. */}
          <Box
            component="nav"
            aria-label="Navegación principal"
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'nowrap',
              gap: { xs: 1, xl: 1.5 },
              minWidth: 0,
              flexShrink: 1,
              [compactMq]: { gap: 0.5 },
            }}
          >
            {menuPublico.map((entrada) => (
              <SeccionEscritorio key={entrada.href} entrada={entrada} />
            ))}
          </Box>

          {/* Bloque derecho (como en la referencia): redes · filete · botón píldora, pegado al extremo */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, ml: 'auto', gap: 2, [compactMq]: { gap: 1 } }}>
            <Box
              sx={{
                display: 'none',
                alignItems: 'center',
                gap: 0.5,
                pr: 2,
                borderRight: '1px solid rgba(204, 196, 201, 0.25)',
                height: 24,
                [socialMq]: { display: socialLinks.length ? 'flex' : 'none' },
                [compactMq]: { display: 'none' },
              }}
            >
              {socialLinks.map((social) => (
                <IconButton
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
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
                // Mismo redondeo y estilo que AppButton ("Conoce el Grupo Parroquial")
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                [compactMq]: { px: 1.5, fontSize: '12px' },
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
        onClose={cerrarCajon}
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
          <IconButton aria-label="Cerrar menú" onClick={cerrarCajon} sx={{ display: 'flex', ml: 'auto', mb: 2, color: 'text.primary' }}><CloseIcon /></IconButton>
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
            Grupo Parroquial
          </Box>
        </Box>
        <List sx={{ py: 2 }}>
          {menuPublico.map((entrada) => {
            const active = isActive(entrada.href)
            const hijos = entrada.hijos ?? []
            const abierta = Boolean(seccionesAbiertas[entrada.href])
            return (
              <Fragment key={entrada.href}>
                <ListItem
                  disablePadding
                  secondaryAction={
                    hijos.length > 0 ? (
                      <IconButton
                        edge="end"
                        aria-label={`${abierta ? 'Plegar' : 'Desplegar'} ${entrada.label}`}
                        aria-expanded={abierta}
                        onClick={() => alternarSeccion(entrada.href)}
                        sx={{ color: active ? 'secondary.contrastText' : 'text.secondary' }}
                      >
                        {abierta ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    ) : undefined
                  }
                >
                  <ListItemButton
                    component={Link}
                    to={entrada.href}
                    selected={active}
                    onClick={cerrarCajon}
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
                    <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>{iconosPorSeccion[entrada.href]}</Box>
                    <ListItemText
                      primary={entrada.label}
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
                {hijos.length > 0 && (
                  <Collapse in={abierta} unmountOnExit>
                    <List disablePadding sx={{ pb: 1 }}>
                      {hijos.map((hijo) => (
                        <Fragment key={hijo.href}>
                          <EnlaceCajon entrada={hijo} nivel={1} alNavegar={cerrarCajon} />
                          {hijo.hijos?.map((nieto) => (
                            <EnlaceCajon key={nieto.href} entrada={nieto} nivel={2} alNavegar={cerrarCajon} />
                          ))}
                        </Fragment>
                      ))}
                    </List>
                  </Collapse>
                )}
              </Fragment>
            )
          })}
        </List>
      </Drawer>
    </>
  )
}
