/**
 * El cajón del móvil: el menú entero, a pantalla completa por debajo de la
 * barra, con la sección de la página que se está viendo ya abierta.
 *
 * Entra en capas desde la derecha —donde está el botón—: una granate, otra más
 * oscura y el panel; luego las secciones, una tras otra, asomando por debajo de
 * una línea. Al cerrar sale todo en orden inverso. Es el Staggered Menu de
 * React Bits, en los colores del Grupo Parroquial.
 *
 * Se gobierna solo: quien lo usa le dice si está abierto y cómo cerrarlo, y el
 * resto —qué secciones están desplegadas— se queda aquí dentro.
 */
import { Fragment, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Box, Collapse, IconButton, List, ListItem, ListItemButton, Modal, Toolbar, useTheme } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { AnimatePresence, MotionConfig, m, useIsPresent, type Variants } from 'framer-motion'
import EscudoDelGrupo from '../EscudoDelGrupo'
import IconoDelMenu from './IconoDelMenu'
import { useEnlacesDeRedes } from './redes'
import { esActiva, seccionActiva, tinta } from './estilos'
import type { EntradaMenu } from '../../config/navegacion'
import { useMenuPublico } from '../../hooks/useMenuPublico'
import { useModulos } from '../../hooks/useModulos'
import { site } from '../../config/site'
import { GOLD, GRANATE, TINTA } from '../../features/inicio/estilos'
// La serif de la agenda: importarla de ahí trae también sus ficheros de letra.
import { CORMORANT } from '../../features/actualidad/agenda/letraAlmanaque'
import { MARCA } from '../../theme/marca'

/** La curva de las capas: arranca y frena con suavidad, como una cortina. */
const CURVA_CAPA = [0.76, 0, 0.24, 1] as const
/** La de las secciones: llegan rápido y se posan despacio, como las entradas de la web. */
const CURVA_ENTRADA = [0.22, 1, 0.36, 1] as const
const PASO_CAPA = 0.07
/** Cuando el panel ya ha cubierto casi toda la pantalla, empiezan las secciones. */
const RETRASO_SECCIONES = 0.42
const PASO_SECCION = 0.06
/** Lo que tardan las secciones en irse al cerrar: después salen las capas. */
const SALIDA_SECCIONES = 0.25

// Granate, una tinta tostada de transición y el panel. `custom` es su orden.
const CAPAS = [GRANATE, MARCA.principalTostado, TINTA]

// En `transform` y no en `x`/`y`: así las mueve la tarjeta gráfica. Nunca hasta
// `none`, que framer-motion convierte en las funciones a cero (ver SeccionAnimada).
const capa: Variants = {
  oculta: { transform: 'translateX(100%)' },
  visible: (i: number) => ({ transform: 'translateX(0%)', transition: { duration: 0.7, ease: CURVA_CAPA, delay: i * PASO_CAPA } }),
  saliendo: (i: number) => ({
    transform: 'translateX(100%)',
    transition: { duration: 0.6, ease: CURVA_CAPA, delay: SALIDA_SECCIONES + (CAPAS.length - 1 - i) * PASO_CAPA },
  }),
}

// `custom` es [posición, total]: al cerrar, la última sección es la primera en irse.
const seccion: Variants = {
  oculta: { transform: 'translateY(110%)' },
  visible: ([i]: [number, number]) => ({
    transform: 'translateY(0%)',
    transition: { duration: 0.6, ease: CURVA_ENTRADA, delay: RETRASO_SECCIONES + i * PASO_SECCION },
  }),
  saliendo: ([i, total]: [number, number]) => ({
    transform: 'translateY(110%)',
    transition: { duration: 0.2, ease: 'easeIn', delay: (total - 1 - i) * 0.025 },
  }),
}

const pie: Variants = {
  oculta: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, delay: 0.9 } },
  saliendo: { opacity: 0, transition: { duration: 0.15 } },
}

/** Subpágina dentro del cajón móvil; `nivel` 1 son hijas de la sección y 2 sus nietas. */
function EnlaceCajon({ entrada, nivel, alNavegar }: { entrada: EntradaMenu; nivel: 1 | 2; alNavegar: () => void }) {
  const location = useLocation()
  const activa = esActiva(location.pathname, entrada.href, entrada.exacta)
  return (
    <ListItemButton
      component={Link}
      to={entrada.href}
      onClick={alNavegar}
      sx={{
        pl: nivel === 1 ? 0.25 : 2.25,
        py: 0.75,
        color: activa ? GOLD : 'text.secondary',
        fontSize: nivel === 1 ? '15px' : '14px',
        fontWeight: nivel === 1 ? 500 : 400,
        letterSpacing: '0.02em',
        '&:hover': { backgroundColor: 'transparent', color: 'text.primary' },
      }}
    >
      {entrada.label}
    </ListItemButton>
  )
}

