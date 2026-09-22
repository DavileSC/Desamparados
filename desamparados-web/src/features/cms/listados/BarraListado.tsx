import type { ReactNode } from 'react'
import { Box, InputAdornment, MenuItem, Paper, TextField } from '@mui/material'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import CampoBusqueda from './CampoBusqueda'
import PastillasFiltro, { type Pastilla } from './PastillasFiltro'
import { SIN_VALOR_VISIBLE, anchoControl } from './controles'

export interface Opcion { valor: string; etiqueta: string }

export interface FiltroDesplegable<C extends string> {
  clave: C
  etiqueta: string
  /** Cómo se lee sin filtrar: «Todos», «Todas». */
  todos: string
  opciones: Opcion[]
  /** Para el lector de pantalla, en la pastilla: «Quitar el filtro situación». Por defecto, la etiqueta. */
  nombre?: string
  ancho?: number
}

interface Props<C extends string> {
  valores: Record<C, string>
  onCambiar: (cambios: Partial<Record<C, string>>) => void
  busqueda?: { clave: C; etiqueta: string; placeholder?: string }
  filtros?: FiltroDesplegable<C>[]
  orden?: { clave: C; opciones: Opcion[] }
  /** Controles propios de la pantalla (el año de Tesorería), entre los filtros y el orden. */
  children?: ReactNode
  /** Lo que ocupan esos controles propios (la suma de sus `anchoControl`), para repartir la barra. */
  anchoHijos?: number
}

const HUECO = 12 // gap: 1.5
const ANCHO_BUSQUEDA = 280
const ANCHO_ORDEN = 230
/** Lo mínimo para dos desplegables en paralelo; por debajo, uno por fila. */
const ANCHO_DOS_COLUMNAS = 2 * 150 + HUECO

/**
 * Columnas del bloque de desplegables según el sitio que tenga él (no la
 * pantalla, que en el CMS comparte con el menú): todos en una fila si caben,
 * si no dos columnas iguales, y en el móvil uno debajo de otro. Con dos
 * columnas y un número impar, el último ocupa la fila entera en vez de quedar
 * cojo.
 */
function rejillaDelBloque(anchos: number[], anchoBloque: number) {
  return {
    display: 'grid',
    gap: 1.5,
    alignItems: 'start',
    gridTemplateColumns: 'minmax(0, 1fr)',
    [`@container (min-width: ${ANCHO_DOS_COLUMNAS}px)`]: {
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      '& > :last-child:nth-of-type(odd)': { gridColumn: '1 / -1' },
    },
    // En una fila, cada columna en proporción a lo que pide su control: iguales,
    // «Con y sin número» u «Ordenar por» se cortaban con puntos suspensivos.
    [`@container (min-width: ${anchoBloque}px)`]: {
      gridTemplateColumns: anchos.map((ancho) => `minmax(0, ${ancho}fr)`).join(' '),
      '& > :last-child:nth-of-type(odd)': { gridColumn: 'auto' },
    },
  }
}

/**
 * La barra de un listado del CMS: búsqueda, desplegables de filtro y orden en
 * una fila, y debajo los filtros activos como pastillas que se quitan. Es la
 * misma forma que la de Contabilidad, para que todos los listados se usen igual.
 */
export default function BarraListado<C extends string>({ valores, onCambiar, busqueda, filtros = [], orden, children, anchoHijos = 0 }: Props<C>) {
  const pastillas: Pastilla[] = [
    ...filtros.filter((f) => valores[f.clave]).map((f) => ({
      nombre: (f.nombre ?? f.etiqueta).toLowerCase(),
      texto: f.opciones.find((o) => o.valor === valores[f.clave])?.etiqueta ?? valores[f.clave],
      quitar: () => onCambiar({ [f.clave]: '' } as Partial<Record<C, string>>),
    })),
    ...(busqueda && valores[busqueda.clave]
      ? [{ nombre: 'búsqueda', texto: `«${valores[busqueda.clave]}»`, quitar: () => onCambiar({ [busqueda.clave]: '' } as Partial<Record<C, string>>) }]
      : []),
  ]
  const quitarTodas = () => onCambiar(Object.fromEntries(
    [...filtros.map((f) => f.clave), ...(busqueda ? [busqueda.clave] : [])].map((clave) => [clave, '']),
  ) as Partial<Record<C, string>>)

  // Los desplegables van juntos en un bloque que se mueve entero: o caben al
  // lado de la búsqueda, o bajan todos a la fila siguiente y se la reparten.
  // Sueltos, bajaba solo el último y quedaba colgando en una fila para él.
  // Dentro, `rejillaDelBloque` decide las columnas.
  const anchos = [...filtros.map((f) => f.ancho ?? 160), ...(anchoHijos ? [anchoHijos] : []), ...(orden ? [ANCHO_ORDEN] : [])]
  const anchoBloque = anchos.reduce((suma, ancho) => suma + ancho, 0) + HUECO * Math.max(anchos.length - 1, 0)

  return (
    <Box sx={{ mb: 3 }}>
      <Paper sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
        {busqueda && (
          <CampoBusqueda
            etiqueta={busqueda.etiqueta}
            placeholder={busqueda.placeholder}
            valor={valores[busqueda.clave]}
            onCambiar={(texto) => onCambiar({ [busqueda.clave]: texto } as Partial<Record<C, string>>)}
            sx={anchoControl(ANCHO_BUSQUEDA, 2)}
          />
        )}
        <Box sx={{ ...anchoControl(anchoBloque, 3), containerType: 'inline-size' }}>
          <Box sx={rejillaDelBloque(anchos, anchoBloque)}>
            {filtros.map((f) => (
              <TextField
                key={f.clave}
                select
                size="small"
                label={f.etiqueta}
                value={valores[f.clave]}
                onChange={(e) => onCambiar({ [f.clave]: e.target.value } as Partial<Record<C, string>>)}
                sx={{ minWidth: 0 }}
                slotProps={SIN_VALOR_VISIBLE}
              >
                <MenuItem value="">{f.todos}</MenuItem>
                {f.opciones.map((o) => <MenuItem key={o.valor} value={o.valor}>{o.etiqueta}</MenuItem>)}
              </TextField>
            ))}
            {children}
            {orden && (
              <TextField
                select
                size="small"
                label="Ordenar por"
                value={valores[orden.clave]}
                onChange={(e) => onCambiar({ [orden.clave]: e.target.value } as Partial<Record<C, string>>)}
                sx={{ minWidth: 0 }}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><SwapVertIcon fontSize="small" /></InputAdornment> } }}
              >
                {orden.opciones.map((o) => <MenuItem key={o.valor} value={o.valor}>{o.etiqueta}</MenuItem>)}
              </TextField>
            )}
          </Box>
        </Box>
      </Paper>
      <PastillasFiltro pastillas={pastillas} onQuitarTodas={quitarTodas} />
    </Box>
  )
}
