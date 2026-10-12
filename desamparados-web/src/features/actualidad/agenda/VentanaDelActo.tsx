import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import type { ApiEvent } from '../../../lib/api/agenda'
import { GRANATE } from '../../inicio/estilos'
import { claseDelActo, cuandoEnCartel, fotoDelCartel, hora, notaDelActo } from './cultos'
import EnlacesDelActo from './EnlacesDelActo'
import { useFotoQueFalla } from '../../../hooks/useFotoQueFalla'

/** La ventana es otra hoja, un punto más clara que el calendario. */
const HOJA = '#fbf8f2'
const RAYA = '#d9cfc1'
const TINTA = '#231d20'
const GRIS = '#6b5e62'
const CORMORANT = '"Cormorant Garamond", Georgia, serif'

interface Props {
  evento: ApiEvent
  /** La casilla pulsada: la ventana crece desde ella. */
  origen: HTMLElement | null
  /** Quien pide menos movimiento la ve aparecer sin crecer. */
  quieto: boolean
  /** En el móvil la ventana va dentro de un Dialog, que ya es el diálogo. */
  esDialogo: boolean
  onCerrar: () => void
}

/**
 * Un acto de la Agenda, en su ventana: la foto si es solemne, qué es, cuándo,
 * dónde y, para no olvidarlo, al calendario del móvil.
 */
export default function VentanaDelActo({ evento, origen, quieto, esDialogo, onCerrar }: Props) {
  const raiz = useRef<HTMLDivElement>(null)
  const cerrar = useRef<HTMLButtonElement>(null)
  const nota = notaDelActo(evento)
  const foto = evento.cartel ? fotoDelCartel(evento) : null
  // Sin la foto (la fija de una instalación que no la tiene), la ventana sin ella.
  const { visible: conFoto, alFallar } = useFotoQueFalla(foto?.src)

  // Nace de la casilla: se mide cuando ya está colocada (el Popper la coloca
  // después de montarla) y se anima desde el tamaño y el sitio de la casilla.
  // Si se abre en otro mes (desde «Próximo acto») y su día queda fuera de la pantalla, la página la sigue.
  useLayoutEffect(() => {
    const el = raiz.current
    if (!el || !origen) return
    const animar = !quieto && typeof el.animate === 'function'
    if (animar) el.style.opacity = '0'
    const marco = requestAnimationFrame(() => {
      el.style.opacity = ''
      // La casilla, no la ventana: el Popper aún no la ha colocado.
      if (!esDialogo) origen.scrollIntoView?.({ block: 'nearest', behavior: quieto ? 'auto' : 'smooth' })
      const p = el.getBoundingClientRect()
      const c = origen.getBoundingClientRect()
      if (!animar || !p.width || !p.height) return
      const dx = c.left + c.width / 2 - (p.left + p.width / 2)
      const dy = c.top + c.height / 2 - (p.top + p.height / 2)
      el.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${c.width / p.width}, ${c.height / p.height})`, opacity: 0.2 },
        { transform: 'none', opacity: 1 },
      ], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' })
    })
    return () => { cancelAnimationFrame(marco); el.style.opacity = '' }
  }, [evento.id, origen, quieto, esDialogo])

  // Sin mover la página: la ventana aún no está en su sitio cuando se enfoca.
  useEffect(() => { cerrar.current?.focus({ preventScroll: true }) }, [evento.id])

  const teclas = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !esDialogo) { e.stopPropagation(); onCerrar() }
  }

  return (
    <Box
      ref={raiz}
      role={esDialogo ? undefined : 'dialog'}
      aria-labelledby={`acto-${evento.id}`}
      onKeyDown={teclas}
      sx={{
        position: 'relative', width: { xs: 'min(360px, calc(100vw - 32px))', md: 360 }, bgcolor: HOJA, color: TINTA, borderRadius: '3px', overflow: 'hidden',
        border: `1px solid ${RAYA}`, boxShadow: '0 24px 48px -18px rgba(20,14,16,0.45)',
      }}
    >
      {foto && conFoto && (
        <Box component="img" src={foto.src} alt={foto.alt} onError={alFallar} sx={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', objectPosition: 'center 25%' }} />
      )}
      <ButtonBase
        ref={cerrar}
        onClick={onCerrar}
        aria-label="Cerrar"
        sx={{
          position: 'absolute', top: 8, right: 8, width: 36, height: 36, fontSize: 20, lineHeight: 1,
          borderRadius: '18px', border: `1px solid ${RAYA}`, bgcolor: 'rgba(251,248,242,0.9)', color: GRANATE,
          '&:hover, &.Mui-focusVisible': { bgcolor: GRANATE, borderColor: GRANATE, color: HOJA },
        }}
      >
        ×
      </ButtonBase>
      <Box sx={{ p: '16px 18px 14px', display: 'grid', gap: 0.5 }}>
        <Typography component="span" sx={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: GRIS, pr: 5 }}>
          {claseDelActo(evento)}
        </Typography>
        <Typography id={`acto-${evento.id}`} component="h3" sx={{ fontFamily: CORMORANT, fontStyle: 'italic', fontWeight: 500, fontSize: 30, lineHeight: 1.05, color: GRANATE, pr: 4 }}>
          {evento.title}
        </Typography>
        {evento.dedicatoria && <Typography sx={{ fontStyle: 'italic', color: GRIS, fontSize: 15 }}>{evento.dedicatoria}</Typography>}
        <Typography sx={{ color: TINTA, fontWeight: 600, fontSize: 15.5 }}>{cuandoEnCartel(evento)}, a las {hora(evento)}</Typography>
        {nota && <Typography sx={{ color: GRIS, fontSize: 14.5 }}>{nota}</Typography>}
        <EnlacesDelActo evento={evento} sinMapa />
      </Box>
    </Box>
  )
}
