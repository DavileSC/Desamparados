import { useEffect, useState } from 'react'
import { Box, Checkbox, FormControlLabel, TextField } from '@mui/material'
import { prendasDelRopero, type PrendaDelRopero, type TipoRopa } from '../../../lib/api/mesa'

interface Props {
  tipo: TipoRopa
  etiqueta: string
  valor: string
  onCambiar: (valor: string) => void
  /** De quién es la ficha: una prenda que ya tiene esa persona está bien. */
  hermanoId: number
  /** El slug de la salida: en qué papeleta va cada prenda depende de la salida. */
  salida: string
  /** Darla de alta en el ropero al apuntar, si no está. */
  crear: boolean
  onCrear: (crear: boolean) => void
  /** Si la prenda no se puede prestar (la tiene otro, está en el taller…). */
  onBloqueo?: (bloqueada: boolean) => void
  autoFocus?: boolean
  /**
   * El número que ya tiene la papeleta que se corrige. Ese no se mira en el
   * ropero: la salida pudo pasar y la prenda estar ya devuelta o prestada a
   * otro; solo se comprueba si se cambia por otro.
   */
  asignada?: string | null
}

type Estado =
  | { tipo: 'vacio' }
  | { tipo: 'asignada' }
  | { tipo: 'buscando' }
  | { tipo: 'libre'; prenda: PrendaDelRopero }
  | { tipo: 'suya'; prenda: PrendaDelRopero }
  | { tipo: 'ocupada'; texto: string }
  | { tipo: 'falta'; libres: string[] }
  | { tipo: 'error' }

const ESPERA_MS = 300
const normalizar = (texto: string) => texto.trim().replace(/\s+/g, '').toUpperCase()

/**
 * El número de una prenda, comprobado en el ropero mientras se escribe: si
 * está libre (y su talla), si ya la tiene esta persona, quién la tiene si es
 * de otro, o que no está en el ropero, con la opción de darla de alta ahí.
 */
export default function CampoPrenda({ tipo, etiqueta, valor, onCambiar, hermanoId, salida, crear, onCrear, onBloqueo, autoFocus, asignada }: Props) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'vacio' })
  const numero = normalizar(valor)
  const esLaAsignada = Boolean(asignada) && numero === normalizar(asignada ?? '')

  useEffect(() => {
    if (!numero) { setEstado({ tipo: 'vacio' }); return }
    if (esLaAsignada) { setEstado({ tipo: 'asignada' }); return }
    let cancelado = false
    setEstado({ tipo: 'buscando' })
    const espera = window.setTimeout(() => {
      prendasDelRopero(tipo, numero, salida)
        .then((prendas) => {
          if (cancelado) return
          const exacta = prendas.find((p) => p.numero === numero)
          if (!exacta) {
            setEstado({ tipo: 'falta', libres: prendas.filter((p) => p.estado === 'DISPONIBLE').slice(0, 4).map((p) => p.numero) })
          } else if (exacta.enPapeleta && exacta.enPapeleta.id !== hermanoId) {
            setEstado({ tipo: 'ocupada', texto: `Va en la papeleta de ${exacta.enPapeleta.nombre} ${exacta.enPapeleta.apellidos} de este año` })
          } else if (exacta.estado === 'PRESTADA' && exacta.hermano?.id === hermanoId) {
            setEstado({ tipo: 'suya', prenda: exacta })
          } else if (exacta.estado === 'PRESTADA') {
            setEstado({ tipo: 'ocupada', texto: `La tiene ${exacta.hermano ? `${exacta.hermano.nombre} ${exacta.hermano.apellidos}` : 'otra persona'}` })
          } else if (exacta.estado === 'TALLER') {
            setEstado({ tipo: 'ocupada', texto: 'Está en el taller, para arreglar' })
          } else if (exacta.estado === 'BAJA') {
            setEstado({ tipo: 'ocupada', texto: 'Está dada de baja en el ropero' })
          } else {
            setEstado({ tipo: 'libre', prenda: exacta })
          }
        })
        .catch(() => { if (!cancelado) setEstado({ tipo: 'error' }) })
    }, ESPERA_MS)
    return () => { cancelado = true; window.clearTimeout(espera) }
  }, [numero, tipo, hermanoId, salida, esLaAsignada])

  // Lo que no se puede prestar bloquea el botón de apuntar; «no está» solo si no se da de alta.
  const bloqueada = estado.tipo === 'ocupada' || (estado.tipo === 'falta' && !crear)
  useEffect(() => { onBloqueo?.(bloqueada) }, [bloqueada, onBloqueo])

  const talla = (p: PrendaDelRopero) => (p.talla ? ` · talla ${p.talla}` : '')
  const ayuda = (() => {
    switch (estado.tipo) {
      case 'asignada': return 'Asignada en esta papeleta'
      case 'buscando': return 'Mirando en el ropero…'
      case 'libre': return `${estado.prenda.estado === 'LAVADO' ? 'Libre (constaba en el lavado)' : 'Libre en el ropero'}${talla(estado.prenda)}`
      case 'suya': return `Ya la tiene esta persona${talla(estado.prenda)}`
      case 'ocupada': return estado.texto
      case 'falta': return estado.libres.length ? `No está en el ropero. Libres: ${estado.libres.join(', ')}` : 'No está en el ropero'
      case 'error': return 'No se ha podido mirar en el ropero'
      default: return ' '
    }
  })()

  return (
    <Box>
      <TextField
        size="small"
        fullWidth
        label={etiqueta}
        value={valor}
        autoFocus={autoFocus}
        onChange={(e) => onCambiar(e.target.value)}
        error={estado.tipo === 'ocupada'}
        helperText={ayuda}
        slotProps={{
          htmlInput: { autoComplete: 'off', spellCheck: false },
          formHelperText: { sx: { color: estado.tipo === 'libre' || estado.tipo === 'suya' ? 'success.main' : undefined } },
        }}
      />
      {estado.tipo === 'falta' && (
        <FormControlLabel
          sx={{ mt: -0.5, '& .MuiFormControlLabel-label': { fontSize: 13 } }}
          control={<Checkbox size="small" checked={crear} onChange={(e) => onCrear(e.target.checked)} />}
          label={`Darla de alta en el ropero con el número ${numero}`}
        />
      )}
    </Box>
  )
}
