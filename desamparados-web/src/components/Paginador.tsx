import { useEffect } from 'react'
import { Box, FormControl, InputLabel, MenuItem, Pagination, Select, Typography } from '@mui/material'
import { TAMANOS } from '../hooks/usePaginacion'
import type { MetaPaginacion } from '../lib/api/tipos'

interface Props {
  meta: MetaPaginacion
  onPagina: (numero: number) => void
  /**
   * Sin él no hay selector de tamaño ni recuento: es lo que usan los listados
   * públicos, donde el visitante solo necesita pasar de página.
   */
  onTamano?: (numero: number) => void
  /** Para los lectores de pantalla: «paginación del censo de hermanos». */
  etiqueta: string
}

// El id no puede llevar espacios: aria-labelledby interpreta el valor como una
// lista de identificadores separados por espacios, y con etiquetas de varias
// palabras («censo de hermanos») el selector se quedaría sin etiqueta accesible.
function idParaEtiqueta(etiqueta: string): string {
  return etiqueta.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-')
}

export default function Paginador({ meta, onPagina, onTamano, etiqueta }: Props) {
  const { total, page, limit, totalPages } = meta

  // Un enlace viejo con ?pagina=99 traería una lista vacía y un desconcierto.
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) onPagina(totalPages)
  }, [page, totalPages, onPagina])

  if (total === 0) return null
  if (!onTamano && totalPages <= 1) return null

  const desde = (page - 1) * limit + 1
  const hasta = Math.min(page * limit, total)
  const idEtiqueta = `tamano-${idParaEtiqueta(etiqueta)}`

  const numeros = totalPages > 1 && (
    <Pagination
      count={totalPages}
      page={Math.min(page, totalPages)}
      onChange={(_, numero) => onPagina(numero)}
      color="primary"
      getItemAriaLabel={(tipo, numero) =>
        tipo === 'page' ? `Ir a la página ${numero}`
        : tipo === 'previous' ? 'Página anterior'
        : tipo === 'next' ? 'Página siguiente'
        : tipo === 'first' ? 'Primera página' : 'Última página'}
      aria-label={`Paginación de ${etiqueta}`}
    />
  )

  if (!onTamano) {
    return <Box sx={{ mt: 5, display: 'flex', justifyContent: 'center' }}>{numeros}</Box>
  }

  return (
    <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {totalPages > 1 ? `Mostrando ${desde}-${hasta} de ${total}` : `${total} resultados`}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {/* Sin anchura mínima, la etiqueta flotante se recortaba a «Resul…» sobre un valor de dos cifras. */}
        <FormControl size="small" sx={{ minWidth: 190 }}>
          <InputLabel id={idEtiqueta}>Resultados por página</InputLabel>
          <Select
            labelId={idEtiqueta}
            label="Resultados por página"
            value={limit}
            onChange={(evento) => onTamano(Number(evento.target.value))}
          >
            {TAMANOS.map((tamano) => <MenuItem key={tamano} value={tamano}>{tamano}</MenuItem>)}
          </Select>
        </FormControl>
        {numeros}
      </Box>
    </Box>
  )
}
