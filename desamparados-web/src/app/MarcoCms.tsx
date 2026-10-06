import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  Box, ButtonBase, Collapse, Divider, Drawer, IconButton, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Menu, MenuItem, Switch, Toolbar, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined'
import EscudoDelGrupo from '../components/EscudoDelGrupo'
import { useAuthStore } from '../features/altas/auth/store'
import { cerrarSesion } from '../features/altas/auth/session'
import { TemaCmsProvider } from './temaCms'
import { useModoCms, useTemaCms } from './useTemaCms'
import { superficiesCms } from '../theme/cms'
import { GRUPOS, NOMBRE_CARGO, contadoresDelPanel, itemsMenu, menuCmsVisible, type Grupo, type ItemMenu } from './cmsNavegacion'
import { usePanelDeHoy } from './usePanelDeHoy'
import { useModulos } from '../hooks/useModulos'
import { designTokens } from '../theme'
import { site } from '../config/site'

const SIDEBAR = superficiesCms('oscuro').sidebar // #070608, la misma en los dos modos

/**
 * Densidad del menú, en variables CSS que leen la marca, la navegación y el
 * pie. Solo va abierto un grupo, así que lo que tiene que caber es el Inicio,
 * los cinco rótulos y el grupo más largo (Censo y procesión, nueve secciones).
 * En vez de dejarlo desbordar, la barra se aprieta por tramos de altura de
 * ventana: los aires primero y la altura de las secciones después, sin bajar
 * la letra de 14px. Cada tramo está medido para caber en su altura mínima, de
 * modo que un portátil escalado al 150 % (unos 550px útiles) entra sin scroll.
 */
const densidadDelMenu = {
  '--cms-pad': '16px',
  '--cms-pad-top': '20px',
  '--cms-escudo': '38px',
  '--cms-marca': '17px',
  '--cms-item': '40px',
  '--cms-item-fuente': '15px',
  '--cms-icono': '21px',
  '--cms-rotulo': '12.5px',
  '--cms-area-pt': '12px',
  '--cms-area-pb': '6px',
  '--cms-pie-pt': '14px',
  '--cms-avatar': '34px',
  '@media (max-height:899px)': {
    '--cms-pad-top': '16px',
    '--cms-escudo': '34px',
    '--cms-item': '36px',
    '--cms-area-pt': '10px',
    '--cms-area-pb': '4px',
  },
  '@media (max-height:819px)': {
    '--cms-pad': '14px',
    '--cms-pad-top': '14px',
    '--cms-escudo': '32px',
    '--cms-item': '32px',
    '--cms-icono': '20px',
    '--cms-area-pt': '8px',
    '--cms-area-pb': '2px',
    '--cms-pie-pt': '12px',
    '--cms-avatar': '32px',
  },
  // El tramo de los portátiles de 768px de pantalla: con la barra del
  // navegador y la de marcadores quedan unos 640px útiles.
  '@media (max-height:759px)': {
    '--cms-pad': '12px',
    '--cms-pad-top': '10px',
    '--cms-escudo': '28px',
    '--cms-marca': '16px',
    '--cms-item': '30px',
    '--cms-item-fuente': '14.5px',
    '--cms-icono': '19px',
    '--cms-rotulo': '12px',
    '--cms-area-pt': '6px',
    '--cms-area-pb': '2px',
    '--cms-pie-pt': '8px',
    '--cms-avatar': '30px',
  },
  // Un portátil escalado al 150 % (unos 550px útiles). Con un solo grupo
  // abierto, el más largo (Censo y procesión, nueve secciones) cabe sin
  // bajar la letra de 14px: antes, con todos abiertos, se llegaba a 12,5px.
  '@media (max-height:639px)': {
    '--cms-pad-top': '8px',
    '--cms-escudo': '26px',
    '--cms-marca': '15px',
    '--cms-item': '28px',
    '--cms-item-fuente': '14px',
    '--cms-icono': '18px',
    '--cms-area-pt': '4px',
    '--cms-pie-pt': '7px',
    '--cms-avatar': '28px',
  },
} as const

/**
 * En el móvil el menú es un cajón que hace scroll, así que no hay que
 * apretarlo por altura: con los tramos de arriba, un móvil de 733px caía en el
 * de los portátiles, con secciones de 30px. Aquí manda el dedo: 48px por
 * sección y 44px por rótulo de grupo.
 */
