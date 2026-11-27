import { useRef } from 'react'
import { Box, Typography } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import { useInView, useReducedMotion } from 'framer-motion'
import { useModoEdicion } from './modoEdicion'
import { SERIF } from '../../features/inicio/estilos'
import { anchoMaximo, valorDe } from './presentacion'
import type { BloqueCita as Datos } from '../../lib/api/contenido'
import { propsDeFoto } from '../../lib/fotoSubida'
import { useFotoQueFalla } from '../../hooks/useFotoQueFalla'
import { MARCA } from '../../theme/marca'

/**
 * Unas palabras destacadas y de quién son: en serif con comillas (clásica),
 * a tamaño de titular (grande), entre dos filetes dorados a lo ancho (franja)
 * o en letra fina que se enfoca palabra a palabra al llegar a ella (enfoque,
 * el Blur Text de React Bits). La lámina la pone al lado de una foto vieja, en
 * sepia, como la estampa de la página de enfrente en un libro de horas.
 *
 * Va en un `<figure>` con su `<blockquote>` y su `<figcaption>`: es la forma
 * de decirle a un lector de pantalla que esto es una cita y quién la firma.
 */
const nitida = keyframes`from { filter: blur(10px); opacity: 0 } to { filter: none; opacity: 1 }`

/** Cuánto espera cada palabra a la anterior al enfocarse. */
const ENTRE_PALABRAS_S = 0.08

/** El texto de la cita «enfoque»: cada palabra se aclara tras la anterior, una sola vez. */
function TextoQueSeEnfoca({ texto }: { texto: string }) {
  const caja = useRef<HTMLSpanElement>(null)
  const aLaVista = useInView(caja, { once: true, amount: 0.5 })
  const reducir = useReducedMotion()
  const enConstructor = useModoEdicion() !== null
  const quieto = Boolean(reducir) || enConstructor
  const palabras = texto.split(/\s+/).filter(Boolean)
  return (
    <Box component="span" ref={caja}>
      {palabras.map((palabra, i) => (
        <Box key={i} component="span" sx={{
          display: 'inline-block', whiteSpace: 'pre',
          ...(quieto ? {} : aLaVista
            ? { animation: `${nitida} .9s ease-out ${i * ENTRE_PALABRAS_S}s both` }
            : { opacity: 0 }),
        }}>
          {i < palabras.length - 1 ? `${palabra} ` : palabra}
        </Box>
      ))}
    </Box>
  )
}

/** La cita con su foto en sepia al lado; sin foto, la cita sola, centrada. */
function Lamina({ bloque, firma }: { bloque: Datos; firma: string }) {
  const { visible, alFallar } = useFotoQueFalla(bloque.foto ?? '')
  const conFoto = visible
  return (
    <Box sx={{
      maxWidth: anchoMaximo(bloque, conFoto ? '1200px' : '820px'), mx: 'auto',
      display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: conFoto ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)' },
      gap: { xs: 5, md: 8 }, alignItems: 'center',
    }}>
      {conFoto && (
        <Box component="figure" sx={{ m: 0 }}>
          <Box component="img" {...propsDeFoto(bloque.foto ?? '', '(min-width: 900px) 600px, 100vw', alFallar)} alt={bloque.fotoAlt ?? ''} loading="lazy" decoding="async"
            sx={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', filter: 'grayscale(1) contrast(1.05) sepia(.25)' }} />
          {bloque.pie && (
            <Typography component="figcaption" sx={{ mt: 1.25, fontSize: 14, fontStyle: 'italic', color: 'text.secondary' }}>{bloque.pie}</Typography>
          )}
        </Box>
      )}
      <Box component="figure" sx={{ m: 0, textAlign: 'center' }}>
        {/* Tres rombos de adorno, dibujados y no escritos: un florón (❦) cae en
            la letra de emojis en muchos equipos y sale en color. */}
        <Box aria-hidden sx={{ display: 'flex', justifyContent: 'center', gap: 2.25 }}>
          {[0, 1, 2].map((i) => <Box key={i} sx={{ width: 7, height: 7, backgroundColor: MARCA.acento, transform: 'rotate(45deg)' }} />)}
        </Box>
        <Box component="blockquote" sx={{ m: 0, my: 2.5 }}>
          <Typography sx={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: { xs: 26, md: 36 }, lineHeight: 1.25, color: MARCA.acento, textWrap: 'balance' }}>
            {bloque.texto}
          </Typography>
        </Box>
        {firma && (
          <Typography component="figcaption" sx={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'text.primary' }}>
            {firma}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

export default function BloqueCita({ bloque }: { bloque: Datos }) {
  const estilo = valorDe(bloque, 'estilo')
  const enfoque = estilo === 'enfoque'
  const izquierda = valorDe(bloque, 'alineacion') === 'izquierda'
  const grande = estilo === 'grande' || enfoque
  const firma = [bloque.autor, bloque.fuente].filter((p) => p.trim() !== '').join(', ')
  if (estilo === 'lamina') return <Lamina bloque={bloque} firma={firma} />

  return (
    <Box component="figure" sx={{
      m: 0, mx: 'auto', maxWidth: anchoMaximo(bloque, enfoque ? '1200px' : grande ? '1000px' : '820px'), textAlign: izquierda ? 'left' : 'center',
      // El acento del tema y no el oro a mano: sobre una franja de papel pasa a granate y se lee.
      ...(estilo === 'franja' && { py: { xs: 4, md: 5 }, borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'secondary.main' }),
    }}>
      {estilo === 'clasica' && (
        <Typography aria-hidden sx={{ fontFamily: SERIF, fontSize: 88, lineHeight: 0.6, color: 'secondary.main', mb: 1, height: 44 }}>“</Typography>
      )}
      <Box component="blockquote" sx={{ m: 0 }}>
        <Typography sx={{
          fontFamily: SERIF, color: 'text.primary', lineHeight: enfoque ? 1.3 : 1.35, letterSpacing: '-0.01em',
          fontSize: grande ? { xs: 30, md: enfoque ? 44 : 46 } : { xs: 22, md: 28 },
          fontStyle: grande ? 'normal' : 'italic',
          fontWeight: enfoque ? 200 : undefined,
        }}>
          {enfoque ? <TextoQueSeEnfoca texto={bloque.texto} /> : bloque.texto}
        </Typography>
      </Box>
      {firma && (
        <Typography component="figcaption" sx={{ mt: 2.5, color: 'secondary.main', fontSize: 13, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          {firma}
        </Typography>
      )}
    </Box>
  )
}
