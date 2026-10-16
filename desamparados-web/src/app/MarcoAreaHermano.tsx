import { useRef, useState } from 'react'
import { Outlet, Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
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
import LogoutIcon from '@mui/icons-material/Logout'
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined'
import EscudoDelGrupo from '../components/EscudoDelGrupo'
import TransicionDePagina from '../components/TransicionDePagina'
import SaltarAlContenido from '../components/SaltarAlContenido'
import { useFocoAlCambiarDePagina } from '../hooks/useFocoAlCambiarDePagina'
import { designTokens } from '../theme'
import { cerrarSesion } from '../features/altas/auth/session'
import { site } from '../config/site'
import { entradasDelArea } from './areaHermanoNavegacion'
import { useModulos } from '../hooks/useModulos'
import VentanaSesionCaducada from './VentanaSesionCaducada'
import SelectorDeFicha from '../features/areaHermano/perfil/SelectorDeFicha'
import { useFichasDeLaCuenta } from '../features/areaHermano/perfil/fichasDeLaCuenta'

const ANCHO_CAJON = 260

export default function MarcoAreaHermano() {
  const theme = useTheme()
  const location = useLocation()
  const [cajonAbierto, setCajonAbierto] = useState(false)
  // Como en la web pública: salto al contenido y, al navegar, el foco al título nuevo.
  const principal = useRef<HTMLElement>(null)
  useFocoAlCambiarDePagina(principal)
  const { activo } = useModulos()
  const entradas = entradasDelArea.filter((e) => activo(e.modulo))

  const alternarCajon = () => setCajonAbierto(!cajonAbierto)

  // La ficha que se ve en «Mi perfil» va en su dirección (?ficha=). Fuera de
  // él, el menú recuerda la última elegida, para que al volver se abra la misma.
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { data: fichas = [] } = useFichasDeLaCuenta()
  const enPerfil = location.pathname === '/area-hermano/perfil'
  const pedida = Number(params.get('ficha'))
  const deLaDireccion = fichas.some((f) => f.id === pedida) ? pedida : null
  const [ultima, setUltima] = useState<number | null>(null)
  if (enPerfil && deLaDireccion !== ultima) setUltima(deLaDireccion)
  const elegida = enPerfil ? deLaDireccion : ultima
  const elegir = (id: number) => {
    setCajonAbierto(false)
    // En «Mi perfil» se queda en la misma pestaña; desde otra pantalla, va a él.
    const siguientes = new URLSearchParams(enPerfil ? params : undefined)
    siguientes.set('ficha', String(id))
    navigate(`/area-hermano/perfil?${siguientes.toString()}`)
  }
  const hrefDe = (href: string) => (href === '/area-hermano/perfil' && ultima ? `${href}?ficha=${ultima}` : href)

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
        {entradas.map((item) => {
          const activa = esActiva(item.href)
          return (
            <ListItem key={item.label} disablePadding>
              <ListItemButton
                component={Link}
                to={hrefDe(item.href)}
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
                <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}><item.icono /></Box>
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
        {fichas.length > 0 && (
          <Box sx={{ pt: 2, pb: 1.5, mb: 0.5, borderTop: '1px solid rgba(204, 196, 201, 0.2)' }}>
            <SelectorDeFicha variante="cajon" fichas={fichas} elegida={elegida} onElegir={elegir} />
          </Box>
        )}
        {/* Lo de la cuenta, junto a «Cerrar sesión» (16-10-2026): ocupa el sitio
            de «Volver a la web», que ya lo hace el escudo de arriba. */}
        <Button
          fullWidth
          component={Link}
          to="/area-hermano/cuenta"
          startIcon={<KeyOutlinedIcon />}
          onClick={() => setCajonAbierto(false)}
          aria-current={esActiva('/area-hermano/cuenta') ? 'page' : undefined}
          sx={{
            justifyContent: 'flex-start',
            color: esActiva('/area-hermano/cuenta') ? 'text.primary' : 'text.secondary',
            backgroundColor: esActiva('/area-hermano/cuenta') ? 'rgba(255,255,255,0.08)' : 'transparent',
            textTransform: 'none', letterSpacing: 0, fontSize: 15, fontWeight: esActiva('/area-hermano/cuenta') ? 600 : 500,
            '&:hover': { color: 'text.primary', backgroundColor: 'rgba(255,255,255,0.05)' },
          }}
        >
          Cuenta y contraseña
        </Button>
        <Button
          fullWidth
          startIcon={<LogoutIcon />}
          onClick={() => { void cerrarSesion('hermanos') }}
          sx={{
            justifyContent: 'flex-start',
            color: 'text.secondary',
            textTransform: 'none', letterSpacing: 0, fontSize: 15, fontWeight: 500,
            // El granate no es color de letra sobre negro (3,1:1): al pasar, blanco.
            '&:hover': { color: 'text.primary', backgroundColor: 'rgba(255,255,255,0.05)' },
          }}
        >
          Cerrar sesión
        </Button>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <SaltarAlContenido destino={principal} />
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${ANCHO_CAJON}px)` },
          ml: { md: `${ANCHO_CAJON}px` },
          // Opaca: al 95 % el título de la página se transparentaba al desplazarse por debajo.
          backgroundColor: 'rgb(18, 17, 19)',
          borderBottom: '1px solid rgba(204, 196, 201, 0.2)',
          display: { md: 'none' },
        }}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={alternarCajon} sx={{ mr: 2 }}
            aria-label={cajonAbierto ? 'Cerrar el menú' : 'Abrir el menú'} aria-expanded={cajonAbierto} aria-controls="menu-del-area">
            <MenuIcon />
          </IconButton>
          {/* En el móvil el menú no se ve: la ficha elegida ocupa el sitio del título. */}
          {fichas.length > 0
            ? <Box sx={{ minWidth: 0, display: 'flex' }}><SelectorDeFicha variante="barra" fichas={fichas} elegida={elegida} onElegir={elegir} /></Box>
            : (
              <Typography variant="h6" sx={{ fontFamily: designTokens.fonts.heading }}>
                Área de hermanos
              </Typography>
            )}
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: ANCHO_CAJON }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          id="menu-del-area"
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
        id="contenido"
        ref={principal}
        tabIndex={-1}
        sx={{
          '&:focus, & h1[tabindex="-1"]:focus': { outline: 'none' },
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
      {/* Si la sesión caduca con Mi perfil a medias, se vuelve a entrar sin perder lo escrito. */}
      <VentanaSesionCaducada area="hermanos" />
    </Box>
  )
}
