import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AppBar, Toolbar, Box, Button, IconButton, useTheme, useMediaQuery } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import FacebookIcon from '@mui/icons-material/Facebook'
import InstagramIcon from '@mui/icons-material/Instagram'
import XIcon from '@mui/icons-material/X'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import EscudoDelGrupo from './EscudoDelGrupo'
import MenuEscritorio from './barra/MenuEscritorio'
import CajonMovil from './barra/CajonMovil'
import { DESKTOP_NAV_MIN, VELO_ARRIBA, VELO_SCROLL, compactMq, desktopMq, socialMq, tinta } from './barra/estilos'
import { site } from '../config/site'
import { BOTON } from './estiloDeBoton'

/**
 * La barra de la web pública. Aquí está el armazón —el velo que se va cerrando
 * con el scroll, la marca, las redes y el botón de acceso—; el menú de
 * escritorio y el cajón del móvil viven en `barra/`.
 */

/** El escudo de la barra, que además encoge en el tramo compacto. */
function Escudo({ alto, altoCompacto }: { alto: number; altoCompacto?: number }) {
  return (
    <EscudoDelGrupo alto={alto} sx={altoCompacto ? { [compactMq]: { height: altoCompacto } } : undefined} />
  )
}

const enlacesDeRedes = [
  { icon: <InstagramIcon fontSize="small" />, href: site.redes.instagram, label: 'Instagram' },
  { icon: <XIcon fontSize="small" />, href: site.redes.x, label: 'X' },
  { icon: <FacebookIcon fontSize="small" />, href: site.redes.facebook, label: 'Facebook' },
  { icon: <PlayCircleIcon fontSize="small" />, href: site.redes.youtube, label: 'YouTube' },
].flatMap(red => red.href ? [{ ...red, href: red.href }] : [])

export default function BarraDeNavegacion() {
  const theme = useTheme()
  const isMobile = useMediaQuery(`(max-width:${DESKTOP_NAV_MIN - 1}px)`)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [cajonAbierto, setCajonAbierto] = useState(false)

  useEffect(() => {
    let targetProgress = 0
    let currentProgress = 0
    let animationFrameId: number

    const lerp = (start: number, end: number, factor: number) => start + (end - start) * factor

    const updateProgress = () => {
      currentProgress = lerp(currentProgress, targetProgress, 0.08)
      if (Math.abs(currentProgress - targetProgress) > 0.001) {
        setScrollProgress(currentProgress)
        animationFrameId = requestAnimationFrame(updateProgress)
      } else {
        setScrollProgress(targetProgress)
      }
    }

    const handleScroll = () => {
      const maxScroll = 120
      targetProgress = Math.min(window.scrollY / maxScroll, 1)
      cancelAnimationFrame(animationFrameId)
      animationFrameId = requestAnimationFrame(updateProgress)
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll()
    return () => {
      window.removeEventListener('scroll', handleScroll)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])
  const velo = VELO_ARRIBA + (VELO_SCROLL - VELO_ARRIBA) * scrollProgress

  return (
    <>
      {isMobile && (
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            backgroundColor: tinta(VELO_SCROLL),
            borderBottom: '1px solid rgba(204, 196, 201, 0.2)',
            display: 'flex',
            [desktopMq]: { display: 'none' },
          }}
        >
          {/* Mismos márgenes laterales que ContenedorDePagina para que el logo quede alineado con los títulos */}
          <Toolbar sx={{ justifyContent: 'space-between', px: { xs: '20px !important', md: '64px !important' } }}>
            <Box
              component={Link}
              to="/"
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
              <Escudo alto={36} />
              DESAMPARADOS
            </Box>
            <IconButton
              edge="end"
              aria-label="Abrir menú"
              aria-expanded={cajonAbierto}
              onClick={() => setCajonAbierto(true)}
              sx={{ color: 'text.primary' }}
            >
              <MenuIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
      )}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          // Banda de tinta casi opaca desde el primer píxel y con corte limpio: las
          // fotos del hero las cambia el cliente y no se puede contar con que sean
          // oscuras, y al bajar la barra pasa por encima de tarjetas de papel.
          backgroundColor: tinta(velo),
          backgroundImage: 'none',
          backdropFilter: `blur(${10 + scrollProgress * 14}px) saturate(${110 + scrollProgress * 40}%)`,
          WebkitBackdropFilter: `blur(${10 + scrollProgress * 14}px) saturate(${110 + scrollProgress * 40}%)`,
          borderBottom: 'none',
          boxShadow: 'none',
          display: 'none',
          [desktopMq]: { display: 'flex' },
        }}
      >
        <Toolbar
          disableGutters
          sx={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexWrap: 'nowrap',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: { xs: 2, xl: 4 }, // separación logo → menú, reservando espacio para las acciones
            // Barra a todo el ancho: logo y menú pegados a la izquierda, acciones a la derecha
            width: '100%',
            minHeight: '72px !important',
            px: { xs: '40px', xl: '48px' },
            // Entre 1024 y 1199 el menú entero va al límite: ahí el escudo, los
            // huecos y los márgenes se encogen para que "Contacto" no llegue a
            // tocar el botón de acceso.
            [compactMq]: { gap: 1, px: '20px' },
          }}
        >
          <Box
            component={Link}
            to="/"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              fontFamily: theme.typography.h1.fontFamily,
              fontSize: '26px',
              lineHeight: 1,
              color: 'text.primary',
              textDecoration: 'none',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              [compactMq]: { fontSize: '23px', gap: 0.5 },
            }}
          >
            <Escudo alto={46} altoCompacto={32} />
            DESAMPARADOS
          </Box>

          {/* Los desplegables cuelgan por debajo de la barra: nada de `overflow: hidden` por el camino. */}
          <MenuEscritorio />

          {/* Bloque derecho (como en la referencia): redes · filete · botón píldora, pegado al extremo */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, ml: 'auto', gap: 2, [compactMq]: { gap: 1 } }}>
            <Box
              sx={{
                display: 'none',
                alignItems: 'center',
                gap: 0.5,
                pr: 2,
                borderRight: '1px solid rgba(204, 196, 201, 0.25)',
                height: 24,
                [socialMq]: { display: enlacesDeRedes.length ? 'flex' : 'none' },
                [compactMq]: { display: 'none' },
              }}
            >
              {enlacesDeRedes.map((red) => (
                <IconButton
                  key={red.label}
                  href={red.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={red.label}
                  size="small"
                  sx={{ width: 32, height: 32, p: 0, color: 'text.primary', '&:hover': { color: 'secondary.main' } }}
                >
                  {red.icon}
                </IconButton>
              ))}
            </Box>

            <Button
              component={Link}
              to="/acceso"
              variant="contained"
              disableElevation
              sx={{
                ...BOTON.principal,
                px: 3,
                minHeight: 44,
                height: 44,
                flexShrink: 0,
                fontSize: '14px',
                [compactMq]: { px: 1.5, fontSize: '13px' },
              }}
            >
              Acceso hermanos
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Se monta al abrirlo para que cada vez calcule qué sección desplegar. */}
      {cajonAbierto && <CajonMovil abierto alCerrar={() => setCajonAbierto(false)} />}
    </>
  )
}
