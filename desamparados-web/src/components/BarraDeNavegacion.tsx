import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { AppBar, Toolbar, Box, Button, IconButton, useMediaQuery } from '@mui/material'
import MenuEscritorio from './barra/MenuEscritorio'
import CajonMovil from './barra/CajonMovil'
import IconoDelMenu from './barra/IconoDelMenu'
import { useEnlacesDeRedes } from './barra/redes'
import { FileteMovil, MarcaEscritorio, MarcaMovil } from './barra/MarcaDeLaBarra'
import { ALTO_FRANJA, DESKTOP_NAV_MIN, VELO_ARRIBA, VELO_SCROLL, compactMq, desktopMq, estrechoMq, tinta } from './barra/estilos'
import { BOTON } from './estiloDeBoton'
import { useModulos } from '../hooks/useModulos'
import { useNombreEnMenu } from '../hooks/useNombresEnMenu'

/**
 * La barra de la web pública. Aquí está el armazón —el velo que se va cerrando
 * con el scroll, las redes y el botón de acceso—; la marca, el menú de
 * escritorio y el cajón del móvil viven en `barra/`.
 *
 * En escritorio va en dos pisos (13-11-2026, elegida en maqueta): arriba las
 * redes, el escudo con el nombre de la titular y el acceso; abajo, el menú,
 * bajo un filete dorado.
 */

export default function BarraDeNavegacion() {
  const isMobile = useMediaQuery(`(max-width:${DESKTOP_NAV_MIN - 1}px)`)
  const [cajonAbierto, setCajonAbierto] = useState(false)
  const enlacesDeRedes = useEnlacesDeRedes()
  const { activo } = useModulos()
  const nombreDelAcceso = useNombreEnMenu('/acceso')

  const veloRef = useRef<HTMLDivElement>(null)

  // El velo se escribe directamente en su estilo, sin estado de
  // React: con un `setState` por fotograma, cada bajada de rueda volvía a
  // pintar la barra entera (menú, redes, botón) unas ochenta veces.
  useEffect(() => {
    let objetivo = 0
    let actual = 0
    let fotograma = 0

    const pintar = (progreso: number) => {
      const velo = veloRef.current
      if (!velo) return
      const filtro = `blur(${10 + progreso * 14}px) saturate(${110 + progreso * 40}%)`
      velo.style.backgroundColor = tinta(VELO_ARRIBA + (VELO_SCROLL - VELO_ARRIBA) * progreso)
      velo.style.backdropFilter = filtro
      velo.style.setProperty('-webkit-backdrop-filter', filtro)
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
            display: 'flex',
            [desktopMq]: { display: 'none' },
          }}
        >
          {/* Mismos márgenes laterales que ContenedorDePagina para que el logo quede alineado con los títulos */}
          <Toolbar sx={{ position: 'relative', justifyContent: 'space-between', gap: 1, px: { xs: '20px !important', md: '64px !important' } }}>
            <MarcaMovil />
            <IconButton
              edge="end"
              aria-label="Abrir menú"
              aria-expanded={cajonAbierto}
              onClick={() => setCajonAbierto(true)}
              sx={{ color: 'text.primary', width: 48, height: 48, flexShrink: 0 }}
            >
              <IconoDelMenu abierto={false} />
            </IconButton>
            <FileteMovil />
          </Toolbar>
        </AppBar>
      )}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          boxShadow: 'none',
          display: 'none',
          [desktopMq]: { display: 'block' },
        }}
      >
        {/* El velo va aparte, por detrás, y no en la barra misma: un desenfoque
            del fondo hace de «raíz» para los de dentro, y la hoja de cristal del
            menú desenfocaría solo la barra en vez de la foto de la página.
            Banda de tinta casi opaca desde el primer píxel y con corte limpio:
            las fotos del hero las cambia el cliente y no se puede contar con que
            sean oscuras. Lo de arriba del todo; al desplazar, el efecto lo
            sobrescribe en línea. */}
        <Box
          ref={veloRef}
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundColor: tinta(VELO_ARRIBA),
            backdropFilter: 'blur(10px) saturate(110%)',
            WebkitBackdropFilter: 'blur(10px) saturate(110%)',
          }}
        />
        <Box sx={{ position: 'relative' }}>
          <Box
            sx={{
              height: ALTO_FRANJA,
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
              alignItems: 'center',
              columnGap: 3,
              px: '40px',
              [compactMq]: { px: '24px', columnGap: 2 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: '-8px', [estrechoMq]: { gap: 0 } }}>
              {enlacesDeRedes.map((red) => (
                <IconButton
                  key={red.label}
                  href={red.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={red.label}
                  sx={{
                    width: 38,
                    height: 38,
                    p: 0,
                    color: 'text.primary',
                    '& .MuiSvgIcon-root': { fontSize: 20 },
                    '&:hover': { color: 'secondary.main' },
                    [estrechoMq]: { width: 34, height: 34, '& .MuiSvgIcon-root': { fontSize: 19 } },
                  }}
                >
                  {red.icon}
                </IconButton>
              ))}
            </Box>

            <MarcaEscritorio />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              {activo('area-hermanos') && (
                <Button
                  component={Link}
                  to="/acceso"
                  variant="contained"
                  disableElevation
                  sx={{
                    ...BOTON.principal,
                    px: 2.5,
                    minHeight: 42,
                    height: 42,
                    flexShrink: 0,
                    fontSize: '15px',
                    whiteSpace: 'nowrap',
                    [compactMq]: { px: 2, minHeight: 40, height: 40, fontSize: '14px' },
                  }}
                >
                  {nombreDelAcceso}
                </Button>
              )}
            </Box>
          </Box>

          {/* Las hojas cuelgan por debajo de la barra: nada de `overflow: hidden` por el camino. */}
          <MenuEscritorio />
        </Box>
      </AppBar>

      {/* Montado siempre en el móvil, para que al cerrarlo se vea salir. */}
      {isMobile && <CajonMovil abierto={cajonAbierto} alCerrar={() => setCajonAbierto(false)} />}
    </>
  )
}
