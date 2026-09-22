import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  Box, Drawer, IconButton, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Toolbar, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import EscudoDelGrupo from '../components/EscudoDelGrupo'
import { useAuthStore } from '../features/altas/auth/store'
import { cerrarSesion } from '../features/altas/auth/session'
import { TemaCmsProvider } from './temaCms'
import { useTemaCms } from './useTemaCms'
import { superficiesCms, type ModoCms } from '../theme/cms'
import { GRUPOS, NOMBRE_CARGO, contadoresDelPanel, itemsMenu } from './cmsNavegacion'
import { usePanelDeHoy } from './usePanelDeHoy'
import { designTokens } from '../theme'

const SIDEBAR = superficiesCms('oscuro').sidebar // #100e11, la misma en los dos modos

/**
 * Densidad del menú, en variables CSS que leen la marca, la navegación y el
 * pie. El menú entero (13 secciones en seis áreas, más el tema y el usuario)
 * mide unos 915px en su versión holgada, así que en cualquier pantalla que no
 * sea muy alta aparecía una barra de scroll dentro del propio menú. En vez de
 * dejarlo desbordar, la barra se aprieta por tramos de altura de ventana: los
 * aires primero y la altura de las secciones después. Los rótulos de área se
 * quedan en todos los tramos, porque son lo que hace legible un menú de trece
 * secciones. Cada tramo está medido para caber en su altura mínima, de modo que
 * un 1366×768 (unos 640px de ventana útil) entra sin scroll.
 */
const densidadDelMenu = {
  '--cms-pad': '16px',
  '--cms-pad-top': '20px',
  '--cms-escudo': '38px',
  '--cms-marca': '19px',
  '--cms-item': '36px',
  '--cms-item-fuente': '14px',
  '--cms-icono': '20px',
  '--cms-area-pt': '10px',
  '--cms-area-pb': '6px',
  '--cms-tema-alto': '30px',
  '--cms-tema-mb': '14px',
  '--cms-pie-pt': '14px',
  '--cms-avatar': '34px',
  '@media (max-height:899px)': {
    '--cms-pad-top': '16px',
    '--cms-escudo': '34px',
    '--cms-item': '32px',
    '--cms-area-pt': '10px',
    '--cms-area-pb': '4px',
    '--cms-tema-mb': '10px',
  },
  '@media (max-height:819px)': {
    '--cms-pad': '14px',
    '--cms-pad-top': '14px',
    '--cms-escudo': '32px',
    '--cms-marca': '18px',
    '--cms-item': '30px',
    '--cms-icono': '19px',
    '--cms-area-pt': '8px',
    '--cms-area-pb': '2px',
    '--cms-tema-alto': '28px',
    '--cms-tema-mb': '8px',
    '--cms-pie-pt': '12px',
    '--cms-avatar': '32px',
  },
  // El tramo de los portátiles de 768px de pantalla, que es donde más aprieta:
  // con la barra del navegador y la de marcadores quedan unos 640px útiles.
  '@media (max-height:759px)': {
    '--cms-pad': '12px',
    '--cms-pad-top': '10px',
    '--cms-escudo': '27px',
    '--cms-marca': '16px',
    '--cms-item': '24px',
    '--cms-item-fuente': '13px',
    '--cms-icono': '18px',
    '--cms-area-pt': '4px',
    '--cms-area-pb': '0px',
    '--cms-tema-alto': '26px',
    '--cms-tema-mb': '6px',
    '--cms-pie-pt': '8px',
    '--cms-avatar': '28px',
  },
  // Último recurso, para ventanas a media altura: aquí ya solo queda quitar
  // aire y bajar un punto la letra.
  '@media (max-height:639px)': {
    '--cms-pad-top': '8px',
    '--cms-escudo': '24px',
    '--cms-marca': '15px',
    '--cms-item': '22px',
    '--cms-item-fuente': '12.5px',
    '--cms-icono': '17px',
    '--cms-area-pt': '3px',
    '--cms-tema-alto': '24px',
    '--cms-tema-mb': '5px',
    '--cms-pie-pt': '7px',
    '--cms-avatar': '26px',
  },
} as const

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
        color: '#fff', fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
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
          <Box
            key={grupo}
            sx={{ pt: 'var(--cms-area-pt)' }}
          >
            <Typography
              sx={{
                px: 1.5, pb: 'var(--cms-area-pb)', fontSize: 11, fontWeight: 600,
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
                        borderRadius: 1.5, minHeight: 'var(--cms-item)', py: 0, px: 1.5, gap: 1.5,
                        '& svg': { fontSize: 'var(--cms-icono)' },
                        // Sin esto el alto de la sección no lo manda `--cms-item`,
                        // sino los 4px de margen que el texto trae de serie.
                        '& .MuiListItemText-root': { my: 0 },
                        color: activo ? '#fff' : 'rgba(255,255,255,0.66)',
                        backgroundColor: activo ? 'primary.main' : 'transparent',
                        '&.Mui-selected:hover': { backgroundColor: 'primary.dark' },
                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 0, color: 'inherit' }}><Icono fontSize="small" /></ListItemIcon>
                      <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: 'var(--cms-item-fuente)', lineHeight: 1.3 } } }} />
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
      sx={{ display: 'flex', gap: '2px', p: '3px', mb: 'var(--cms-tema-mb)', borderRadius: 1.25, backgroundColor: 'rgba(255,255,255,0.06)' }}
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
            flex: 1, height: 'var(--cms-tema-alto)', border: 0, cursor: 'pointer', borderRadius: 1,
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
    <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', pt: 'var(--cms-pie-pt)', px: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box
        aria-hidden="true"
        sx={{
          width: 'var(--cms-avatar)', height: 'var(--cms-avatar)', borderRadius: '50%', flexShrink: 0,
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
          onClick={() => { void cerrarSesion('cms') }}
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
  const role = useAuthStore((state) => state.cms?.role)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const tema = useTheme()
  const { superficies } = useTemaCms()
  const esMovil = useMediaQuery(tema.breakpoints.down('md'))

  const barra = (
    <Box
      sx={{
        ...densidadDelMenu,
        minHeight: '100%',
        backgroundColor: SIDEBAR,
        p: 'var(--cms-pad)',
        pt: 'var(--cms-pad-top)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        component={Link}
        to="/cms"
        sx={{ px: 1.25, display: 'flex', alignItems: 'center', gap: 1.25, textDecoration: 'none' }}
      >
        <EscudoDelGrupo alto="var(--cms-escudo)" />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{ color: '#fff', fontFamily: designTokens.fonts.cms.heading, fontSize: 'var(--cms-marca)', lineHeight: 1.1, letterSpacing: '0.04em' }}
          >
            DESAMPARADOS
          </Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.45)', mt: 0.25 }}>
            CMS
          </Typography>
        </Box>
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
            // Red de seguridad: con la densidad de `densidadDelMenu` el menú
            // cabe entero desde unos 580px de ventana, así que esta barra no
            // llega a aparecer salvo en ventanas menores que eso.
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

export default function MarcoCms() {
  // El proveedor va fuera para que `Contenido` pueda leer el modo con useTemaCms.
  return (
    <TemaCmsProvider>
      <Contenido />
    </TemaCmsProvider>
  )
}
