import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Box, ButtonBase, Drawer, Typography, useMediaQuery, useTheme } from '@mui/material'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { SERIF, ceja } from '../../features/inicio/estilos'
import { anchoMaximo } from './presentacion'
import type { BloqueCarrusel as Datos, PiezaDeCarrusel } from '../../lib/api/contenido'
import { propsDeFoto } from '../../lib/fotoSubida'

/** Oro apagado de la familia de la pieza, el mismo de la relación de cargos. */
const ORO_SUAVE = '#c4af79'
/** Lo que hay que deslizar el dedo sobre la foto para pasar de pieza. */
const DESLIZ = 50

const dos = (n: number) => String(n).padStart(2, '0')

/** Lo que se lleva la barra fija de la web en el móvil (la del Toolbar de MUI). */
const BARRA_MOVIL = { xs: 56, sm: 64 }

/**
 * Carrusel de piezas: una cada vez, con la foto grande a un lado y, al otro, la
 * familia, el nombre, su historia y la cartela. Abajo, un contador discreto y
 * dos flechas; también se pasa con las flechas del teclado o deslizando la foto
 * en el móvil. Sin arrastrar con el ratón ni índice de capítulos: sobrio.
 *
 * Todas las fotos están montadas desde el principio, apiladas, y cambian con un
 * fundido lento: así el paso no espera a la red. Con «reducir movimiento»
 * cambian igual, sin fundido.
 *
 * En el móvil y la tableta en vertical, foto, ficha y flechas apiladas no caben
 * en la pantalla (en un móvil normal, ~900 px de ~670): allí la foto la llena y
 * la ficha va encima, sobre un velo; el texto entero y los datos, en una hoja
 * que sube con «Ver cartela».
 */
