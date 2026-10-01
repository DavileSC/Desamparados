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
import { GRUPOS, NOMBRE_CARGO, contadoresDelPanel, itemsMenu, type Grupo, type ItemMenu } from './cmsNavegacion'
import { usePanelDeHoy } from './usePanelDeHoy'
import { designTokens } from '../theme'
import { site } from '../config/site'

const SIDEBAR = superficiesCms('oscuro').sidebar // #070608, la misma en los dos modos

/**
 * Densidad del menú, en variables CSS que leen la marca, la navegación y el
 * pie. Abierto entero (catorce secciones en cuatro grupos, más el usuario),
 * el menú de Administración mide unos 800px en su versión holgada, así que en cualquier pantalla que no
 * sea muy alta aparecía una barra de scroll dentro del propio menú. En vez de
 * dejarlo desbordar, la barra se aprieta por tramos de altura de ventana: los
 * aires primero y la altura de las secciones después. Los rótulos de grupo se
 * quedan en todos los tramos, porque son lo que hace legible un menú de
 * catorce secciones. Cada tramo está medido para caber en su altura mínima, de modo que
 * un 1366×768 (unos 640px de ventana útil) entra sin scroll.
 */
const densidadDelMenu = {
  '--cms-pad': '16px',
  '--cms-pad-top': '20px',
  '--cms-escudo': '38px',
  '--cms-marca': '17px',
  '--cms-item': '36px',
  '--cms-item-fuente': '14px',
  '--cms-icono': '20px',
  '--cms-area-pt': '10px',
  '--cms-area-pb': '6px',
  '--cms-pie-pt': '14px',
  '--cms-avatar': '34px',
  '@media (max-height:899px)': {
    '--cms-pad-top': '16px',
    '--cms-escudo': '34px',
    '--cms-item': '32px',
    '--cms-area-pt': '10px',
    '--cms-area-pb': '4px',
  },
  '@media (max-height:819px)': {
    '--cms-pad': '14px',
    '--cms-pad-top': '14px',
    '--cms-escudo': '32px',
    '--cms-marca': '17px',
    '--cms-item': '30px',
    '--cms-icono': '19px',
    '--cms-area-pt': '8px',
    '--cms-area-pb': '2px',
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

/** Grupos abiertos o cerrados a mano, recordados en cada ordenador. */
const CLAVE_GRUPOS = 'cms-menu-grupos'

/**
 * Hasta este número de secciones el menú va abierto entero: plegar solo estorba.
 * Secretaría, con el boletín, los cabildos, la tienda, el cortejo en directo,
 * la puerta del templo, las cartas, la lotería y las salidas, llega a catorce
 * contando el Inicio; Administración y el Hermano Mayor pasan de dieciocho, que es para
 * quien está pensado plegar.
 */
const SECCIONES_SIN_PLEGAR = 14

function leerGrupos(): Partial<Record<Grupo, boolean>> {
  try {
    const guardado = window.localStorage.getItem(CLAVE_GRUPOS)
    return guardado ? JSON.parse(guardado) as Partial<Record<Grupo, boolean>> : {}
  } catch {
    return {}
  }
}

function guardarGrupos(abiertos: Partial<Record<Grupo, boolean>>) {
  try { window.localStorage.setItem(CLAVE_GRUPOS, JSON.stringify(abiertos)) } catch { /* sin almacenamiento, se olvida al recargar */ }
}

/** La entrada que más se ajusta a la dirección: en /cms/procesion/mesa, «Mesa» y no también «Procesión». */
function entradaActiva(pathname: string, entradas: ItemMenu[]): string | null {
  if (pathname === '/cms') return '/cms'
  return entradas
    .filter((item) => item.href !== '/cms' && (pathname === item.href || pathname.startsWith(`${item.href}/`)))
    .reduce<string | null>((mejor, item) => (!mejor || item.href.length > mejor.length ? item.href : mejor), null)
}

const rotulo = {
  fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.36)',
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
  const visibles = itemsMenu.filter((item) => role && item.roles.includes(role) && item.grupo !== 'cuenta')
  const hrefActivo = entradaActiva(location.pathname, visibles)
  const grupoActivo = visibles.find((item) => item.href === hrefActivo)?.grupo
  // Al entrar en una página, su grupo se abre; luego se puede plegar como
  // cualquier otro. Antes el grupo de la página iba abierto a la fuerza, sin
  // flecha y sin poder plegarse, y parecía un grupo roto.
  const plegableActivo = GRUPOS.find((g) => g === grupoActivo)
  const [abiertos, setAbiertos] = useState<Partial<Record<Grupo, boolean>>>(() => ({ ...leerGrupos(), ...(plegableActivo && { [plegableActivo]: true }) }))
  const [grupoVisto, setGrupoVisto] = useState(plegableActivo)
  if (plegableActivo !== grupoVisto) {
    setGrupoVisto(plegableActivo)
    if (plegableActivo && !abiertos[plegableActivo]) setAbiertos({ ...abiertos, [plegableActivo]: true })
  }
  // Quien ve pocas secciones las ve todas; plegar es para Administración y el Hermano Mayor.
  const plegable = visibles.length > SECCIONES_SIN_PLEGAR
  const valorDe = (item: ItemMenu) => (item.contador ? contadores[item.contador.de] : 0)

  const alternar = (grupo: Grupo) => {
    const siguiente = { ...abiertos, [grupo]: !abiertos[grupo] }
    setAbiertos(siguiente)
    guardarGrupos(siguiente)
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
        const abierto = abiertos[grupo] === true
        // Plegado, el grupo no esconde lo que pide atención: suma los avisos de sus secciones.
        const conAviso = items.filter((item) => item.contador && valorDe(item) > 0)
        const avisos = conAviso.reduce((total, item) => total + valorDe(item), 0)
        const tono = conAviso.some((item) => item.contador?.tono === 'error') ? 'error' : 'aviso'
        const idLista = `cms-grupo-${grupo.replace(/\s+/g, '-').toLowerCase()}`
        return (
          <Box key={grupo} sx={{ pt: 'var(--cms-area-pt)' }}>
            <ButtonBase
              onClick={() => alternar(grupo)}
              aria-expanded={abierto}
              aria-controls={idLista}
              sx={{
                ...rotulo, width: '100%', justifyContent: 'flex-start', gap: 0.75,
                px: 1.5, pb: 'var(--cms-area-pb)', pt: '2px', borderRadius: 1, fontFamily: 'inherit',
                ...(esElActivo && !abierto && { color: 'rgba(255,255,255,0.78)' }),
                '&:hover': { color: 'rgba(255,255,255,0.7)' },
              }}
            >
              <Box component="span" sx={{ flexGrow: 1, textAlign: 'left' }}>{grupo}</Box>
              {!abierto && (avisos > 0
                ? <Contador seccion={grupo} valor={avisos} tono={tono} />
                : <Box component="span" aria-hidden="true" sx={{ letterSpacing: 0, fontVariantNumeric: 'tabular-nums' }}>{items.length}</Box>)}
              <ExpandMoreRoundedIcon
                aria-hidden="true"
                sx={{ fontSize: 16, transition: 'transform 150ms', transform: abierto ? 'none' : 'rotate(-90deg)' }}
              />
            </ButtonBase>
            <Collapse in={abierto} id={idLista}>
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
  const cargo = role ? NOMBRE_CARGO[role] ?? role : ''
  const iniciales = cargo.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  const deLaCuenta = itemsMenu.filter((item) => item.grupo === 'cuenta' && role && item.roles.includes(role))
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
        ...densidadDelMenu,
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
