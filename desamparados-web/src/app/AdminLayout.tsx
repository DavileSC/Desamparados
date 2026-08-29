import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  Box, Button, Drawer, IconButton, List, ListItem, ListItemButton,
  ListItemText, ThemeProvider, Toolbar, Typography, useMediaQuery,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import LogoutIcon from '@mui/icons-material/Logout'
import { useAuthStore } from '../features/members/auth/store'
import { cerrarSesion } from '../features/members/auth/session'
import { cmsTheme, cmsSurfaces } from '../theme/cms'

export const itemsMenu = [
  { label: 'Panel', href: '/cms', roles: ['ADMIN', 'HERMANO_MAYOR', 'SECRETARIA', 'TESORERIA', 'REDES', 'ALBACERIA'] },
  { label: 'Noticias', href: '/cms/noticias', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'] },
  { label: 'Publicaciones', href: '/cms/publicaciones', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'] },
  { label: 'Agenda', href: '/cms/agenda', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'] },
  { label: 'Hermanos', href: '/cms/hermanos', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'] },
  { label: 'Tesorería', href: '/cms/tesoreria', roles: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'] },
  { label: 'Inventario', href: '/cms/inventario', roles: ['ADMIN', 'ALBACERIA', 'HERMANO_MAYOR'] },
  { label: 'Contabilidad', href: '/cms/contabilidad', roles: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'] },
  { label: 'Auditoría', href: '/cms/auditoria', roles: ['ADMIN', 'HERMANO_MAYOR'] },
]

/** Cómo se llama cada rol en castellano, para la cabecera */
const NOMBRE_ROL: Record<string, string> = {
  ADMIN: 'Administración',
  HERMANO_MAYOR: 'Hermano Mayor',
  SECRETARIA: 'Secretaría',
  TESORERIA: 'Tesorería',
  REDES: 'Comunicación',
  ALBACERIA: 'Albacería',
}

function Navegacion({ role, onNavegar }: { role?: string; onNavegar?: () => void }) {
  const location = useLocation()
  return (
    <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      {itemsMenu
        .filter((item) => role && item.roles.includes(role))
        .map((item) => {
          const activo = item.href === '/cms'
            ? location.pathname === '/cms'
            : location.pathname.startsWith(item.href)
          return (
            <ListItem key={item.href} disablePadding>
              <ListItemButton
                component={Link}
                to={item.href}
                onClick={onNavegar}
                selected={activo}
                sx={{
                  borderRadius: 1.5,
                  color: activo ? '#fff' : 'rgba(255,255,255,0.62)',
                  backgroundColor: activo ? 'primary.main' : 'transparent',
                  '&.Mui-selected:hover': { backgroundColor: 'primary.dark' },
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
                }}
              >
                <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: 14 } } }} />
              </ListItemButton>
            </ListItem>
          )
        })}
    </List>
  )
}

export default function AdminLayout() {
  const role = useAuthStore((state) => state.user?.role)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const esMovil = useMediaQuery(cmsTheme.breakpoints.down('md'))

  const barra = (
    <Box sx={{ height: '100%', backgroundColor: cmsSurfaces.sidebar, p: 2.5, display: 'flex', flexDirection: 'column' }}>
      <Typography
        component={Link}
        to="/cms"
        sx={{ color: '#fff', textDecoration: 'none', fontFamily: '"Libre Caslon Text", serif', fontSize: 20 }}
      >
        DESAMPARADOS
      </Typography>
      <Typography variant="overline" sx={{ display: 'block', color: 'rgba(255,255,255,0.5)', mb: 2.5 }}>
        CMS
      </Typography>
      <Navegacion role={role} onNavegar={() => setMenuAbierto(false)} />
      <Button
        startIcon={<LogoutIcon />}
        onClick={() => { void cerrarSesion() }}
        sx={{ mt: 'auto', color: 'rgba(255,255,255,0.62)', justifyContent: 'flex-start' }}
      >
        Cerrar sesión
      </Button>
    </Box>
  )

  return (
    <ThemeProvider theme={cmsTheme}>
      <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default', color: 'text.primary' }}>
        {esMovil ? (
          <Drawer open={menuAbierto} onClose={() => setMenuAbierto(false)} sx={{ '& .MuiDrawer-paper': { width: 250, border: 0 } }}>
            {barra}
          </Drawer>
        ) : (
          <Box component="aside" sx={{ width: 250, flexShrink: 0 }}>{barra}</Box>
        )}

        <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
          <Toolbar
            sx={{
              borderBottom: `1px solid ${cmsSurfaces.hairline}`,
              backgroundColor: 'background.paper',
              gap: 1.5,
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            {esMovil && (
              <IconButton edge="start" aria-label="Abrir el menú" onClick={() => setMenuAbierto(true)}>
                <MenuIcon />
              </IconButton>
            )}
            <Typography sx={{ fontFamily: '"Libre Caslon Text", serif', fontSize: 18 }}>
              Grupo Parroquial de los Desamparados
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
              {role ? NOMBRE_ROL[role] ?? role : ''}
            </Typography>
          </Toolbar>
          <Box sx={{ p: { xs: 2.5, md: 4 } }}>
            <Outlet />
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  )
}
