import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion'
import { GOLD, GRANATE } from '../../features/inicio/estilos'
import { useModoEdicion } from './modoEdicion'
import { anchoMaximo } from './presentacion'
import { posicionesEnRuta, puntoEn, puntosSvg } from './recorrido'
import type { BloqueItinerario, PuntoDePlano } from '../../lib/api/contenido'

/** A qué altura de la pantalla (0 arriba, 1 abajo) se da por alcanzada una parada. */
const LINEA_DE_LECTURA = 0.55
/** El fondo de la página: el hueco de los puntos sin alcanzar se rellena con él. */
const FONDO = '#262326'
const GRANATE_CLARO = '#fc858a'

/**
 * El itinerario sobre el plano: a un lado el plano, quieto mientras se lee, y
 * al otro las paradas con su hora. Según se baja por las horas, la línea del
 * recorrido se va dibujando sobre el plano y el trono (un punto granate) llega
 * a cada parada; si se sube, vuelve atrás. Entre dos paradas avanza en
 * proporción a lo que se ha bajado entre ellas.
 *
 * Con «reducir movimiento», o en la vista en vivo del constructor, el recorrido
 * sale dibujado entero y todas las paradas encendidas.
 *
 * El plano es la foto que se sube desde el CMS y el trazado son sus puntos en
 * tanto por ciento, así que el dibujo encaja a cualquier tamaño. Para medir
 * hace falta la proporción de la foto, que se lee al cargarla: hasta entonces
 * se ve la foto sola.
 */
