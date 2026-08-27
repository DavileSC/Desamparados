import { Outlet, Link, useLocation } from 'react-router-dom'
import { Box, Button, List, ListItem, ListItemButton, ListItemText, Typography } from '@mui/material'
import LogoutIcon from '@mui/icons-material/Logout'
import { useAuthStore } from '../features/members/auth/store'

const items = [
  { label: 'Noticias', href: '/cms/noticias', roles: ['ADMIN', 'REDES'] },
  { label: 'Publicaciones', href: '/cms/publicaciones', roles: ['ADMIN', 'REDES'] },
  { label: 'Agenda', href: '/cms/agenda', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'] },
  { label: 'Hermanos', href: '/cms/hermanos', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'] },
  { label: 'Tesorería', href: '/cms/tesoreria', roles: ['ADMIN', 'TESORERIA'] },
  { label: 'Inventario', href: '/cms/inventario', roles: ['ADMIN', 'ALBACERIA', 'HERMANO_MAYOR'] },
  { label: 'Contabilidad', href: '/cms/contabilidad', roles: ['ADMIN', 'TESORERIA'] },
  { label: 'Auditoría', href: '/cms/auditoria', roles: ['ADMIN'] },
]

export default function AdminLayout() {
  const location = useLocation()
  const logout = useAuthStore((state) => state.logout)
  const role = useAuthStore((state) => state.user?.role)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default' }}>
      <Box component="aside" sx={{ width: { xs: 220, md: 260 }, flexShrink: 0, backgroundColor: '#100e11', p: 3 }}>
        <Typography component={Link} to="/cms" sx={{ color: 'text.primary', textDecoration: 'none', fontFamily: '"Libre Caslon Text", serif', fontSize: 22 }}>
          DESAMPARADOS
        </Typography>
        <Typography variant="overline" sx={{ display: 'block', color: 'text.secondary', mb: 3 }}>CMS</Typography>
        <List disablePadding>
          {items.filter((item) => role && item.roles.includes(role)).map((item) => (
            <ListItem key={item.href} disablePadding>
              <ListItemButton component={Link} to={item.href} selected={location.pathname.startsWith(item.href)}>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Button startIcon={<LogoutIcon />} onClick={logout} sx={{ mt: 4, color: 'text.secondary' }}>Cerrar sesión</Button>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 3, md: 6 }, overflow: 'auto' }}><Outlet /></Box>
    </Box>
  )
}
