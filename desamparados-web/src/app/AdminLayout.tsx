import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  Box, Drawer, IconButton, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Toolbar, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import { useAuthStore } from '../features/members/auth/store'
import { cerrarSesion } from '../features/members/auth/session'
import { TemaCmsProvider, useTemaCms } from './temaCms'
import { superficiesCms, type ModoCms } from '../theme/cms'
import { GRUPOS, NOMBRE_CARGO, contadoresDelPanel, itemsMenu } from './cmsNavegacion'
import { usePanelDeHoy } from './usePanelDeHoy'
import { designTokens } from '../theme'

const SIDEBAR = superficiesCms('oscuro').sidebar // #100e11, la misma en los dos modos

function Contador({ seccion, valor, tono }: { seccion: string; valor: number; tono: 'aviso' | 'error' }) {
  // El número dice cuántos y el color cuánta prisa corre, pero el color nunca
  // va solo: el aria-label lo dice con palabras.
  const fondo = tono === 'error' ? designTokens.dataviz.estados.error : designTokens.dataviz.estados.aviso
  return (
    <Box
      component="span"
      aria-label={`${seccion}: ${valor} ${tono === 'error' ? 'urgentes' : 'pendientes'}`}
      sx={{
        minWidth: 22, height: 20, px: 0.75, borderRadius: 10, backgroundColor: fondo,
        color: SIDEBAR, fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {valor}
    </Box>
  )
}

function Navegacion({ role, onNavegar }: { role?: string; onNavegar?: () => void }) {
  const location = useLocation()
  const { data } = usePanelDeHoy()
  const contadores = contadoresDelPanel(data)
  const visibles = itemsMenu.filter((item) => role && item.roles.includes(role))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {GRUPOS.map((grupo) => {
        const items = visibles.filter((item) => item.grupo === grupo)
        if (items.length === 0) return null
        return (
          <Box key={grupo}>
            <Typography
              sx={{
                px: 1.5, pt: 2, pb: 0.75, fontSize: 11, fontWeight: 600,
                letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.36)',
              }}
            >
              {grupo}
            </Typography>
            <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {items.map((item) => {
                const activo = item.href === '/cms'
                  ? location.pathname === '/cms'
                  : location.pathname.startsWith(item.href)
                const Icono = item.icono
                const valor = item.contador ? contadores[item.contador.de] : 0
                return (
                  <ListItem key={item.href} disablePadding>
                    <ListItemButton
                      component={Link}
                      to={item.href}
                      onClick={onNavegar}
                      selected={activo}
                      sx={{
                        borderRadius: 1.5, minHeight: 36, py: 0, px: 1.5, gap: 1.5,
                        color: activo ? '#fff' : 'rgba(255,255,255,0.66)',
                        backgroundColor: activo ? 'primary.main' : 'transparent',
                        '&.Mui-selected:hover': { backgroundColor: 'primary.dark' },
                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 0, color: 'inherit' }}><Icono fontSize="small" /></ListItemIcon>
                      <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: 14 } } }} />
                      {item.contador && valor > 0 && (
                        <Contador seccion={item.label} valor={valor} tono={item.contador.tono} />
                      )}
                    </ListItemButton>
                  </ListItem>
                )
              })}
            </List>
          </Box>
        )
      })}
    </Box>
  )
}

