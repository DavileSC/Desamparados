import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import type { ApiEvent } from '../../../lib/api/agenda'
import { GRANATE } from '../../inicio/estilos'
import { claseDelActo, cuandoEnCartel, fotoDelCartel, hora, notaDelActo } from './cultos'
import EnlacesDelActo from './EnlacesDelActo'
import { useFotoQueFalla } from '../../../hooks/useFotoQueFalla'
import { propsDeFoto } from '../../../lib/fotoSubida'

/** La ventana es otra hoja, un punto más clara que el calendario. */
const HOJA = '#fbf8f2'
const RAYA = '#d9cfc1'
const TINTA = '#231d20'
const GRIS = '#6b5e62'
const CORMORANT = '"Cormorant Garamond", Georgia, serif'

interface Props {
  evento: ApiEvent
  /** La casilla pulsada: si queda fuera de la pantalla, la página la sigue. */
  origen: HTMLElement | null
  /** Quien pide menos movimiento la ve aparecer y irse sin animación. */
  quieto: boolean
  /** Se está cerrando: la hoja se levanta y, al acabar, avisa con `onSalida`. */
  saliendo?: boolean
  onSalida?: () => void
  /** En el móvil la ventana va dentro de un Dialog, que ya es el diálogo. */
  esDialogo: boolean
  onCerrar: () => void
  /** Solo en la vista previa del CMS, mientras el acto no tiene hora. */
  sinHora?: boolean
}

/**
 * Un acto de la Agenda, en su ventana: la foto si es solemne, qué es, cuándo,
 * dónde y, para no olvidarlo, al calendario del móvil.
 */
/**
 * Cae como una hoja de almanaque: gira desde su borde de arriba hasta quedar
 * plana (elegida en maqueta el 28-11-2026). Antes crecía desde la casilla con
 * una escala distinta a lo ancho y a lo alto, y la letra se aplastaba por el
 * camino. Hasta el valor neutro escrito, nunca `none` (notas: animar con transform).
 */
const CAIDA: Keyframe[] = [
  { transformOrigin: '50% 0%', transform: 'perspective(900px) rotateX(-28deg) translateY(-6px)', opacity: 0 },
  { transformOrigin: '50% 0%', transform: 'perspective(900px) rotateX(0deg) translateY(0px)', opacity: 1 },
]

export default function VentanaDelActo({ evento, origen, quieto, esDialogo, onCerrar, saliendo = false, onSalida, sinHora = false }: Props) {
  const raiz = useRef<HTMLDivElement>(null)
  const cerrar = useRef<HTMLButtonElement>(null)
  const nota = notaDelActo(evento)
  const foto = evento.cartel ? fotoDelCartel(evento) : null
  // Sin la foto (la fija de una instalación que no la tiene), la ventana sin ella.
  const { visible: conFoto, alFallar } = useFotoQueFalla(foto?.src)

  // Al abrir, cae. Se espera a que el Popper la coloque (la monta y la mueve
  // después) para que no caiga en un sitio y aparezca en otro. Si se abre en
  // otro mes (desde «Próximo acto») y su día queda fuera de la pantalla, la
  // página lo sigue antes de que caiga, de golpe: con el desplazamiento suave,
  // el Popper la recolocaba a mitad de la caída.
  useLayoutEffect(() => {
    const el = raiz.current
    if (!el) return
    const animar = !quieto && typeof el.animate === 'function'
    if (animar) el.style.opacity = '0'
    const marco = requestAnimationFrame(() => {
      el.style.opacity = ''
      if (!esDialogo) origen?.scrollIntoView?.({ block: 'nearest' })
      if (animar) el.animate(CAIDA, { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' })
    })
    return () => { cancelAnimationFrame(marco); el.style.opacity = '' }
  }, [evento.id, origen, quieto, esDialogo])

  // Al cerrar, se levanta (más deprisa que al caer) y luego se quita.
  useEffect(() => {
    if (!saliendo) return
    const el = raiz.current
    if (!el || quieto || typeof el.animate !== 'function') { onSalida?.(); return }
    const animacion = el.animate([...CAIDA].reverse(), { duration: 220, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' })
    animacion.onfinish = () => onSalida?.()
    return () => { animacion.onfinish = null }
  }, [saliendo, quieto, onSalida])

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
        // La ventana mide 360 px: con las copias de la foto subida, el móvil no baja la original de 1920.
        <Box component="img" alt={foto.alt} {...propsDeFoto(foto.src, '360px', alFallar)} sx={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', objectPosition: 'center 25%' }} />
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
        <Typography sx={{ color: TINTA, fontWeight: 600, fontSize: 15.5 }}>{cuandoEnCartel(evento)}{!sinHora && <>, a las {hora(evento)}</>}</Typography>
        {nota && <Typography sx={{ color: GRIS, fontSize: 14.5 }}>{nota}</Typography>}
        <EnlacesDelActo evento={evento} sinMapa />
      </Box>
    </Box>
  )
}
