import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion'
import { SERIF, ceja } from '../../features/inicio/estilos'
import { parrafosDe, type BloqueFotoFija as Datos } from '../../lib/api/contenido'
import { valorDe } from './presentacion'
import { propsDeFoto } from '../../lib/fotoSubida'
import { MARCA } from '../../theme/marca'

/** A qué altura de la pantalla (0 arriba, 1 abajo) empieza a leerse una parte. */
const LINEA_DE_LECTURA = 0.55

const NOCHE = '#0a090b'

/** Hasta las doce partes que admite el bloque (shared/topes-contenido.json). */
const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

/**
 * Foto fija y texto que pasa, en forma de telón: la foto ocupa el ancho de la
 * página (con su margen a los lados, no a sangre) y se queda quieta de fondo
 * mientras el texto pasa por encima, sobre una sombra que la oscurece hacia
 * su lado. Cambia (con un fundido y un leve acercamiento)
 * a la de la parte que se está leyendo, y una regleta en el lado de la foto
 * marca cuál es. «Foto a la derecha», lo de siempre, deja el texto a la
 * izquierda, como la foto fundida de Foto y texto.
 *
 * En el móvil la sombra va por abajo y el texto pasa por ella; la regleta, en
 * rayas arriba. Con «reducir movimiento» cambia igual, pero sin fundido.
 *
 * Todas las fotos están montadas desde el principio, apiladas: así el cambio
 * no espera a la red. Solo la visible se anuncia a los lectores de pantalla.
 */
export default function BloqueFotoFija({ bloque }: { bloque: Datos }) {
  const reducir = useReducedMotion()
  const izquierda = valorDe(bloque, 'lado') === 'izquierda'
  const [activa, setActiva] = useState(0)
  const partes = useRef<(HTMLElement | null)[]>([])

  const recalcula = useCallback(() => {
    const altura = window.innerHeight * LINEA_DE_LECTURA
    let indice = 0
    partes.current.forEach((parte, i) => {
      if (parte && parte.getBoundingClientRect().top < altura) indice = i
    })
    // Legítimo en el efecto de abajo: mide dónde han quedado los pasos en la
    // pantalla, y eso no se sabe al pintar, solo después.
    // eslint-disable-next-line react/set-state-in-effect
    setActiva(indice)
  }, [])
  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, 'change', recalcula)
  useEffect(recalcula, [recalcula, bloque.pasos.length])

  const haciaElTexto = izquierda ? '270deg' : '90deg'

  return (
    <Box
      sx={{
        // `clip` y no `hidden`: con `hidden` sería un contenedor de
        // desplazamiento y el fondo ya no se quedaría pegado.
        position: 'relative', isolation: 'isolate', overflow: 'clip', backgroundColor: NOCHE, borderRadius: 1.5,
      }}
    >
      {/* El fondo: del alto de la pantalla, y con el margen negativo no empuja a las partes. */}
      <Box sx={{ position: 'sticky', top: 0, height: '100svh', mb: '-100svh', overflow: 'hidden', zIndex: -1 }}>
        {/* Una parte recién añadida en el CMS aún sin foto, nada: un <img src=""> vuelve a pedir la página. */}
        {bloque.pasos.map((paso, i) => paso.foto.url !== '' && (
          <Box
            // Clave posicional: una parte no tiene identificador, y la foto no guarda estado.
            key={i}
            component="img"
            {...propsDeFoto(paso.foto.url, '100vw')}
            alt={paso.foto.alt}
            aria-hidden={i === activa ? undefined : true}
            loading={i === 0 ? undefined : 'lazy'}
            decoding="async"
            sx={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center 30%',
              opacity: i === activa ? 1 : 0,
              transform: i === activa || reducir ? 'none' : 'scale(1.04)',
              transition: reducir ? 'none' : 'opacity 1s ease, transform 1.6s cubic-bezier(.2, .8, .2, 1)',
            }}
          />
        ))}
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute', inset: 0,
            background: {
              xs: `linear-gradient(0deg, rgba(10, 9, 11, 0.94) 0%, rgba(10, 9, 11, 0.6) 45%, rgba(10, 9, 11, 0.1) 75%)`,
              md: `linear-gradient(${haciaElTexto}, rgba(10, 9, 11, 0.88) 0%, rgba(10, 9, 11, 0.5) 40%, rgba(10, 9, 11, 0) 70%)`,
            },
          }}
        />
      </Box>

      {bloque.pasos.length > 1 && (
        <Box aria-hidden="true" sx={{ position: 'sticky', top: 0, height: 0, zIndex: 1 }}>
          <Box
            component="ol"
            sx={{
              position: 'absolute', m: 0, p: 0, listStyle: 'none',
              display: 'flex', flexDirection: { xs: 'row', md: 'column' }, gap: { xs: 0.75, md: 1.25 },
              top: { xs: 76, md: '50svh' }, transform: { md: 'translateY(-50%)' },
              left: { xs: 20, md: izquierda ? 32 : 'auto' }, right: { md: izquierda ? 'auto' : 32 },
            }}
          >
            {bloque.pasos.map((_, i) => (
              <Box
                key={i}
                component="li"
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25,
                  flexDirection: izquierda ? 'row-reverse' : 'row', justifyContent: 'flex-end',
                  fontSize: { xs: 0, md: 12 }, letterSpacing: '0.08em',
                  color: i === activa ? MARCA.acento : 'rgba(255, 255, 255, 0.5)',
                  transition: reducir ? 'none' : 'color .4s',
                  '&::after': {
                    content: '""', height: { xs: 2, md: 1 }, backgroundColor: 'currentColor',
                    width: { xs: 22, md: i === activa ? 40 : 18 },
                    transition: reducir ? 'none' : 'width .4s',
                  },
                }}
              >
                {ROMANOS[i]}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {bloque.pasos.map((paso, i) => (
        <Box
          key={i}
          component="section"
          ref={(el: HTMLElement | null) => { partes.current[i] = el }}
          sx={{
            minHeight: '100svh', display: 'flex', alignItems: { xs: 'flex-end', md: 'center' },
            opacity: i === activa ? 1 : 0.3,
            transition: reducir ? 'none' : 'opacity .6s ease',
          }}
        >
          <Box sx={{ width: '100%', px: { xs: 2.5, md: 9 }, pb: { xs: 7, md: 0 }, display: 'flex', justifyContent: izquierda ? { md: 'flex-end' } : 'flex-start' }}>
            <Box sx={{ maxWidth: 460 }}>
              <Typography component="span" sx={{ ...ceja, color: MARCA.acento, mb: 1.5 }}>
                {ROMANOS[i]}{paso.foto.pie !== '' && ` · ${paso.foto.pie}`}
              </Typography>
              {paso.titulo !== '' && (
                <Typography component="h3" sx={{ fontFamily: SERIF, fontSize: { xs: 28, md: 40 }, lineHeight: 1.12, letterSpacing: '-0.01em', textWrap: 'balance', color: '#fff', mb: 2.25 }}>
                  {paso.titulo}
                </Typography>
              )}
              {parrafosDe(paso.texto).map((parrafo, j) => (
                <Typography key={j} sx={{ color: 'rgba(255, 255, 255, 0.84)', fontSize: { xs: 15.5, md: 16.5 }, lineHeight: 1.75, mb: 2.5, '&:last-of-type': { mb: 0 } }}>
                  {parrafo}
                </Typography>
              ))}
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  )
}
