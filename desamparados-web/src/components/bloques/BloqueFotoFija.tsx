import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion'
import { SERIF, ceja } from '../../features/inicio/estilos'
import { parrafosDe, type BloqueFotoFija as Datos } from '../../lib/api/contenido'
import { anchoMaximo, valorDe } from './presentacion'
import { propsDeFoto } from '../../lib/fotoSubida'

/** A qué altura de la pantalla (0 arriba, 1 abajo) empieza a leerse una parte. */
const LINEA_DE_LECTURA = 0.55

/**
 * Foto fija y texto que pasa: la foto se queda quieta a un lado mientras el
 * texto pasa al otro, y cambia (con un fundido y un leve acercamiento) a la de
 * la parte que se está leyendo. La parte que se lee va encendida y las demás,
 * atenuadas.
 *
 * En el móvil la foto va arriba, pegada bajo la barra, y el texto pasa por
 * debajo. Con «reducir movimiento» cambia igual, pero sin fundido.
 *
 * Todas las fotos están montadas desde el principio, apiladas: así el cambio
 * no espera a la red. Solo la visible se anuncia a los lectores de pantalla.
 */
export default function BloqueFotoFija({ bloque }: { bloque: Datos }) {
  const reducir = useReducedMotion()
  const derecha = valorDe(bloque, 'lado') === 'derecha'
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

  const pie = bloque.pasos[activa]?.foto.pie ?? ''

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
        columnGap: { md: 8 },
        maxWidth: anchoMaximo(bloque, '1200px'),
        mx: 'auto',
      }}
    >
      <Box
        sx={{
          position: 'sticky', top: { xs: 72, md: 112 }, alignSelf: 'start', zIndex: 2,
          order: { md: derecha ? 2 : 0 },
          height: { xs: '40svh', md: 'calc(100svh - 160px)' }, maxHeight: 760, overflow: 'hidden',
          backgroundColor: '#0c0b0d',
        }}
      >
        {bloque.pasos.map((paso, i) => (
          <Box
            // Clave posicional: una parte no tiene identificador, y la foto no guarda estado.
            key={i}
            component="img"
            {...propsDeFoto(paso.foto.url, '(min-width: 900px) 50vw, 100vw')}
            alt={paso.foto.alt}
            aria-hidden={i === activa ? undefined : true}
            loading={i === 0 ? undefined : 'lazy'}
            decoding="async"
            sx={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
              opacity: i === activa ? 1 : 0,
              transform: i === activa || reducir ? 'none' : 'scale(1.06)',
              transition: reducir ? 'none' : 'opacity 1s ease, transform 1.6s cubic-bezier(.2, .8, .2, 1)',
            }}
          />
        ))}
        {pie !== '' && (
          <Typography
            component="span"
            aria-hidden="true"
            sx={{ ...ceja, position: 'absolute', left: 16, bottom: 14, mb: 0, fontSize: 12, letterSpacing: '0.12em', textShadow: '0 1px 8px rgba(0,0,0,.8)' }}
          >
            {pie}
          </Typography>
        )}
      </Box>

      <Box>
        {bloque.pasos.map((paso, i) => (
          <Box
            key={i}
            component="section"
            ref={(el: HTMLElement | null) => { partes.current[i] = el }}
            sx={{
              minHeight: { xs: '60svh', md: '75svh' },
              display: 'flex', flexDirection: 'column', justifyContent: 'center', py: 4,
              opacity: i === activa ? 1 : 0.35,
              transition: reducir ? 'none' : 'opacity .6s ease',
            }}
          >
            {paso.titulo !== '' && (
              <Typography component="h3" sx={{ fontFamily: SERIF, fontSize: { xs: 26, md: 30 }, lineHeight: 1.2, letterSpacing: '-0.01em', mb: 2 }}>
                {paso.titulo}
              </Typography>
            )}
            {parrafosDe(paso.texto).map((parrafo, j) => (
              <Typography key={j} sx={{ color: 'text.secondary', fontSize: { xs: 16, md: 17 }, lineHeight: 1.75, maxWidth: '52ch', mb: 2.5, '&:last-of-type': { mb: 0 } }}>
                {parrafo}
              </Typography>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
