import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { AppBar, Toolbar, Box, Button, IconButton, useMediaQuery } from '@mui/material'
import MenuEscritorio from './barra/MenuEscritorio'
import CajonMovil from './barra/CajonMovil'
import IconoDelMenu from './barra/IconoDelMenu'
import { useEnlacesDeRedes } from './barra/redes'
import { FileteMovil, MarcaEscritorio, MarcaMovil } from './barra/MarcaDeLaBarra'
import { ALTO_BARRA_ESCRITORIO, ALTO_FRANJA, COLA_DEL_VELO, DESKTOP_NAV_MIN, VELO_ARRIBA, VELO_SCROLL, compactMq, desktopMq, estrechoMq, tinta } from './barra/estilos'
import { BOTON } from './estiloDeBoton'
import { useModulos } from '../hooks/useModulos'
import { NOMBRE_DEL_ACCESO } from '../config/navegacion'

/**
 * La barra de la web pública. Aquí está el armazón —el velo que se va cerrando
 * con el scroll, las redes y el botón de acceso—; la marca, el menú de
 * escritorio y el cajón del móvil viven en `barra/`.
 *
 * En escritorio va en dos pisos (13-11-2026, elegida en maqueta): arriba las
 * redes, el escudo con el nombre de la titular y el acceso; abajo, el menú,
 * bajo un filete burdeos. Desde el 18-11-2026, fina (82 px): redes, escudo y
 * botón más pequeños, con el mismo orden y la misma transparencia.
 */

/**
 * Las capas del desenfoque progresivo, de abajo arriba: en qué parte de la cola
 * dejan de estar enteras y en cuál se acaban (de 0, el pie de la barra, a 1, el
 * final de la cola), y cuánto desenfocan (en px, antes de multiplicar por
 * `--velo-desenfoque`, que sube al bajar por la página). Todas llegan enteras
 * hasta el pie de la barra: si una se acabara antes, el texto de la barra
 * dejaría ver la foto más nítida de lo que la deja ver ahora.
 */
const CAPAS_DEL_VELO = [
  { entera: 0.6, hasta: 1, desenfoque: 1 },
  { entera: 0.4, hasta: 0.8, desenfoque: 3 },
  { entera: 0.2, hasta: 0.6, desenfoque: 7 },
  { entera: 0, hasta: 0.4, desenfoque: 12 },
] as const

/** Un punto de la cola (de 0 a 1), en CSS: se estira con `--velo-cola`. */
const enLaCola = (parte: number) => `calc(${ALTO_BARRA_ESCRITORIO}px + ${COLA_DEL_VELO * parte}px * var(--velo-cola))`

// `--velo-cola` (de 0 a 1) estira la cola: entera con una foto bajo la barra
// (fotoBajoLaBarra.ts); si no, sale al bajar, con `--velo-cola-scroll`.
const velo = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: enLaCola(1),
  // Lo que asoma por debajo de la barra no tapa los clics de la página.
  pointerEvents: 'none',
  '--velo-tinta': VELO_ARRIBA,
  '--velo-desenfoque': 1,
  '--velo-cola': 'var(--velo-cola-scroll, 0)',
  'html[data-foto-bajo-la-barra] &': { '--velo-cola': 1 },
} as const

function capaDelVelo({ entera, hasta, desenfoque }: (typeof CAPAS_DEL_VELO)[number]) {
  const filtro = `blur(calc(${desenfoque}px * var(--velo-desenfoque)))${desenfoque === 12 ? ' saturate(110%)' : ''}`
  const mascara = `linear-gradient(to bottom, #000 ${enLaCola(entera)}, transparent ${enLaCola(hasta)})`
  return { position: 'absolute', inset: 0, backdropFilter: filtro, WebkitBackdropFilter: filtro, maskImage: mascara, WebkitMaskImage: mascara } as const
}

// Encima de las capas, no en el velo: si la pintara el velo, las capas la
// desenfocarían con la foto. Hasta el pie del menú, al menos VELO_ARRIBA.
const tintaDelVelo = {
  position: 'absolute',
  inset: 0,
  background: `linear-gradient(to bottom,
    rgb(7 6 8 / calc(var(--velo-tinta) + 0.08)) 0,
    rgb(7 6 8 / var(--velo-tinta)) ${ALTO_BARRA_ESCRITORIO - 2}px,
    rgb(7 6 8 / calc(var(--velo-tinta) * 0.5)) ${enLaCola(0.35)},
    rgb(7 6 8 / 0) 100%)`,
} as const

export default function BarraDeNavegacion() {
  const isMobile = useMediaQuery(`(max-width:${DESKTOP_NAV_MIN - 1}px)`)
  const [cajonAbierto, setCajonAbierto] = useState(false)
  const enlacesDeRedes = useEnlacesDeRedes()
  const { activo } = useModulos()

  const veloRef = useRef<HTMLDivElement>(null)

  // El velo se escribe directamente en su estilo, sin estado de
  // React: con un `setState` por fotograma, cada bajada de rueda volvía a
  // pintar la barra entera (menú, redes, botón) unas ochenta veces.
  useEffect(() => {
    let objetivo = 0
    let actual = 0
    let fotograma = 0

    // Dos variables y no los estilos de cada capa: la tinta y las cuatro capas
    // del desenfoque las leen en su CSS.
    const pintar = (progreso: number) => {
      const velo = veloRef.current
      if (!velo) return
      velo.style.setProperty('--velo-tinta', (VELO_ARRIBA + (VELO_SCROLL - VELO_ARRIBA) * progreso).toFixed(3))
      velo.style.setProperty('--velo-desenfoque', (1 + progreso * 1.4).toFixed(3))
      // Hecha ya a media subida del velo (60 px), cuando el texto empieza a pasar por debajo.
      velo.style.setProperty('--velo-cola-scroll', Math.min(progreso * 2, 1).toFixed(3))
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
            No acaba en una línea: en una cola corta (COLA_DEL_VELO), cuatro
            capas de desenfoque, cada una más corta y más fuerte, hacen que la
            foto se vaya enfocando según baja, y la tinta se apaga a la vez. Detrás del texto de la barra la tinta no baja de VELO_ARRIBA:
            las fotos del hero las cambia el cliente y pueden ser claras. */}
        <Box ref={veloRef} aria-hidden sx={velo}>
          {CAPAS_DEL_VELO.map((capa) => (
            <Box key={capa.desenfoque} sx={capaDelVelo(capa)} />
          ))}
          <Box sx={tintaDelVelo} />
        </Box>
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
                    // 30 px que pulsar en una franja de 48: por encima de los 24 de WCAG 2.5.8.
                    width: 30,
                    height: 30,
                    p: 0,
                    color: 'text.primary',
                    '& .MuiSvgIcon-root': { fontSize: 17 },
                    '&:hover': { color: 'secondary.main' },
                    [estrechoMq]: { width: 28, height: 28, '& .MuiSvgIcon-root': { fontSize: 16 } },
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
                    // Mini: cabe en la franja fina con aire arriba y abajo.
                    px: 1.75,
                    minHeight: 30,
                    height: 30,
                    flexShrink: 0,
                    fontSize: '13px',
                    whiteSpace: 'nowrap',
                    [compactMq]: { px: 1.5, fontSize: '12.5px' },
                  }}
                >
                  {NOMBRE_DEL_ACCESO}
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