/** Control segmentado de dos opciones: es una elección, no dos botones sueltos. */
function InterruptorTema() {
  const { modo, cambiarModo } = useTemaCms()
  const opciones: { valor: ModoCms; texto: string; Icono: typeof LightModeOutlinedIcon }[] = [
    { valor: 'claro', texto: 'Claro', Icono: LightModeOutlinedIcon },
    { valor: 'oscuro', texto: 'Oscuro', Icono: DarkModeOutlinedIcon },
  ]
  return (
    <Box
      role="radiogroup"
      aria-label="Tema del CMS"
      sx={{ display: 'flex', gap: '2px', p: '3px', mb: 1.75, borderRadius: 1.25, backgroundColor: 'rgba(255,255,255,0.06)' }}
    >
      {opciones.map(({ valor, texto, Icono }) => (
        <Box
          key={valor}
          component="button"
          type="button"
          role="radio"
          aria-checked={modo === valor}
          onClick={() => cambiarModo(valor)}
          sx={{
            flex: 1, height: 30, border: 0, cursor: 'pointer', borderRadius: 1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
            fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
            backgroundColor: modo === valor ? 'rgba(255,255,255,0.14)' : 'transparent',
            color: modo === valor ? '#fff' : 'rgba(255,255,255,0.55)',
          }}
        >
          <Icono sx={{ fontSize: 15 }} />
          {texto}
        </Box>
      ))}
    </Box>
  )
}

function BloqueUsuario({ role }: { role?: string }) {
  const cargo = role ? NOMBRE_CARGO[role] ?? role : ''
  const iniciales = cargo.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  return (
    <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', pt: 1.75, px: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box
        aria-hidden="true"
        sx={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          backgroundColor: designTokens.colors.burgundy, color: '#fff',
          fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {iniciales}
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{cargo}</Typography>
        <Box
          component="button"
          type="button"
          onClick={() => { void cerrarSesion() }}
          sx={{
            border: 0, background: 'none', p: 0, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 12, color: 'rgba(255,255,255,0.45)', '&:hover': { color: '#fff' },
          }}
        >
          Cerrar sesión
        </Box>
      </Box>
    </Box>
  )
}

function Contenido() {
  const role = useAuthStore((state) => state.user?.role)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const tema = useTheme()
  const { superficies } = useTemaCms()
  const esMovil = useMediaQuery(tema.breakpoints.down('md'))

  const barra = (
    <Box sx={{ minHeight: '100%', backgroundColor: SIDEBAR, p: 2, pt: 3.25, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 1.25 }}>
        <Typography
          component={Link}
          to="/cms"
          sx={{ color: '#fff', textDecoration: 'none', fontFamily: designTokens.fonts.heading, fontSize: 19, letterSpacing: '0.04em' }}
        >
          DESAMPARADOS
        </Typography>
        <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.45)', mt: 0.5 }}>
          CMS
        </Typography>
      </Box>
      <Navegacion role={role} onNavegar={() => setMenuAbierto(false)} />
      <Box sx={{ mt: 'auto' }} />
      <InterruptorTema />
      <BloqueUsuario role={role} />
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default', color: 'text.primary' }}>
      {esMovil ? (
        <Drawer open={menuAbierto} onClose={() => setMenuAbierto(false)} sx={{ '& .MuiDrawer-paper': { width: 264, border: 0 } }}>
          {barra}
        </Drawer>
      ) : (
        <Box
          component="aside"
          sx={{
            width: 264,
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            // En un contenedor flex, sin esto el hijo se estira a toda la
            // altura y `sticky` no llega a pegarse a nada.
            alignSelf: 'flex-start',
            height: '100vh',
            overflowY: 'auto',
            // El fondo va aquí, en el elemento que hace scroll, y no solo en
            // `barra`: con el menú más alto que la ventana, `barra` medía
            // 100vh y al bajar asomaba el fondo de la página por debajo.
            backgroundColor: SIDEBAR,
          }}
        >
          {barra}
        </Box>
      )}

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        {esMovil && (
          <Toolbar
            sx={{
              borderBottom: `1px solid ${superficies.filete}`,
              backgroundColor: 'background.paper',
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            <IconButton edge="start" aria-label="Abrir el menú" onClick={() => setMenuAbierto(true)}>
              <MenuIcon />
            </IconButton>
          </Toolbar>
        )}
        <Box sx={{ p: { xs: 2.5, md: 4 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}

export default function AdminLayout() {
  // El proveedor va fuera para que `Contenido` pueda leer el modo con useTemaCms.
  return (
    <TemaCmsProvider>
      <Contenido />
    </TemaCmsProvider>
  )
}
