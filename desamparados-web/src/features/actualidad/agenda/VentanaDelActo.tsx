import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import type { ApiEvent } from '../../../lib/api/agenda'
import { GOLD, SERIF } from '../../inicio/estilos'
import { claseDelActo, cuandoEnCartel, fotoDelCartel, hora, notaDelActo } from './cultos'
import EnlacesDelActo from './EnlacesDelActo'

const CARTEL = '#120f11'
const ORO_BORDE = 'rgba(222,199,43,0.4)'
const ORO_SUAVE = '#c9b25a'

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
        position: 'relative', width: { xs: 'min(360px, calc(100vw - 32px))', md: 360 }, bgcolor: CARTEL, color: '#f4f1ee',
        border: `1px solid ${ORO_BORDE}`, boxShadow: '0 30px 60px -20px rgba(0,0,0,0.85)',
      }}
    >
      {foto && (
        <Box component="img" src={foto.src} alt={foto.alt} sx={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', objectPosition: 'center 25%' }} />
      )}
      <ButtonBase
        ref={cerrar}
        onClick={onCerrar}
        aria-label="Cerrar"
        sx={{
          position: 'absolute', top: 8, right: 8, width: 36, height: 36, fontSize: 20, lineHeight: 1,
          border: `1px solid ${ORO_BORDE}`, bgcolor: 'rgba(18,15,17,0.75)', color: GOLD,
          '&:hover, &.Mui-focusVisible': { bgcolor: GOLD, color: CARTEL },
        }}
      >
        ×
      </ButtonBase>
      <Box sx={{ p: '16px 18px 14px', display: 'grid', gap: 0.5 }}>
        <Typography component="span" sx={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: ORO_SUAVE, pr: 5 }}>
          {claseDelActo(evento)}
        </Typography>
        <Typography id={`acto-${evento.id}`} component="h3" sx={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 300, fontSize: 26, lineHeight: 1.15, pr: 4 }}>
          {evento.title}
        </Typography>
        {evento.dedicatoria && <Typography sx={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.8)', fontSize: 15 }}>{evento.dedicatoria}</Typography>}
        <Typography sx={{ color: GOLD, fontWeight: 500, fontSize: 15.5 }}>{cuandoEnCartel(evento)}, a las {hora(evento)}</Typography>
        {nota && <Typography sx={{ color: 'rgba(244,241,238,0.66)', fontSize: 14.5 }}>{nota}</Typography>}
        <EnlacesDelActo evento={evento} sobreOscuro sinMapa />
      </Box>
    </Box>
  )
}
