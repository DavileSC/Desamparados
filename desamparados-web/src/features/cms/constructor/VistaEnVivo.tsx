import { useEffect, useRef, useState } from 'react'
import { Box, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material'
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone'
import TabletMacIcon from '@mui/icons-material/TabletMac'
import DesktopWindowsOutlinedIcon from '@mui/icons-material/DesktopWindowsOutlined'
import { esMensaje, rutaDeLaVistaEnVivo, type Mensaje } from './mensajes'
import type { PaginaDeBloques } from '../../../lib/api/contenido'

/** El ancho de cada aparato: un móvil corriente, una tableta en vertical y un portátil. */
const ANCHOS = { movil: 390, tableta: 820, escritorio: 1440 } as const
type Aparato = keyof typeof ANCHOS

/**
 * La página tal como quedará, en vivo y al ancho de un móvil, una tableta o
 * un escritorio. Va en un iframe con la propia web dentro: solo así la página
 * se maqueta de verdad para ese ancho (la web decide por el ancho de la
 * ventana, y el iframe es una ventana). Si no cabe, se encoge entera.
 *
 * Recibe el documento en cada cambio y lo reenvía a la vista; al pulsar un
 * bloque allí, avisa con `onSeleccionar`.
 */
export default function VistaEnVivo({ slug, documento, seleccionado, onSeleccionar, alto }: {
  slug: string
  documento: PaginaDeBloques
  seleccionado: number | null
  onSeleccionar: (indice: number) => void
  /** Alto del marco, en CSS. */
  alto: string
}) {
  const [aparato, setAparato] = useState<Aparato>('escritorio')
  const [lista, setLista] = useState(false)
  const [medida, setMedida] = useState({ ancho: 0, alto: 0 })
  const iframe = useRef<HTMLIFrameElement>(null)
  const marco = useRef<HTMLDivElement>(null)

  // Lo que llega de la vista: que está lista, o que se ha pulsado un bloque.
  useEffect(() => {
    const oir = (evento: MessageEvent) => {
      if (evento.origin !== window.location.origin || evento.source !== iframe.current?.contentWindow) return
      if (!esMensaje(evento.data)) return
      if (evento.data.tipo === 'desamparados:lista') setLista(true)
      if (evento.data.tipo === 'desamparados:pulsado') onSeleccionar(evento.data.indice)
    }
    window.addEventListener('message', oir)
    return () => window.removeEventListener('message', oir)
  }, [onSeleccionar])

  // El documento y el bloque abierto, cada vez que cambian (y en cuanto la vista está lista).
  useEffect(() => {
    if (!lista) return
    const mensaje: Mensaje = { tipo: 'desamparados:borrador', documento, seleccionado }
    iframe.current?.contentWindow?.postMessage(mensaje, window.location.origin)
  }, [lista, documento, seleccionado])

  useEffect(() => {
    if (!marco.current) return
    const observador = new ResizeObserver(([entrada]) => setMedida({ ancho: entrada.contentRect.width, alto: entrada.contentRect.height }))
    observador.observe(marco.current)
    return () => observador.disconnect()
  }, [])

  const ancho = ANCHOS[aparato]
  const escala = medida.ancho > 0 ? Math.min(1, medida.ancho / ancho) : 1

  return (
    <Stack spacing={1} sx={{ height: '100%' }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" component="h2">Vista en vivo</Typography>
          <Typography variant="caption" color="text.secondary">Pulsa un bloque para editarlo. No se publica hasta que guardes.</Typography>
        </Box>
        <ToggleButtonGroup exclusive size="small" value={aparato} onChange={(_, v: Aparato | null) => { if (v) setAparato(v) }} aria-label="Ver como en">
          <ToggleButton value="movil" aria-label="Móvil"><Tooltip title="Móvil"><PhoneIphoneIcon fontSize="small" /></Tooltip></ToggleButton>
          <ToggleButton value="tableta" aria-label="Tableta"><Tooltip title="Tableta"><TabletMacIcon fontSize="small" /></Tooltip></ToggleButton>
          <ToggleButton value="escritorio" aria-label="Escritorio"><Tooltip title="Escritorio"><DesktopWindowsOutlinedIcon fontSize="small" /></Tooltip></ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Box ref={marco} sx={{
        position: 'relative', height: alto, overflow: 'hidden', borderRadius: 2, border: 1, borderColor: 'divider',
        backgroundColor: 'action.hover', display: 'flex', justifyContent: 'center',
      }}>
        <Box sx={{ width: ancho * escala, height: '100%', flexShrink: 0, position: 'relative' }}>
          <Box
            component="iframe"
            ref={iframe}
            src={rutaDeLaVistaEnVivo(slug)}
            title="Vista en vivo de la página"
            sx={{
              position: 'absolute', top: 0, left: 0, border: 0, backgroundColor: '#262326',
              width: ancho, height: medida.alto > 0 ? medida.alto / escala : '100%',
              transform: `scale(${escala})`, transformOrigin: 'top left',
              boxShadow: aparato === 'escritorio' ? 'none' : '0 0 0 1px rgba(0,0,0,0.2), 0 12px 40px rgba(0,0,0,0.25)',
            }}
          />
        </Box>
      </Box>
    </Stack>
  )
}
