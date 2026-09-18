import { useEffect, useRef, useState } from 'react'
import { InputAdornment, TextField, type SxProps, type Theme } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'

interface Props {
  etiqueta: string
  placeholder?: string
  /** Lo buscado, tal y como está en la URL. */
  valor: string
  onCambiar: (texto: string) => void
  sx?: SxProps<Theme>
}

/** Lo que se espera a que se deje de teclear antes de buscar. */
export const ESPERA_BUSQUEDA_MS = 400

/**
 * Caja de búsqueda de un listado. Se escribe aquí y llega a la URL un momento
 * después de dejar de teclear: una petición por letra saturaría el limitador.
 */
export default function CampoBusqueda({ etiqueta, placeholder, valor, onCambiar, sx }: Props) {
  const [texto, setTexto] = useState(valor)
  // Si la búsqueda cambia desde fuera (la × de su etiqueta), la caja la sigue.
  const [conocida, setConocida] = useState(valor)
  if (valor !== conocida) { setConocida(valor); setTexto(valor) }

  // La última `onCambiar` en una referencia: las pantallas la pasan en línea,
  // y como dependencia del efecto cada repintado del listado reiniciaría la espera.
  const avisar = useRef(onCambiar)
  useEffect(() => { avisar.current = onCambiar })

  useEffect(() => {
    if (texto.trim() === valor) return
    const espera = window.setTimeout(() => avisar.current(texto.trim()), ESPERA_BUSQUEDA_MS)
    return () => window.clearTimeout(espera)
  }, [texto, valor])

  return (
    <TextField
      size="small"
      label={etiqueta}
      placeholder={placeholder}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      sx={[{ flex: 1, minWidth: 220 }, ...(Array.isArray(sx) ? sx : [sx])]}
      slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
    />
  )
}