/** Lo que entra y sale: se monta en cada apertura, así calcula de nuevo qué sección desplegar. */
function Panel({ alCerrar }: { alCerrar: () => void }) {
  const theme = useTheme()
  const location = useLocation()
  const menu = useMenuPublico()
  const enlacesDeRedes = useEnlacesDeRedes()
  const { activo } = useModulos()
  // Mientras sale, las rayas vuelven a su sitio a la vez que se van las capas.
  const presente = useIsPresent()
  const estaActiva = (entrada: EntradaMenu) => seccionActiva(location.pathname, entrada)
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Record<string, boolean>>(() => {
    const seccionActual = menu.find((entrada) => entrada.href !== '/' && estaActiva(entrada))
    return seccionActual ? { [seccionActual.href]: true } : {}
  })
  const alternarSeccion = (href: string) => setSeccionesAbiertas((prev) => ({ ...prev, [href]: !prev[href] }))

  return (
    <Box
      component={m.div}
      initial="oculta"
      animate="visible"
      exit="saliendo"
      sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
    >
      {/* Calca la barra del móvil, que queda debajo: el visitante no nota el cambio y ve las rayas cruzarse.
          Opaca: con el velo de la barra se transparentaban sus rayas junto a la X. */}
      <Box
        sx={{ backgroundColor: tinta(1), borderBottom: '1px solid rgba(204, 196, 201, 0.2)', flexShrink: 0 }}
      >
        <Toolbar sx={{ justifyContent: 'space-between', px: { xs: '20px !important', md: '64px !important' } }}>
          <Box
            component={Link}
            to="/"
            onClick={alCerrar}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              minWidth: 0,
              fontFamily: theme.typography.h1.fontFamily,
              fontSize: '24px',
              lineHeight: 1,
              color: 'text.primary',
              textDecoration: 'none',
            }}
          >
            <EscudoDelGrupo alto={36} />
            {site.nombreCorto.toUpperCase()}
          </Box>
          <IconButton edge="end" aria-label="Cerrar menú" onClick={alCerrar} sx={{ color: 'text.primary', width: 48, height: 48 }}>
            <IconoDelMenu abierto={presente} desdeCerradas />
          </IconButton>
        </Toolbar>
      </Box>

      <Box sx={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
        {CAPAS.slice(0, -1).map((color, i) => (
          <Box key={color} component={m.div} variants={capa} custom={i} sx={{ position: 'absolute', inset: 0, bgcolor: color }} />
        ))}
        <Box
          component={m.nav}
          aria-label="Menú"
          variants={capa}
          custom={CAPAS.length - 1}
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: CAPAS[CAPAS.length - 1],
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 4,
            px: '26px',
            pt: 4,
            pb: 'calc(28px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <List disablePadding>
            {menu.map((entrada, i) => {
              const activa = estaActiva(entrada)
              const hijos = entrada.hijos ?? []
              const abierta = Boolean(seccionesAbiertas[entrada.href])
              return (
                <ListItem key={entrada.href} disablePadding sx={{ display: 'block', overflow: 'hidden' }}>
                  <m.div variants={seccion} custom={[i, menu.length]}>
                    {/* Las secciones con subpáginas no llevan a ninguna: pulsarlas las despliega. */}
                    <ListItemButton
                      {...(hijos.length > 0
                        ? { onClick: () => alternarSeccion(entrada.href), 'aria-expanded': abierta }
                        : { component: Link, to: entrada.href, onClick: alCerrar })}
                      {...(activa && hijos.length === 0 && { 'aria-current': 'page' as const })}
                      sx={{
                        px: 0,
                        py: 0.25,
                        gap: 1.5,
                        fontFamily: CORMORANT,
                        fontSize: '32px',
                        fontWeight: 500,
                        lineHeight: 1.22,
                        color: activa ? GOLD : 'text.primary',
                        '&:hover': { backgroundColor: 'transparent', color: GOLD },
                      }}
                    >
                      {entrada.label}
                      {hijos.length > 0 && (
                        <ExpandMoreIcon
                          sx={{
                            fontSize: 22,
                            color: 'text.secondary',
                            transition: 'transform 0.3s ease',
                            transform: abierta ? 'rotate(180deg)' : 'none',
                          }}
                        />
                      )}
                    </ListItemButton>
                    {hijos.length > 0 && (
                      <Collapse in={abierta} unmountOnExit>
                        <List disablePadding sx={{ pb: 1.5, pt: 0.25 }}>
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
                  </m.div>
                </ListItem>
              )
            })}
          </List>

          <Box component={m.div} variants={pie} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            {activo('area-hermanos') ? (
              <Box
                component={Link}
                to="/acceso"
                onClick={alCerrar}
                sx={{
                  color: GOLD,
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  py: 1.5,
                }}
              >
                Acceso hermanos
              </Box>
            ) : <span />}
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {enlacesDeRedes.map((red) => (
                <IconButton
                  key={red.label}
                  href={red.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={red.label}
                  sx={{ width: 44, height: 44, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
                >
                  {red.icon}
                </IconButton>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

export default function CajonMovil({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  // El Modal tiene que seguir abierto mientras las capas salen: si se cerrara
  // con `abierto`, el menú desaparecería de golpe, como antes. Se ajusta en el
  // render, no en un efecto, para que la primera pintura ya lleve el Modal.
  const [montado, setMontado] = useState(abierto)
  if (abierto && !montado) setMontado(true)

  return (
    <Modal open={abierto || montado} onClose={alCerrar} hideBackdrop>
      <Box sx={{ position: 'fixed', inset: 0, outline: 'none' }}>
        {/* Con «reducir movimiento», las capas y las secciones aparecen sin desplazarse. */}
        <MotionConfig reducedMotion="user">
          <AnimatePresence onExitComplete={() => setMontado(false)}>
            {abierto && <Panel key="cajon" alCerrar={alCerrar} />}
          </AnimatePresence>
        </MotionConfig>
      </Box>
    </Modal>
  )
}
