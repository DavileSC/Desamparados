import { MenuItem, TextField } from '@mui/material'
import type { Category, MetodoPago, TipoApunte } from '../../../lib/api/accounting'
import { METODOS, dia } from './filtros'
import { categoriasParaApunte, errorConcepto, errorFecha, errorImporte, type FormApunte } from './apunte'

interface Props {
  form: FormApunte
  onCambiar: (form: FormApunte) => void
  categorias: Category[]
  /** Al corregir, la categoría que ya tenía el apunte: se ofrece aunque esté desactivada. */
  categoriaOriginal?: string
}

/** Los campos de un apunte manual, iguales para apuntar y para corregir. */
export default function CamposApunte({ form, onCambiar, categorias, categoriaOriginal }: Props) {
  const disponibles = categoriasParaApunte(categorias, form.tipo, categoriaOriginal)
  const fallo = { concepto: errorConcepto(form.concepto), importe: errorImporte(form.importe), fecha: errorFecha(form.fecha) }
  const cambiar = (cambios: Partial<FormApunte>) => onCambiar({ ...form, ...cambios })

  return <>
    <TextField select label="Tipo" value={form.tipo} onChange={(e) => cambiar({ tipo: e.target.value as TipoApunte, categoriaId: '' })} fullWidth>
      <MenuItem value="INGRESO">Ingreso</MenuItem>
      <MenuItem value="GASTO">Gasto</MenuItem>
    </TextField>
    <TextField
      select
      label="Categoría"
      value={form.categoriaId}
      onChange={(e) => cambiar({ categoriaId: e.target.value })}
      helperText={disponibles.length === 0 ? `No hay categorías de ${form.tipo === 'INGRESO' ? 'ingreso' : 'gasto'} activas: créala o reactívala en «Categorías».` : undefined}
      fullWidth
    >
      {disponibles.map((item) => <MenuItem key={item.id} value={String(item.id)}>{item.nombre}{item.activa === false ? ' (desactivada)' : ''}</MenuItem>)}
    </TextField>
    <TextField
      type="date"
      label="Fecha"
      value={form.fecha}
      onChange={(e) => cambiar({ fecha: e.target.value })}
      error={Boolean(fallo.fecha)}
      helperText={fallo.fecha ?? 'El día en que entró o salió el dinero.'}
      // La caja apunta lo que ya ha pasado: nada después de hoy.
      slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: dia(new Date()) } }}
      fullWidth
    />
    <TextField select label="Método de pago" value={form.metodoPago} onChange={(e) => cambiar({ metodoPago: e.target.value as MetodoPago })} fullWidth>
      {METODOS.map((m) => <MenuItem key={m.valor} value={m.valor}>{m.etiqueta}</MenuItem>)}
    </TextField>
    <TextField
      label="Concepto"
      value={form.concepto}
      onChange={(e) => cambiar({ concepto: e.target.value })}
      error={Boolean(fallo.concepto)}
      helperText={fallo.concepto ?? undefined}
      slotProps={{ htmlInput: { maxLength: 191 } }}
      fullWidth
    />
    <TextField
      label="Importe (€)"
      type="number"
      value={form.importe}
      onChange={(e) => cambiar({ importe: e.target.value })}
      error={Boolean(fallo.importe)}
      helperText={fallo.importe ?? undefined}
      slotProps={{ htmlInput: { min: 0.01, max: 99999999.99, step: 0.01 } }}
      fullWidth
    />
  </>
}
