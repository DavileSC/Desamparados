import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Typography, useMediaQuery } from '@mui/material'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { SERIF } from '../../features/inicio/estilos'
import { esDestinoValido } from '../../lib/destinos'
import { useModoEdicion } from './modoEdicion'
import { anchoMaximo } from './presentacion'
import { enlaceEsmalte } from '../esmalte'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import type { BloqueAnillos as Datos, FinDeAnillo } from '../../lib/api/contenido'

/** El color de cada anillo, en orden: oro, rosa y crema. Pensados para fondo oscuro. */
const COLORES = ['#dec72b', '#fc858a', '#e8dfcf'] as const

/**
 * El dibujo, en unidades de un lienzo de 1100 × 700: los tres centros, el radio
 * y, de cada anillo, el punto por donde sale su hilo y hasta dónde llega.
 */
const R = 170
const ANILLOS = [
  { cx: 550, cy: 340, hilo: 'M550 170 V128' },
  { cx: 462, cy: 492, hilo: 'M292 492 H240' },
  { cx: 638, cy: 492, hilo: 'M808 492 H860' },
] as const
const PUNTOS = [[550, 170], [292, 492], [808, 492]] as const

/**
 * Tres anillos entrelazados, uno por fin (culto, caridad y formación), que no
 * se entienden por separado: la cruz y una palabra en el cruce de los tres, y
 * cada fin fuera de su anillo, unido a él por un hilo de su color.
 *
 * Al llegar, los anillos se dibujan uno tras otro, luego salen los hilos y al
 * final los textos. Pasar por un fin (o llegar a él con el tabulador) enciende
 * su anillo y apaga los otros dos. Con «reducir movimiento», o en la vista del
 * constructor, sale todo quieto y a la vista.
 *
 * En el móvil no caben los textos alrededor: los anillos van arriba, más
 * pequeños, y los fines en lista debajo, cada uno con el filete de su color.
 */
