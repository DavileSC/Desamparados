/**
 * El cajón del móvil: el menú entero desplegable, con la sección de la página
 * que se está viendo ya abierta.
 *
 * Se gobierna solo: quien lo usa le dice si está abierto y cómo cerrarlo, y el
 * resto —qué secciones están desplegadas— se queda aquí dentro.
 */
import { Fragment, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Box, Collapse, Drawer, IconButton, List, ListItem, ListItemButton, ListItemText, useTheme,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import HomeIcon from '@mui/icons-material/Home'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import NewspaperIcon from '@mui/icons-material/Newspaper'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import GroupIcon from '@mui/icons-material/Group'
import MailIcon from '@mui/icons-material/Mail'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import EscudoDelGrupo from '../EscudoDelGrupo'
import { esActiva, seccionActiva } from './estilos'
import { menuPublico, type EntradaMenu } from '../../config/navegacion'

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

/** Subpágina dentro del cajón móvil; `nivel` 1 son hijas de la sección y 2 sus nietas. */
function EnlaceCajon({ entrada, nivel, alNavegar }: { entrada: EntradaMenu; nivel: 1 | 2; alNavegar: () => void }) {
  const theme = useTheme()
  const location = useLocation()
  const activa = esActiva(location.pathname, entrada.href, entrada.exacta)
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

export default function CajonMovil({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  const theme = useTheme()
  const location = useLocation()
  const estaActiva = (seccion: EntradaMenu) => seccionActiva(location.pathname, seccion)
  // El cajón se abre con la sección de la página actual ya desplegada; se
  // calcula al montarlo, que es cuando `BarraDeNavegacion` lo pide abrir.
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Record<string, boolean>>(() => {
    const seccionActual = menuPublico.find((entrada) => entrada.href !== '/' && estaActiva(entrada))
    return seccionActual ? { [seccionActual.href]: true } : {}
  })
  const alternarSeccion = (href: string) => setSeccionesAbiertas((prev) => ({ ...prev, [href]: !prev[href] }))

  return (
  <Drawer
    anchor="left"
    open={abierto}
    onClose={alCerrar}
    slotProps={{
      paper: {
        sx: {
          width: 288,
          backgroundColor: '#070608',
          borderRight: '1px solid rgba(204, 196, 201, 0.2)',
        },
      },
    }}
  >
    <Box sx={{ p: 3, borderBottom: '1px solid rgba(204, 196, 201, 0.2)' }}>
      <IconButton aria-label="Cerrar menú" onClick={alCerrar} sx={{ display: 'flex', ml: 'auto', mb: 2, color: 'text.primary' }}><CloseIcon /></IconButton>
      <Box
        component={Link}
        to="/"
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none' }}
      >
        <EscudoDelGrupo alto={44} />
        <Box sx={{ minWidth: 0 }}>
          <Box
            sx={{
              fontFamily: theme.typography.h1.fontFamily,
              fontSize: '22px',
              lineHeight: 1.15,
              color: 'text.primary',
              mb: 0.5,
            }}
          >
            DESAMPARADOS DE MÁLAGA
          </Box>
          <Box sx={{ typography: 'overline', color: 'text.secondary', fontSize: '11px' }}>
            Grupo Parroquial
          </Box>
        </Box>
      </Box>
    </Box>
    <List sx={{ py: 2 }}>
      {menuPublico.map((entrada) => {
        const active = estaActiva(entrada)
        const hijos = entrada.hijos ?? []
        const abierta = Boolean(seccionesAbiertas[entrada.href])
        return (
          <Fragment key={entrada.href}>
            {/* Las secciones con subpáginas no llevan a ninguna: pulsarlas las despliega. */}
            <ListItem disablePadding>
              <ListItemButton
                {...(hijos.length > 0
                  ? { onClick: () => alternarSeccion(entrada.href), 'aria-expanded': abierta }
                  : { component: Link, to: entrada.href, onClick: alCerrar })}
                selected={active}
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
                {hijos.length > 0 && (abierta ? <ExpandLessIcon /> : <ExpandMoreIcon />)}
              </ListItemButton>
            </ListItem>
            {hijos.length > 0 && (
              <Collapse in={abierta} unmountOnExit>
                <List disablePadding sx={{ pb: 1 }}>
                  {hijos.map((hijo) => (
                    <Fragment key={hijo.href}>
                      <EnlaceCajon entrada={hijo} nivel={1} alNavegar={alCerrar} />
                      {hijo.hijos?.map((nieto) => (
                        <EnlaceCajon key={nieto.href} entrada={nieto} nivel={2} alNavegar={alCerrar} />
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
  )
}
