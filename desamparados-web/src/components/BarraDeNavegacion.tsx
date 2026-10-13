import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { AppBar, Toolbar, Box, Button, IconButton, useTheme, useMediaQuery } from '@mui/material'
import EscudoDelGrupo from './EscudoDelGrupo'
import MenuEscritorio from './barra/MenuEscritorio'
import CajonMovil from './barra/CajonMovil'
import IconoDelMenu from './barra/IconoDelMenu'
import { useEnlacesDeRedes } from './barra/redes'
import { DESKTOP_NAV_MIN, VELO_ARRIBA, VELO_SCROLL, compactMq, desktopMq, socialMq, tinta } from './barra/estilos'
import { site } from '../config/site'
import { BOTON } from './estiloDeBoton'
import { useModulos } from '../hooks/useModulos'
import { useNombreEnMenu } from '../hooks/useNombresEnMenu'

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

export default function BarraDeNavegacion() {
  const theme = useTheme()
  const isMobile = useMediaQuery(`(max-width:${DESKTOP_NAV_MIN - 1}px)`)
  const [cajonAbierto, setCajonAbierto] = useState(false)
  const enlacesDeRedes = useEnlacesDeRedes()
  const { activo } = useModulos()
  const nombreDelAcceso = useNombreEnMenu('/acceso')

  const barraRef = useRef<HTMLElement>(null)

  // El velo se escribe directamente en el estilo de la barra, sin estado de
  // React: con un `setState` por fotograma, cada bajada de rueda volvía a
  // pintar la barra entera (menú, redes, botón) unas ochenta veces.
  useEffect(() => {
    let objetivo = 0
    let actual = 0
    let fotograma = 0

    const pintar = (progreso: number) => {
      const barra = barraRef.current
      if (!barra) return
      const filtro = `blur(${10 + progreso * 14}px) saturate(${110 + progreso * 40}%)`
      barra.style.backgroundColor = tinta(VELO_ARRIBA + (VELO_SCROLL - VELO_ARRIBA) * progreso)
      barra.style.backdropFilter = filtro
      barra.style.setProperty('-webkit-backdrop-filter', filtro)
    }

    const acercar = () => {
      actual += (objetivo - actual) * 0.08
      if (Math.abs(actual - objetivo) > 0.001) {
        pintar(actual)
        fotograma = requestAnimationFrame(acercar)
      } else {
        actual = objetivo
        pintar(actual)
      }
    }

    const alDesplazar = () => {
      objetivo = Math.min(window.scrollY / 120, 1)
      cancelAnimationFrame(fotograma)
      fotograma = requestAnimationFrame(acercar)
    }

    // Pasivo: el oyente nunca cancela el desplazamiento, y así el navegador no
    // tiene que esperarlo para mover la página.
    window.addEventListener('scroll', alDesplazar, { passive: true })
    alDesplazar()
    return () => {
      window.removeEventListener('scroll', alDesplazar)
      cancelAnimationFrame(fotograma)
    }
  }, [])

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
              {site.nombreCorto.toUpperCase()}
            </Box>
            <IconButton
              edge="end"
              aria-label="Abrir menú"
              aria-expanded={cajonAbierto}
              onClick={() => setCajonAbierto(true)}
              sx={{ color: 'text.primary', width: 48, height: 48 }}
            >
              <IconoDelMenu abierto={false} />
            </IconButton>
          </Toolbar>
        </AppBar>
      )}
      <AppBar
        ref={barraRef}
        position="fixed"
        elevation={0}
        sx={{
          // Banda de tinta casi opaca desde el primer píxel y con corte limpio: las
          // fotos del hero las cambia el cliente y no se puede contar con que sean
          // oscuras, y al bajar la barra pasa por encima de tarjetas de papel.
          // Lo de arriba del todo; al desplazar, el efecto lo sobrescribe en línea.
          backgroundColor: tinta(VELO_ARRIBA),
          backgroundImage: 'none',
          backdropFilter: 'blur(10px) saturate(110%)',
          WebkitBackdropFilter: 'blur(10px) saturate(110%)',
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
            {site.nombreCorto.toUpperCase()}
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

            {activo('area-hermanos') && (
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
                {nombreDelAcceso}
              </Button>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Montado siempre en el móvil, para que al cerrarlo se vea salir. */}
      {isMobile && <CajonMovil abierto={cajonAbierto} alCerrar={() => setCajonAbierto(false)} />}
    </>
  )
}
