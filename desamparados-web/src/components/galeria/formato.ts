import { useCallback, useState, type SyntheticEvent } from 'react'
import type { MedioGaleria } from '../../lib/api/contenido'

/** Horizontal, vertical o casi cuadrada: decide cómo se encaja cada foto. */
export type Formato = 'h' | 'v' | 'c'

/** Lo que se sabe de una imagen al cargarla: su formato y su proporción (ancho / alto). */
export interface Medida { formato: Formato; proporcion: number }

export function formatoDe(ancho: number, alto: number): Medida {
  const proporcion = alto > 0 ? ancho / alto : 16 / 9
  return { proporcion, formato: proporcion > 1.15 ? 'h' : proporcion < 0.87 ? 'v' : 'c' }
}

/** La imagen que representa al medio: la foto, o la portada del vídeo. */
export const imagenDe = (medio: MedioGaleria) => (medio.tipo === 'video' ? medio.portada : medio.url)

/**
 * El formato de cada imagen, aprendido al cargarla (no se pide en el CMS: nadie
 * sabe si su foto es 3:2 o 4:5, y el navegador sí). Hasta que carga se trata
 * como horizontal, que es lo más común; al saberse, se reencaja.
 *
 * De la portada de un vídeo sale también la proporción de su marco: un vídeo
 * grabado en vertical lleva una portada vertical, y se reproduce en vertical.
 */
export function useMedidas() {
  const [medidas, setMedidas] = useState<Record<string, Medida>>({})
  const medir = useCallback((evento: SyntheticEvent<HTMLImageElement>) => {
    const img = evento.currentTarget
    const clave = img.dataset.medida
    if (!clave || !img.naturalWidth) return
    setMedidas((actuales) => (actuales[clave] ? actuales : { ...actuales, [clave]: formatoDe(img.naturalWidth, img.naturalHeight) }))
  }, [])
  const medidaDe = useCallback((medio: MedioGaleria): Medida => medidas[imagenDe(medio)] ?? { formato: 'h', proporcion: 16 / 9 }, [medidas])
  return { medir, medidaDe }
}

/** El fondo de cada medio: su propia imagen, desenfocada y oscurecida, para que una vertical no deje franjas negras. */
export const fondoDesenfocado = (desenfoque: number, brillo: number) => ({
  position: 'absolute', inset: -desenfoque * 1.5, width: `calc(100% + ${desenfoque * 3}px)`, height: `calc(100% + ${desenfoque * 3}px)`,
  objectFit: 'cover', filter: `blur(${desenfoque}px) brightness(${brillo}) saturate(1.2)`, pointerEvents: 'none',
}) as const

/** Botón redondo translúcido de las flechas y el cierre. */
export const botonRedondo = (tamano: number) => ({
  width: tamano, height: tamano, color: 'common.white', border: '1px solid rgba(255,255,255,0.28)',
  backgroundColor: 'rgba(16,14,17,0.5)', backdropFilter: 'blur(6px)',
  '&:hover': { backgroundColor: 'rgba(16,14,17,0.75)' },
  '&.Mui-focusVisible': { outline: '2px solid #dec72b', outlineOffset: 2 },
}) as const

export const DORADO = '#dec72b'
