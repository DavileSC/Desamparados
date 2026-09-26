import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { SERIF, ceja } from '../../features/inicio/estilos'
import { anchoMaximo } from './presentacion'
import type { BloqueCarrusel as Datos, PiezaDeCarrusel } from '../../lib/api/contenido'

/** Oro apagado de la familia de la pieza, el mismo de la relación de cargos. */
const ORO_SUAVE = '#c4af79'
/** Lo que hay que deslizar el dedo sobre la foto para pasar de pieza. */
const DESLIZ = 50

const dos = (n: number) => String(n).padStart(2, '0')

/**
 * Carrusel de piezas: una cada vez, con la foto grande a un lado y, al otro, la
 * familia, el nombre, su historia y la cartela. Abajo, un contador discreto y
 * dos flechas; también se pasa con las flechas del teclado o deslizando la foto
 * en el móvil. Sin arrastrar con el ratón ni índice de capítulos: sobrio.
 *
 * Todas las fotos están montadas desde el principio, apiladas, y cambian con un
 * fundido lento: así el paso no espera a la red. Con «reducir movimiento»
 * cambian igual, sin fundido.
 */
export default function BloqueCarrusel({ bloque }: { bloque: Datos }) {
  const reducir = useReducedMotion()
  const [activa, setActiva] = useState(0)
  const inicio = useRef<number | null>(null)
  const total = bloque.piezas.length
  // El bloque puede llegar con menos piezas después de editarlo.
  const actual = Math.min(activa, total - 1)
  const pieza = bloque.piezas[actual]

  const ir = (salto: number) => setActiva((a) => (Math.min(a, total - 1) + salto + total) % total)

  const teclas = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { ir(1); e.preventDefault() }
    if (e.key === 'ArrowLeft') { ir(-1); e.preventDefault() }
  }
  // Solo el dedo: con el ratón se pasa con las flechas.
  const empieza = (e: PointerEvent) => { if (e.pointerType !== 'mouse') inicio.current = e.clientX }
  const acaba = (e: PointerEvent) => {
    if (inicio.current === null) return
    const recorrido = e.clientX - inicio.current
    inicio.current = null
    if (Math.abs(recorrido) > DESLIZ) ir(recorrido < 0 ? 1 : -1)
  }

  return (
    <Box
      role="region"
      aria-roledescription="carrusel"
      aria-label={bloque.titulo || 'Piezas'}
      tabIndex={0}
      onKeyDown={teclas}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.45fr) minmax(0, 1fr)' },
        gap: { xs: 4, md: 9 },
        maxWidth: anchoMaximo(bloque, '1200px'),
        mx: 'auto',
        outline: 'none',
        '&:focus-visible': { outline: '2px solid #dec72b', outlineOffset: 8 },
      }}
    >
      <Box
        onPointerDown={empieza}
        onPointerUp={acaba}
        onPointerCancel={() => { inicio.current = null }}
        sx={{
          position: 'relative', overflow: 'hidden', backgroundColor: '#0c0b0d', touchAction: 'pan-y',
          aspectRatio: { xs: '4 / 5', md: 'auto' },
          height: { md: 'min(72svh, 680px)' }, minHeight: { md: 440 },
        }}
      >
        {bloque.piezas.map((p, i) => (
          <Box
            // Clave posicional: una pieza no tiene identificador, y la foto no guarda estado.
            key={i}
            component="img"
            src={p.foto.url}
            alt={p.foto.alt}
            aria-hidden={i === actual ? undefined : true}
            // La que se ve y sus dos vecinas, ya cargadas: así la flecha no enseña un hueco.
            loading={Math.abs(i - actual) <= 1 || (actual === 0 && i === total - 1) ? 'eager' : 'lazy'}
            decoding="async"
            draggable={false}
            sx={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
              opacity: i === actual ? 1 : 0,
              transform: i === actual || reducir ? 'none' : 'scale(1.035)',
              transition: reducir ? 'none' : 'opacity 1.1s ease, transform 2.4s cubic-bezier(.2, .6, .2, 1)',
            }}
          />
        ))}
        {pieza.foto.pie !== '' && (
          <Typography
            component="span"
            sx={{ ...ceja, position: 'absolute', left: 16, bottom: 14, right: 16, mb: 0, fontSize: 11, letterSpacing: '0.08em', textTransform: 'none', color: 'rgba(255,255,255,.72)', textShadow: '0 1px 8px rgba(0,0,0,.9)' }}
          >
            {pieza.foto.pie}
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 4, py: { md: 1 } }}>
        <Box aria-live="polite" sx={{ minHeight: { md: 320 } }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={actual}
              initial={reducir ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducir ? undefined : { opacity: 0, y: 8 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <Ficha pieza={pieza} />
            </motion.div>
          </AnimatePresence>
        </Box>

        {total > 1 && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography component="span" sx={{ fontSize: 13, letterSpacing: '0.08em', color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
              <Box component="span" sx={{ color: 'text.primary' }}>{dos(actual + 1)}</Box> / {dos(total)}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Flecha etiqueta="Pieza anterior" onClick={() => ir(-1)}>←</Flecha>
              <Flecha etiqueta="Pieza siguiente" onClick={() => ir(1)}>→</Flecha>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  )
}

function Ficha({ pieza }: { pieza: PiezaDeCarrusel }) {
  return (
    <>
      {pieza.familia !== '' && (
        <Typography component="span" sx={{ display: 'block', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: ORO_SUAVE }}>
          {pieza.familia}
        </Typography>
      )}
      <Typography component="h3" sx={{ fontFamily: SERIF, fontWeight: 400, fontSize: { xs: 30, md: 42 }, lineHeight: 1.08, letterSpacing: '-0.015em', textWrap: 'balance', mt: 1.75 }}>
        {pieza.titulo}
      </Typography>
      {pieza.texto !== '' && (
        <Typography sx={{ mt: 2.25, color: 'text.secondary', fontSize: { xs: 16, md: 17 }, lineHeight: 1.7, maxWidth: '40ch' }}>
          {pieza.texto}
        </Typography>
      )}
      {pieza.datos.length > 0 && (
        <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: 3, rowGap: 0.75, m: 0, mt: 3.25, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          {pieza.datos.map((dato, i) => (
            <Box key={i} sx={{ display: 'contents' }}>
              <Typography component="dt" sx={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.disabled', pt: '3px' }}>
                {dato.etiqueta}
              </Typography>
              <Typography component="dd" sx={{ m: 0, fontSize: 14, color: 'text.primary' }}>{dato.valor}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </>
  )
}

function Flecha({ etiqueta, onClick, children }: { etiqueta: string; onClick: () => void; children: string }) {
  return (
    <ButtonBase
      aria-label={etiqueta}
      onClick={onClick}
      sx={{
        width: 44, height: 44, fontSize: 22, fontWeight: 300, color: 'text.secondary', transition: 'color .3s ease',
        '&:hover': { color: 'text.primary' },
        '&:focus-visible': { outline: '2px solid #dec72b', outlineOffset: 2 },
      }}
    >
      <span aria-hidden="true">{children}</span>
    </ButtonBase>
  )
}