export default function BloqueCarrusel({ bloque }: { bloque: Datos }) {
  const theme = useTheme()
  const movil = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true })
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

  if (movil) {
    return <CarruselMovil {...{ bloque, actual, pieza, total, ir, teclas, empieza, acaba, inicio, reducir: !!reducir }} />
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
            {...propsDeFoto(p.foto.url, '(min-width: 900px) 100vw, 190vw')}
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
            <m.div
              key={actual}
              initial={reducir ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducir ? undefined : { opacity: 0, y: 8 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <Ficha pieza={pieza} />
            </m.div>
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

interface PropsMovil {
  bloque: Datos
  actual: number
  pieza: PiezaDeCarrusel
  total: number
  ir: (salto: number) => void
  teclas: (e: KeyboardEvent) => void
  empieza: (e: PointerEvent) => void
  acaba: (e: PointerEvent) => void
  inicio: { current: number | null }
  reducir: boolean
}

function CarruselMovil({ bloque, actual, pieza, total, ir, teclas, empieza, acaba, inicio, reducir }: PropsMovil) {
  const [cartela, setCartela] = useState(false)
  const idTitulo = useId()
  const hayCartela = pieza.texto !== '' || pieza.datos.length > 0

  return (
    <>
    <Box
      role="region"
      aria-roledescription="carrusel"
      aria-label={bloque.titulo || 'Piezas'}
      tabIndex={0}
      onKeyDown={teclas}
      onPointerDown={empieza}
      onPointerUp={acaba}
      onPointerCancel={() => { inicio.current = null }}
      sx={{
        position: 'relative', overflow: 'hidden', backgroundColor: '#0c0b0d', touchAction: 'pan-y', outline: 'none',
        // A sangre, de borde a borde, y del alto de la pantalla menos la barra fija;
        // en una tableta en vertical, sin pasar de 4:5 para no quedar en una torre.
        mx: 'calc(50% - 50vw)',
        height: {
          xs: `min(calc(100svh - ${BARRA_MOVIL.xs}px), 125vw)`,
          sm: `min(calc(100svh - ${BARRA_MOVIL.sm}px), 125vw)`,
        },
        minHeight: 460,
        '&:focus-visible': { outline: '2px solid #dec72b', outlineOffset: -2 },
      }}
    >
      {bloque.piezas.map((p, i) => (
        <Box
          key={i}
          component="img"
          {...propsDeFoto(p.foto.url, '(min-width: 900px) 100vw, 190vw')}
          alt={p.foto.alt}
          aria-hidden={i === actual ? undefined : true}
          loading={Math.abs(i - actual) <= 1 || (actual === 0 && i === total - 1) ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          sx={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            opacity: i === actual ? 1 : 0,
            transition: reducir ? 'none' : 'opacity 1.1s ease',
          }}
        />
      ))}
      {/* El velo que deja leer la ficha sobre cualquier foto. */}
      <Box aria-hidden="true" sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%', pointerEvents: 'none', background: 'linear-gradient(to top, rgba(10,9,11,.97) 30%, rgba(10,9,11,.7) 62%, rgba(10,9,11,0))' }} />

      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, px: '20px', pb: 2.25, display: 'flex', flexDirection: 'column', gap: 1.75, color: '#f3efe9' }}>
        <Box aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <m.div
              key={actual}
              initial={reducir ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducir ? undefined : { opacity: 0, y: 8 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              {pieza.familia !== '' && (
                <Typography component="span" sx={{ display: 'block', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: ORO_SUAVE }}>
                  {pieza.familia}
                </Typography>
              )}
              <Typography component="h3" sx={{ fontFamily: SERIF, fontWeight: 400, fontSize: 28, lineHeight: 1.08, letterSpacing: '-0.015em', textWrap: 'balance', mt: 1, textShadow: '0 2px 14px rgba(0,0,0,.6)' }}>
                {pieza.titulo}
              </Typography>
              {pieza.texto !== '' && (
                <Typography sx={{ mt: 1.25, fontSize: 15.5, lineHeight: 1.6, color: 'rgba(243,239,233,.8)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {pieza.texto}
                </Typography>
              )}
              {hayCartela && (
                <ButtonBase
                  onClick={() => setCartela(true)}
                  sx={{ mt: 1, minHeight: 32, fontSize: 13, fontWeight: 500, letterSpacing: '0.04em', color: ORO_SUAVE, '&:focus-visible': { outline: '2px solid #dec72b', outlineOffset: 2 } }}
                >
                  Ver cartela
                </ButtonBase>
              )}
            </m.div>
          </AnimatePresence>
        </Box>

        {total > 1 && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, pt: 0.75, borderTop: '1px solid rgba(255,255,255,.12)' }}>
            <Typography component="span" sx={{ fontSize: 13, letterSpacing: '0.08em', color: 'rgba(243,239,233,.45)', fontVariantNumeric: 'tabular-nums' }}>
              <Box component="span" sx={{ color: '#f3efe9' }}>{dos(actual + 1)}</Box> / {dos(total)}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Flecha etiqueta="Pieza anterior" onClick={() => ir(-1)} claro>←</Flecha>
              <Flecha etiqueta="Pieza siguiente" onClick={() => ir(1)} claro>→</Flecha>
            </Box>
          </Box>
        )}
      </Box>
    </Box>

    {/* Fuera del carrusel: los eventos de React suben por el portal, y un desliz
        o una flecha del teclado en la hoja pasarían la pieza de detrás. */}
    <Drawer
      anchor="bottom"
      open={cartela}
      onClose={() => setCartela(false)}
      slotProps={{
        paper: {
          'aria-labelledby': idTitulo,
          sx: { maxHeight: '78svh', borderRadius: '18px 18px 0 0', bgcolor: '#1b191c', backgroundImage: 'none', color: '#f3efe9', px: '20px', pt: 1.25, pb: 3 },
        },
      }}
    >
      <Box aria-hidden="true" sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'rgba(255,255,255,.25)', mx: 'auto', mb: 2 }} />
      <ButtonBase
        aria-label="Cerrar la cartela"
        onClick={() => setCartela(false)}
        sx={{ position: 'absolute', top: 12, right: 12, width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.1)', fontSize: 18, color: 'inherit', '&:focus-visible': { outline: '2px solid #dec72b', outlineOffset: 2 } }}
      >
        <span aria-hidden="true">✕</span>
      </ButtonBase>
      <Box sx={{ pr: 6 }}>
        <Ficha pieza={pieza} idTitulo={idTitulo} />
      </Box>
    </Drawer>
    </>
  )
}

function Ficha({ pieza, idTitulo }: { pieza: PiezaDeCarrusel; idTitulo?: string }) {
  return (
    <>
      {pieza.familia !== '' && (
        <Typography component="span" sx={{ display: 'block', fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: ORO_SUAVE }}>
          {pieza.familia}
        </Typography>
      )}
      <Typography component="h3" id={idTitulo} sx={{ fontFamily: SERIF, fontWeight: 400, fontSize: { xs: 30, md: 42 }, lineHeight: 1.08, letterSpacing: '-0.015em', textWrap: 'balance', mt: 1.75 }}>
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

function Flecha({ etiqueta, onClick, claro = false, children }: { etiqueta: string; onClick: () => void; claro?: boolean; children: string }) {
  return (
    <ButtonBase
      aria-label={etiqueta}
      onClick={onClick}
      sx={{
        // Sobre la foto (en el móvil), siempre claras: allí no manda el tema de la página.
        width: 44, height: 44, fontSize: 22, fontWeight: 300, color: claro ? 'rgba(243,239,233,.75)' : 'text.secondary', transition: 'color .3s ease',
        '&:hover': { color: claro ? '#f3efe9' : 'text.primary' },
        '&:focus-visible': { outline: '2px solid #dec72b', outlineOffset: 2 },
      }}
    >
      <span aria-hidden="true">{children}</span>
    </ButtonBase>
  )
}
