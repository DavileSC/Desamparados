import { useEffect, useState } from 'react'
import { Box, IconButton, InputAdornment, ListSubheader, MenuItem, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SearchIcon from '@mui/icons-material/Search'
import type { Category } from '../../../lib/api/accounting'
import { METODOS, PERIODOS, PERIODO_POR_DEFECTO, fechasInvertidas, type FiltrosUi } from './filtros'
import { COLOR_GASTO, COLOR_INGRESO, etiquetaMetodo } from './formato'

interface Props {
  filtros: FiltrosUi
  categorias: Category[]
  /** Cambia uno o varios filtros; `''` lo quita. */
  onCambiar: (cambios: Partial<FiltrosUi>) => void
}

// Sin esto, un desplegable sin filtro enseña su etiqueta dentro, como si estuviera vacío, en vez de «Todas».
const SIN_VALOR_VISIBLE = { inputLabel: { shrink: true }, select: { displayEmpty: true } } as const

const punto = (color: string) => <Box component="span" aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, display: 'inline-block', mr: 1 }} />

/** Fila de filtros de la contabilidad y, debajo, los activos como etiquetas que se quitan. */
export default function BarraFiltros({ filtros, categorias, onCambiar }: Props) {
  // La búsqueda se escribe aquí y llega a la URL medio segundo después de dejar
  // de teclear: una petición por letra saturaría el limitador.
  const [texto, setTexto] = useState(filtros.q)
  // Si la búsqueda cambia desde fuera (la × de su etiqueta), la caja la sigue.
  const [qConocida, setQConocida] = useState(filtros.q)
  if (filtros.q !== qConocida) { setQConocida(filtros.q); setTexto(filtros.q) }
  useEffect(() => {
    if (texto.trim() === filtros.q) return
    const espera = window.setTimeout(() => onCambiar({ q: texto.trim() }), 400)
    return () => window.clearTimeout(espera)
  }, [texto, filtros.q, onCambiar])

  const alReves = fechasInvertidas(filtros)

  // Con «Ingresos» o «Gastos», el desplegable solo ofrece categorías de ese tipo.
  // Las desactivadas también salen: su historial se sigue pudiendo filtrar.
  const ingresos = categorias.filter((c) => c.tipo === 'INGRESO')
  const gastos = categorias.filter((c) => c.tipo === 'GASTO')
  const categoriaElegida = categorias.find((c) => String(c.id) === filtros.categoria)
  const grupo = (titulo: string, lista: Category[]) => [
    <ListSubheader key={titulo}>{titulo}</ListSubheader>,
    ...lista.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.nombre}{c.activa === false ? ' (desactivada)' : ''}</MenuItem>),
  ]

  const cambiarTipo = (tipo: FiltrosUi['tipo'] | null) => {
    if (!tipo) return
    // Una categoría del otro tipo dejaría la lista vacía sin explicar por qué.
    const sigueValida = !categoriaElegida || tipo === 'TODO' || categoriaElegida.tipo === tipo
    onCambiar({ tipo, ...(sigueValida ? {} : { categoria: '' }) })
  }

  const etiquetas = [
    filtros.periodo !== PERIODO_POR_DEFECTO && {
      nombre: 'periodo',
      texto: filtros.periodo === 'personalizado'
        ? `${filtros.desde || '…'} – ${filtros.hasta || '…'}`
        : PERIODOS.find((p) => p.valor === filtros.periodo)?.etiqueta,
      quitar: () => onCambiar({ periodo: PERIODO_POR_DEFECTO, desde: '', hasta: '' }),
    },
    categoriaElegida && { nombre: 'categoría', texto: categoriaElegida.nombre, quitar: () => onCambiar({ categoria: '' }) },
    filtros.metodo && { nombre: 'método', texto: etiquetaMetodo(filtros.metodo), quitar: () => onCambiar({ metodo: '' }) },
    filtros.q && { nombre: 'búsqueda', texto: `«${filtros.q}»`, quitar: () => onCambiar({ q: '' }) },
  ].filter((e): e is { nombre: string; texto: string; quitar: () => void } => Boolean(e))

  return (
    <Box sx={{ mb: 3 }}>
      <Paper sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <ToggleButtonGroup exclusive size="small" value={filtros.tipo} onChange={(_, valor) => cambiarTipo(valor)} aria-label="Qué ver">
          <ToggleButton value="TODO" sx={{ px: 2 }}>Todo</ToggleButton>
          <ToggleButton value="INGRESO" sx={{ px: 2 }}>{punto(COLOR_INGRESO)}Ingresos</ToggleButton>
          <ToggleButton value="GASTO" sx={{ px: 2 }}>{punto(COLOR_GASTO)}Gastos</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          select
          size="small"
          label="Periodo"
          value={filtros.periodo}
          onChange={(e) => onCambiar({ periodo: e.target.value as FiltrosUi['periodo'], desde: '', hasta: '' })}
          sx={{ minWidth: 170 }}
        >
          {PERIODOS.map((p) => <MenuItem key={p.valor} value={p.valor}>{p.etiqueta}</MenuItem>)}
        </TextField>
        {filtros.periodo === 'personalizado' && (
          // min y max guían el calendario; el aviso cubre lo que se teclea a mano.
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <TextField size="small" type="date" label="Desde" value={filtros.desde} onChange={(e) => onCambiar({ desde: e.target.value })} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: filtros.hasta || undefined } }} />
            <TextField
              size="small"
              type="date"
              label="Hasta"
              value={filtros.hasta}
              onChange={(e) => onCambiar({ hasta: e.target.value })}
              error={alReves}
              helperText={alReves ? 'Es anterior a «Desde»' : undefined}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: filtros.desde || undefined } }}
            />
          </Stack>
        )}
        <TextField select size="small" label="Categoría" value={filtros.categoria} onChange={(e) => onCambiar({ categoria: e.target.value })} sx={{ minWidth: 190 }} slotProps={SIN_VALOR_VISIBLE}>
          <MenuItem value="">Todas</MenuItem>
          {filtros.tipo !== 'GASTO' && grupo('Ingresos', ingresos)}
          {filtros.tipo !== 'INGRESO' && grupo('Gastos', gastos)}
        </TextField>
        <TextField select size="small" label="Método" value={filtros.metodo} onChange={(e) => onCambiar({ metodo: e.target.value as FiltrosUi['metodo'] })} sx={{ minWidth: 150 }} slotProps={SIN_VALOR_VISIBLE}>
          <MenuItem value="">Todos</MenuItem>
          {METODOS.map((m) => <MenuItem key={m.valor} value={m.valor}>{m.etiqueta}</MenuItem>)}
        </TextField>
        <TextField
          size="small"
          label="Buscar"
          placeholder="Concepto o hermano"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          sx={{ flex: 1, minWidth: 200 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
      </Paper>
      {etiquetas.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
          {/* Pastilla propia y no Chip: el aspa del Chip no es un botón para el lector de pantalla. */}
          {etiquetas.map((e) => (
            <Box key={e.nombre} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, pl: 1.5, pr: 0.25, borderRadius: 999, backgroundColor: 'action.selected', fontSize: 13 }}>
              {e.texto}
              <IconButton size="small" aria-label={`Quitar el filtro ${e.nombre}`} onClick={e.quitar} sx={{ p: 0.5 }}>
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  )
}
