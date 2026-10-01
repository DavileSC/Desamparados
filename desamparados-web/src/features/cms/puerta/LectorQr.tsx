import { useEffect, useRef, useState } from 'react'
import { Alert, Box } from '@mui/material'
import jsQR from 'jsqr'

/** Cada cuánto se mira un fotograma: más a menudo no lee antes y gasta batería. */
const CADA_MS = 150

/** El lector nativo (Chrome en Android); en iPhone no existe y se usa jsQR. */
interface DetectorNativo { detect(fuente: CanvasImageSource): Promise<{ rawValue: string }[]> }
type ConstructorDetector = new (o: { formats: string[] }) => DetectorNativo

function detectorNativo(): DetectorNativo | null {
  const D = (window as unknown as { BarcodeDetector?: ConstructorDetector }).BarcodeDetector
  try { return D ? new D({ formats: ['qr_code'] }) : null } catch { return null }
}

/** Sin https (o en un navegador viejo) no hay `mediaDevices`, aunque los tipos digan que siempre está. */
const hayCamara = () => typeof (navigator.mediaDevices as MediaDevices | undefined)?.getUserMedia === 'function'

interface Props {
  /** Se llama con cada QR leído; mientras `pausado`, no se lee. */
  onCodigo: (texto: string) => void
  pausado: boolean
}

/**
 * La cámara trasera del móvil leyendo QR. Se monta al pulsar «Abrir la
 * cámara»: el iPhone solo la deja abrir tras un gesto, y abierta sin pedirla
 * gasta batería toda la tarde.
 */
export default function LectorQr({ onCodigo, pausado }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(() => (hayCamara()
    ? null
    : 'Este navegador no deja usar la cámara. Usa el campo de abajo con un lector o escribiendo el código.'))
  // Lo leen el bucle y la pausa sin volver a abrir la cámara a cada cambio.
  const avisar = useRef(onCodigo)
  const parado = useRef(pausado)
  useEffect(() => { avisar.current = onCodigo; parado.current = pausado }, [onCodigo, pausado])

  useEffect(() => {
    let flujo: MediaStream | null = null
    let reloj: number | null = null
    let cancelado = false
    const lienzo = document.createElement('canvas')
    const ctx = lienzo.getContext('2d', { willReadFrequently: true })
    const nativo = detectorNativo()

    const mirar = async () => {
      const v = video.current
      if (cancelado || !v || parado.current || v.readyState < v.HAVE_ENOUGH_DATA) return
      try {
        if (nativo) {
          const [hallado] = await nativo.detect(v)
          if (hallado?.rawValue) avisar.current(hallado.rawValue)
          return
        }
        if (!ctx) return
        // Se reduce el fotograma: el QR de la papeleta es grande y jsQR va mucho más rápido.
        const escala = Math.min(1, 640 / v.videoWidth)
        lienzo.width = Math.round(v.videoWidth * escala)
        lienzo.height = Math.round(v.videoHeight * escala)
        ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height)
        const img = ctx.getImageData(0, 0, lienzo.width, lienzo.height)
        const hallado = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
        if (hallado?.data) avisar.current(hallado.data)
      } catch { /* un fotograma que no se pudo leer: el siguiente */ }
    }

    if (!hayCamara()) return
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(async (f) => {
        if (cancelado) { f.getTracks().forEach((t) => t.stop()); return }
        flujo = f
        if (video.current) {
          video.current.srcObject = f
          await video.current.play().catch(() => undefined)
        }
        reloj = window.setInterval(() => { void mirar() }, CADA_MS)
      })
      .catch((err: unknown) => {
        if (cancelado) return
        const nombre = err instanceof DOMException ? err.name : ''
        setError(nombre === 'NotAllowedError'
          ? 'El navegador no deja usar la cámara. Actívala en los permisos del sitio, o usa el campo de abajo.'
          : 'No se ha podido abrir la cámara. Usa el campo de abajo con un lector o escribiendo el código.')
      })

    return () => {
      cancelado = true
      if (reloj !== null) window.clearInterval(reloj)
      flujo?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  if (error) return <Alert severity="warning">{error}</Alert>
  return (
    <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: '#000', aspectRatio: '4 / 3', maxHeight: '45vh', mx: 'auto', width: '100%' }}>
      <Box component="video" ref={video} muted playsInline aria-label="Cámara para leer el QR de la papeleta"
        sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: pausado ? 0.4 : 1 }} />
      {/* El recuadro donde poner el QR: ayuda a acercar la papeleta lo justo. */}
      <Box aria-hidden sx={{ position: 'absolute', inset: '18% 22%', border: '3px solid rgba(255,255,255,0.85)', borderRadius: 2 }} />
    </Box>
  )
}