const densidadTactil = {
  '--cms-pad': '16px',
  '--cms-pad-top': '20px',
  '--cms-escudo': '38px',
  '--cms-marca': '18px',
  '--cms-item': '48px',
  '--cms-item-fuente': '16px',
  '--cms-icono': '22px',
  '--cms-rotulo': '13px',
  '--cms-grupo': '44px',
  '--cms-area-pt': '12px',
  '--cms-area-pb': '2px',
  '--cms-pie-pt': '14px',
  '--cms-avatar': '36px',
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

/**
 * El grupo abierto, recordado en cada ordenador. Solo uno a la vez: con varios
 * abiertos el menú no cabía y había que encoger la letra para meterlo.
 */
const CLAVE_GRUPO = 'cms-menu-grupo'

function leerGrupo(): Grupo | null {
  try {
    const guardado = window.localStorage.getItem(CLAVE_GRUPO)
    return GRUPOS.find((g) => g === guardado) ?? null
  } catch {
    return null
  }
}

function guardarGrupo(grupo: Grupo | null) {
  try {
    if (grupo) window.localStorage.setItem(CLAVE_GRUPO, grupo)
    else window.localStorage.removeItem(CLAVE_GRUPO)
  } catch { /* sin almacenamiento, se olvida al recargar */ }
}

/** La entrada que más se ajusta a la dirección: en /cms/procesion/mesa, «Mesa» y no también «Procesión». */
function entradaActiva(pathname: string, entradas: ItemMenu[]): string | null {
  if (pathname === '/cms') return '/cms'
  return entradas
    .filter((item) => item.href !== '/cms' && (pathname === item.href || pathname.startsWith(`${item.href}/`)))
    .reduce<string | null>((mejor, item) => (!mejor || item.href.length > mejor.length ? item.href : mejor), null)
}

const rotulo = {
  fontSize: 'var(--cms-rotulo)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)',
} as const

function Seccion({ item, activo, valor, onNavegar }: { item: ItemMenu; activo: boolean; valor: number; onNavegar?: () => void }) {
  const Icono = item.icono
  return (
    <ListItem disablePadding>
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
}

function Navegacion({ role, onNavegar }: { role?: string; onNavegar?: () => void }) {
  const location = useLocation()
  const { data } = usePanelDeHoy()
  const contadores = contadoresDelPanel(data)
  const { activos } = useModulos()
  // Sin la lista de módulos no se pinta ningún menú: aparecería y cambiaría.
  const visibles = activos ? menuCmsVisible(itemsMenu, role, activos).filter((item) => item.grupo !== 'cuenta') : []
  const hrefActivo = entradaActiva(location.pathname, visibles)
  const grupoActivo = visibles.find((item) => item.href === hrefActivo)?.grupo
  // Al entrar en una página, su grupo se abre (y se cierra el que estuviera
  // abierto); luego se puede plegar como cualquier otro. Antes el grupo de la
  // página iba abierto a la fuerza, sin flecha, y parecía un grupo roto.
  const plegableActivo = GRUPOS.find((g) => g === grupoActivo)
  const [abierto, setAbierto] = useState<Grupo | null>(() => plegableActivo ?? leerGrupo())
  const [grupoVisto, setGrupoVisto] = useState(plegableActivo)
  if (plegableActivo !== grupoVisto) {
    setGrupoVisto(plegableActivo)
    if (plegableActivo) setAbierto(plegableActivo)
  }
  // Con un solo grupo (Redes, por ejemplo) no hay nada que plegar.
  const plegable = GRUPOS.filter((g) => visibles.some((item) => item.grupo === g)).length > 1
  const valorDe = (item: ItemMenu) => (item.contador ? contadores[item.contador.de] : 0)

  const alternar = (grupo: Grupo) => {
    const siguiente = abierto === grupo ? null : grupo
    setAbierto(siguiente)
    guardarGrupo(siguiente)
  }

  const lista = (items: ItemMenu[]) => (
    <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {items.map((item) => (
        <Seccion key={item.href} item={item} activo={item.href === hrefActivo} valor={valorDe(item)} onNavegar={onNavegar} />
      ))}
    </List>
  )

  return (
    <Box component="nav" aria-label="Secciones del CMS" sx={{ display: 'flex', flexDirection: 'column', pt: 'var(--cms-area-pt)' }}>
      {lista(visibles.filter((item) => item.grupo === 'suelta'))}
      {GRUPOS.map((grupo) => {
        const items = visibles.filter((item) => item.grupo === grupo)
        if (items.length === 0) return null
        if (!plegable) {
          return (
            <Box key={grupo} sx={{ pt: 'var(--cms-area-pt)' }}>
              <Typography sx={{ ...rotulo, px: 1.5, pb: 'var(--cms-area-pb)' }}>{grupo}</Typography>
              {lista(items)}
            </Box>
          )
        }
        // Plegado con la página abierta dentro, el rótulo se queda encendido.
        const esElActivo = grupo === grupoActivo
        const estaAbierto = abierto === grupo
        // Plegado, el grupo no esconde lo que pide atención: suma los avisos de sus secciones.
        const conAviso = items.filter((item) => item.contador && valorDe(item) > 0)
        const avisos = conAviso.reduce((total, item) => total + valorDe(item), 0)
        const tono = conAviso.some((item) => item.contador?.tono === 'error') ? 'error' : 'aviso'
        const idLista = `cms-grupo-${grupo.replace(/\s+/g, '-').toLowerCase()}`
        return (
          <Box key={grupo} sx={{ pt: 'var(--cms-area-pt)' }}>
            <ButtonBase
              onClick={() => alternar(grupo)}
              aria-expanded={estaAbierto}
              aria-controls={idLista}
              sx={{
                ...rotulo, width: '100%', minHeight: 'var(--cms-grupo, auto)', justifyContent: 'flex-start', gap: 0.75,
                px: 1.5, pb: 'var(--cms-area-pb)', pt: '4px', borderRadius: 1, fontFamily: 'inherit',
                ...((estaAbierto || esElActivo) && { color: 'rgba(255,255,255,0.85)' }),
                '&:hover': { color: '#fff' },
              }}
            >
              <Box component="span" sx={{ flexGrow: 1, textAlign: 'left' }}>{grupo}</Box>
              {!estaAbierto && (avisos > 0
                ? <Contador seccion={grupo} valor={avisos} tono={tono} />
                : <Box component="span" aria-hidden="true" sx={{ letterSpacing: 0, fontVariantNumeric: 'tabular-nums' }}>{items.length}</Box>)}
              <ExpandMoreRoundedIcon
                aria-hidden="true"
                sx={{ fontSize: 18, transition: 'transform 150ms', transform: estaAbierto ? 'none' : 'rotate(-90deg)' }}
              />
            </ButtonBase>
            <Collapse in={estaAbierto} id={idLista}>
              {lista(items)}
            </Collapse>
          </Box>
        )
      })}
    </Box>
  )
}

/**
 * El modo oscuro, en el desplegable de la cuenta, entre «Mi seguridad» y
 * «Cerrar sesión»: es lo de cada uno, no del Grupo. Toda la fila cambia el
 * modo y el menú se queda abierto para ver el cambio. El interruptor es solo
 * la muestra, con el sol a un lado y la luna al otro.
 */
function OpcionModoOscuro() {
  const { cambiarModo } = useTemaCms()
  const oscuro = useModoCms() === 'oscuro'
  const pomo = (Icono: typeof LightModeRoundedIcon, color: string) => (
    <Box
      component="span"
      sx={{
        width: 16, height: 16, borderRadius: '50%', backgroundColor: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
      }}
    >
      <Icono sx={{ fontSize: 12, color }} />
    </Box>
  )
  return (
    <MenuItem role="menuitemcheckbox" aria-checked={oscuro} onClick={() => cambiarModo(oscuro ? 'claro' : 'oscuro')}>
      <ListItemIcon><DarkModeOutlinedIcon fontSize="small" /></ListItemIcon>
      <Box component="span" sx={{ flexGrow: 1, pr: 2 }}>Modo oscuro</Box>
      <Switch
        checked={oscuro}
        icon={pomo(LightModeRoundedIcon, '#c98500')}
        checkedIcon={pomo(DarkModeRoundedIcon, designTokens.colors.burgundy)}
        disableRipple
        tabIndex={-1}
        slotProps={{ input: { 'aria-hidden': true, tabIndex: -1 } }}
        sx={{
          width: 36, height: 20, p: 0, flexShrink: 0, borderRadius: 10, pointerEvents: 'none',
          '& .MuiSwitch-switchBase': { p: '2px', '&.Mui-checked': { transform: 'translateX(16px)' } },
          '& .MuiSwitch-track': { borderRadius: 10, backgroundColor: 'text.disabled', opacity: 1 },
          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#a03d44', opacity: 1 },
        }}
      />
    </MenuItem>
  )
}

/**
 * El usuario, abajo: su cargo y, al pulsarlo, lo que es suyo y no del Grupo
 * (su seguridad y el modo oscuro) y la salida.
 */
function BloqueUsuario({ role, onNavegar }: { role?: string; onNavegar?: () => void }) {
  const [ancla, setAncla] = useState<HTMLElement | null>(null)
  const location = useLocation()
  const { activos } = useModulos()
  const cargo = role ? NOMBRE_CARGO[role] ?? role : ''
  const iniciales = cargo.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  const deLaCuenta = activos ? menuCmsVisible(itemsMenu, role, activos).filter((item) => item.grupo === 'cuenta') : []
  const cerrar = () => setAncla(null)
  return (
    <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', pt: 'var(--cms-pie-pt)' }}>
      <ButtonBase
        onClick={(e) => setAncla(e.currentTarget)}
        aria-haspopup="menu"
        aria-expanded={Boolean(ancla)}
        aria-label={`Cuenta: ${cargo}`}
        sx={{
          width: '100%', px: 1, py: 0.5, borderRadius: 1.5, gap: 1.5, justifyContent: 'flex-start', fontFamily: 'inherit',
          '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
        }}
      >
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
        <Typography component="span" sx={{ flexGrow: 1, minWidth: 0, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 600, color: '#fff' }}>{cargo}</Typography>
        <ExpandMoreRoundedIcon aria-hidden="true" sx={{ fontSize: 18, color: 'rgba(255,255,255,0.45)', transform: ancla ? 'rotate(180deg)' : 'none' }} />
      </ButtonBase>
      <Menu
        anchorEl={ancla}
        open={Boolean(ancla)}
        onClose={cerrar}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { minWidth: 220, mt: -1 } } }}
      >
        {deLaCuenta.map((item) => {
          const Icono = item.icono
          return (
            <MenuItem
              key={item.href}
              component={Link}
              to={item.href}
              selected={location.pathname === item.href}
              onClick={() => { cerrar(); onNavegar?.() }}
            >
              <ListItemIcon><Icono fontSize="small" /></ListItemIcon>
              {item.label}
            </MenuItem>
          )
        })}
        <OpcionModoOscuro />
        <Divider />
        <MenuItem onClick={() => { cerrar(); void cerrarSesion('cms') }}>
          <ListItemIcon><LogoutOutlinedIcon fontSize="small" /></ListItemIcon>
          Cerrar sesión
        </MenuItem>
      </Menu>
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
        ...(esMovil ? densidadTactil : densidadDelMenu),
        minHeight: '100%',
        backgroundColor: SIDEBAR,
        p: 'var(--cms-pad)',
        pt: 'var(--cms-pad-top)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* La marca. */}
      <Box
        component={Link}
        to="/cms"
        sx={{ pl: 0.5, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none' }}
      >
        <EscudoDelGrupo alto="var(--cms-escudo)" />
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{ color: '#fff', fontFamily: designTokens.fonts.cms.heading, fontSize: 'var(--cms-marca)', lineHeight: 1.1, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}
          >
            {site.nombreCorto.toUpperCase()}
          </Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.45)', mt: 0.25 }}>
            CMS
          </Typography>
        </Box>
      </Box>
      <Navegacion role={role} onNavegar={() => setMenuAbierto(false)} />
      <Box sx={{ mt: 'auto', pt: 1.5 }} />
      <BloqueUsuario role={role} onNavegar={() => setMenuAbierto(false)} />
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default', color: 'text.primary' }}>
      {esMovil ? (
        <Drawer open={menuAbierto} onClose={() => setMenuAbierto(false)} sx={{ '& .MuiDrawer-paper': { width: 'min(300px, 86vw)', border: 0 } }}>
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
            // Por encima de lo que se queda fijo al bajar (el retablo del Inicio).
            zIndex: 2,
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