export default function BloqueAnillos({ bloque }: { bloque: Datos }) {
  const marco = useRef<HTMLDivElement>(null)
  const aLaVista = useInView(marco, { once: true, amount: 0.3 })
  const reducir = useReducedMotion()
  const enConstructor = useModoEdicion() !== null
  const quieto = Boolean(reducir) || enConstructor
  const vivo = quieto || aLaVista
  const escritorio = useMediaQuery('(min-width: 900px)')
  const [activo, setActivo] = useState<number | null>(null)

  const anillos = (
    <>
      {ANILLOS.map((anillo, i) => {
        const apagado = activo !== null && activo !== i
        return (
          // El brillo y el grueso van en el grupo y el anillo los hereda: framer-motion
          // no vuelve a aplicar el estilo de un círculo mientras anima su trazo.
          <g key={i} style={{
            fillOpacity: activo === i ? 0.08 : 0,
            strokeOpacity: apagado ? 0.3 : 1,
            strokeWidth: activo === i ? 3 : 2,
            transition: 'fill-opacity .35s, stroke-opacity .35s, stroke-width .35s',
          }}>
            <motion.circle cx={anillo.cx} cy={anillo.cy} r={R} fill={COLORES[i]} stroke={COLORES[i]}
              initial={quieto ? false : { pathLength: 0 }}
              animate={vivo ? { pathLength: 1 } : undefined}
              transition={{ duration: 1.2, delay: i * 0.25, ease: [0.45, 0.05, 0.4, 1] }} />
          </g>
        )
      })}
      <motion.path d="M550 380 v44 M534 396 h32" stroke={COLORES[0]} strokeWidth={2} strokeLinecap="round" fill="none"
        initial={quieto ? false : { opacity: 0 }} animate={vivo ? { opacity: 1 } : undefined} transition={{ duration: 0.6, delay: 1.1 }} />
    </>
  )

  return (
    <Box ref={marco} sx={{ maxWidth: anchoMaximo(bloque, '1100px'), mx: 'auto' }}>
      {escritorio ? (
        <Box sx={{ position: 'relative', aspectRatio: '1100 / 700' }}>
          <Box component="svg" viewBox="0 0 1100 700" aria-hidden sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
            {anillos}
            {ANILLOS.map((anillo, i) => (
              <g key={i}>
                <motion.path d={anillo.hilo} stroke={COLORES[i]} strokeDasharray="3 6" fill="none"
                  initial={quieto ? false : { opacity: 0 }} animate={vivo ? { opacity: 1 } : undefined}
                  transition={{ duration: 0.5, delay: 1.2 + i * 0.12 }} />
                <motion.circle cx={PUNTOS[i][0]} cy={PUNTOS[i][1]} r={4} fill={COLORES[i]}
                  initial={quieto ? false : { scale: 0 }} animate={vivo ? { scale: 1 } : undefined}
                  transition={{ duration: 0.4, delay: 1.2 + i * 0.12 }} />
              </g>
            ))}
          </Box>
          {bloque.centro && (
            <Typography component="span" sx={{
              position: 'absolute', left: '50%', top: '63.4%', transform: 'translateX(-50%)',
              fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#c4af79', whiteSpace: 'nowrap',
            }}>
              {bloque.centro}
            </Typography>
          )}
          {bloque.fines.map((fin, i) => (
            // La caja de fuera pone el texto en su sitio (con su transform) y la de
            // dentro lo anima: si fueran la misma, la animación pisaría el transform.
            <Box key={i} sx={{ position: 'absolute', ...SITIOS[i] }}
              onMouseEnter={() => setActivo(i)} onMouseLeave={() => setActivo(null)}
              onFocus={() => setActivo(i)} onBlur={() => setActivo(null)}>
              <Box component={motion.div}
                initial={quieto ? false : { opacity: 0, y: 12 }} animate={vivo ? { opacity: 1, y: 0 } : undefined}
                transition={{ duration: 0.6, delay: 1.35 + i * 0.15 }}>
                <Fin fin={fin} color={COLORES[i]} alineacion={ALINEACIONES[i]} apagado={activo !== null && activo !== i} />
              </Box>
            </Box>
          ))}
        </Box>
      ) : (
        <>
          <Box component="svg" viewBox="272 150 556 532" aria-hidden sx={{ display: 'block', width: '100%', maxWidth: 340, mx: 'auto', overflow: 'visible' }}>
            {anillos}
          </Box>
          {bloque.centro && (
            <Typography component="span" sx={{ display: 'block', textAlign: 'center', mt: 1.5, fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#c4af79' }}>
              {bloque.centro}
            </Typography>
          )}
          <Box sx={{ display: 'grid', gap: 4, mt: 5 }}>
            {bloque.fines.map((fin, i) => (
              <Box key={i} sx={{ pt: 2.5, borderTop: '2px solid', borderColor: COLORES[i] }}>
                <Fin fin={fin} color={COLORES[i]} alineacion="left" apagado={false} />
              </Box>
            ))}
          </Box>
        </>
      )}
      {bloque.texto && (
        <Typography sx={{ mt: { xs: 5, md: 2 }, mx: 'auto', maxWidth: 700, textAlign: { md: 'center' }, color: 'text.secondary', fontSize: 17, lineHeight: 1.7 }}>
          {bloque.texto}
        </Typography>
      )}
    </Box>
  )
}

/** Dónde va el texto de cada fin en escritorio, en tantos por ciento del lienzo. */
const SITIOS = [
  { left: '50%', top: 0, width: '42%', transform: 'translateX(-50%)' },
  { left: 0, top: '70.3%', width: '20.5%', transform: 'translateY(-50%)' },
  { left: '79.1%', top: '70.3%', width: '20.9%', transform: 'translateY(-50%)' },
] as const
const ALINEACIONES = ['center', 'right', 'left'] as const

function Fin({ fin, color, alineacion, apagado }: { fin: FinDeAnillo; color: string; alineacion: 'left' | 'center' | 'right'; apagado: boolean }) {
  const conBoton = fin.boton.trim() !== '' && esDestinoValido(fin.enlace)
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', gap: 1.25, textAlign: alineacion,
      alignItems: { left: 'flex-start', center: 'center', right: 'flex-end' }[alineacion],
      opacity: apagado ? 0.5 : 1, transition: 'opacity .35s',
    }}>
      <Typography component="h3" sx={{ fontFamily: SERIF, fontSize: { xs: 28, md: 30 }, lineHeight: 1.15, color }}>{fin.titulo}</Typography>
      {fin.texto && <Typography sx={{ color: 'text.secondary', fontSize: 15, lineHeight: 1.65 }}>{fin.texto}</Typography>}
      {conBoton && (
        <Box component={Link} to={fin.enlace} sx={{
          ...enlaceEsmalte, mt: 0.5, color, '& svg': { ...enlaceEsmalte['& svg'], color }, '&:hover': { color: '#fff' },
        }}>
          {fin.boton} <ArrowForwardIcon aria-hidden />
        </Box>
      )}
    </Box>
  )
}