export default function RecorridoEnPlano({ bloque }: { bloque: BloqueItinerario & { plano: { url: string; alt: string }; trazado: PuntoDePlano[] } }) {
  const { plano, trazado, paradas } = bloque
  const reducir = useReducedMotion()
  const enConstructor = useModoEdicion() !== null
  const vivo = !reducir && !enConstructor

  const [aspecto, setAspecto] = useState<number | null>(null)
  const mideFoto = useCallback(() => {
    const img = foto.current
    if (img && img.complete && img.naturalHeight > 0) setAspecto(img.naturalWidth / img.naturalHeight)
  }, [])
  const posiciones = useMemo(() => posicionesEnRuta(paradas), [paradas])
  const [alcanzada, setAlcanzada] = useState(-1)
  const encendidas = vivo ? alcanzada : paradas.length - 1

  const lista = useRef<HTMLOListElement>(null)
  const foto = useRef<HTMLImageElement>(null)
  const linea = useRef<SVGPathElement>(null)
  const trono = useRef<HTMLDivElement>(null)

  // La línea y el trono se mueven tocando el DOM, no con estado: se recalcula
  // en cada fotograma de scroll y repintar el bloque entero cada vez sobraría.
  // El estado solo cambia cuando se alcanza otra parada.
  const recalcula = useCallback(() => {
    const ol = lista.current
    if (!vivo || !ol || aspecto === null) return
    const filas = Array.from(ol.children) as HTMLElement[]
    const altura = window.innerHeight * LINEA_DE_LECTURA
    const topes = filas.map((fila) => fila.getBoundingClientRect().top + 24)
    let ultima = -1
    topes.forEach((tope, i) => { if (tope < altura) ultima = i })

    let fraccion = posiciones[0] ?? 0
    if (ultima === filas.length - 1) fraccion = posiciones[ultima]
    else if (ultima >= 0) {
      const t = Math.min(1, Math.max(0, (altura - topes[ultima]) / (topes[ultima + 1] - topes[ultima])))
      fraccion = posiciones[ultima] + t * (posiciones[ultima + 1] - posiciones[ultima])
    }

    linea.current?.style.setProperty('stroke-dashoffset', String(1 - fraccion))
    const punto = puntoEn(trazado, aspecto, fraccion)
    if (trono.current) {
      trono.current.style.left = `${punto.x}%`
      trono.current.style.top = `${punto.y}%`
    }
    setAlcanzada(ultima)
  }, [vivo, aspecto, posiciones, trazado])

  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, 'change', recalcula)
  useEffect(recalcula, [recalcula])
  // Una foto que ya estaba en la caché puede haber cargado antes de que React
  // escuchara su `load`: se mide también al montar.
  useEffect(mideFoto, [mideFoto, plano.url])

  const actual = encendidas >= 0 ? paradas[encendidas] : null

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.35fr) minmax(0, 1fr)' },
        columnGap: { md: 6 },
        maxWidth: anchoMaximo(bloque, '1200px'),
        mx: 'auto',
      }}
    >
      {/* El plano, quieto mientras se leen las paradas. En el móvil va arriba,
          pegado bajo la barra, y las paradas pasan por debajo. */}
      <Box sx={{ position: 'sticky', top: { xs: 72, md: 104 }, alignSelf: 'start', zIndex: 2, mb: { xs: 3, md: 0 } }}>
        <Box sx={{ position: 'relative', overflow: 'hidden', border: '1px solid rgba(204, 196, 201, 0.14)' }}>
          <Box
            component="img"
            src={plano.url}
            alt={plano.alt}
            decoding="async"
            ref={foto}
            onLoad={mideFoto}
            // Velado: la línea tiene que leerse por encima de cualquier foto de satélite.
            sx={{ display: 'block', width: '100%', height: 'auto', filter: 'brightness(.52) saturate(.65)' }}
          />
          {aspecto !== null && (
            <>
              <Box
                component="svg"
                aria-hidden="true"
                viewBox={`0 0 ${100 * aspecto} 100`}
                sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
              >
                {/* El recorrido entero, apenas marcado: lo que falta por andar. */}
                <polyline points={puntosSvg(trazado, aspecto)} fill="none" stroke="rgba(255, 255, 255, .3)" strokeWidth={0.45} strokeDasharray="0.8 1" strokeLinecap="round" strokeLinejoin="round" />
                <path
                  ref={linea}
                  d={`M ${puntosSvg(trazado, aspecto).split(' ').join(' L ')}`}
                  pathLength={1}
                  fill="none"
                  stroke={GOLD}
                  strokeWidth={0.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ strokeDasharray: 1, strokeDashoffset: vivo ? 1 : 0, filter: 'drop-shadow(0 0 0.6px rgba(222, 199, 43, .8))' }}
                />
              </Box>
              {posiciones.map((fraccion, i) => {
                const punto = puntoEn(trazado, aspecto, fraccion)
                const hecha = i <= encendidas
                return (
                  <Box
                    key={i}
                    aria-hidden="true"
                    sx={{
                      position: 'absolute', left: `${punto.x}%`, top: `${punto.y}%`,
                      width: 11, height: 11, borderRadius: '50%', transform: 'translate(-50%, -50%)',
                      border: `2px solid ${hecha ? GOLD : '#cbc5c8'}`, backgroundColor: hecha ? GOLD : FONDO,
                      transition: 'background-color .3s, border-color .3s',
                    }}
                  />
                )
              })}
              {vivo && (
                <Box
                  ref={trono}
                  aria-hidden="true"
                  sx={{
                    position: 'absolute', width: 16, height: 16, borderRadius: '50%', transform: 'translate(-50%, -50%)',
                    backgroundColor: GRANATE, border: `2px solid ${GRANATE_CLARO}`, boxShadow: '0 0 0 6px rgba(252, 133, 138, .22)',
                    // Hasta la primera medida, en la salida.
                    left: `${puntoEn(trazado, aspecto, posiciones[0] ?? 0).x}%`,
                    top: `${puntoEn(trazado, aspecto, posiciones[0] ?? 0).y}%`,
                  }}
                />
              )}
            </>
          )}
          {/* Por dónde va: la última parada alcanzada. La lista ya lo dice para
              quien usa un lector de pantalla; esto es solo la vista. */}
          {vivo && actual && (
            <Box aria-hidden="true" sx={{ position: 'absolute', left: 12, top: 12, maxWidth: 'calc(100% - 24px)', px: 1.5, py: 0.75, backgroundColor: 'rgba(16, 14, 17, .85)', borderLeft: `2px solid ${GOLD}` }}>
              <Typography sx={{ fontSize: 13, color: '#fff', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <Box component="span" sx={{ color: GOLD, fontWeight: 700, mr: 1 }}>{actual.hora}</Box>{actual.lugar}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Box component="ol" ref={lista} sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {paradas.map((parada, i) => (
          <Box
            component="li"
            // El itinerario repite lugares: la clave necesita el índice.
            key={`${parada.hora}-${parada.lugar}-${i}`}
            sx={{
              display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr)', columnGap: 2, alignItems: 'baseline',
              py: { xs: 3.5, md: 4.5 }, borderBottom: '1px solid rgba(204, 196, 201, 0.14)',
              opacity: i <= encendidas ? 1 : 0.4, transition: 'opacity .5s ease',
            }}
          >
            <Typography component="span" sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 300, lineHeight: 1.1, color: '#e3d8bf', fontVariantNumeric: 'tabular-nums' }}>
              {parada.hora}
            </Typography>
            <Typography component="span" sx={{ fontSize: { xs: 17, md: 19 }, color: 'text.primary' }}>{parada.lugar}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
