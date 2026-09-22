/**
 * El menú de escritorio: una entrada por sección y, en las que tienen
 * subpáginas, un panel que se abre al pasar el ratón o al llegar con el
 * teclado.
 */
import { useState, useRef, type FocusEvent, type KeyboardEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Box, Button, useTheme } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { compactMq, esActiva, tinta } from './estilos'
import { menuPublico, type EntradaMenu } from '../../config/navegacion'

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


/** Todas las secciones, en una fila. */
export default function MenuEscritorio() {
  return (
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
  )
}
