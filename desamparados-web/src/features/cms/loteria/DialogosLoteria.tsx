import { useState, type ReactNode } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material'
import type { MetodoDeLoteria, Sorteo, Talonario } from '../../../lib/api/loteria'
import { euros } from '../contabilidad/formato'
import { aNumero } from './aNumero'

const METODOS_DE_LOTERIA: { valor: MetodoDeLoteria; etiqueta: string }[] = [
  { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
  { valor: 'BIZUM', etiqueta: 'Bizum' },
  { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
  { valor: 'TARJETA', etiqueta: 'Tarjeta' },
]

const entero = (texto: string): number | null => (/^\d+$/.test(texto.trim()) ? Number(texto.trim()) : null)

interface Base {
  abierto: boolean
  error: string | null
  ocupado: boolean
  onCerrar: () => void
}

/** Un diálogo corto de la lotería: título, campos y el botón que hace la cosa. */
function Dialogo({ abierto, titulo, error, ocupado, puede, texto, onHacer, onCerrar, children }: Base & { titulo: string; puede: boolean; texto: string; onHacer: () => void; children: ReactNode }) {
  return (
    <Dialog open={abierto} onClose={ocupado ? undefined : onCerrar} fullWidth maxWidth="xs">
      <DialogTitle>{titulo}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {children}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCerrar} disabled={ocupado}>Cancelar</Button>
        <Button variant="contained" disabled={!puede || ocupado} onClick={onHacer}>{ocupado ? 'Un momento…' : texto}</Button>
      </DialogActions>
    </Dialog>
  )
}

/** Dar uno o varios talonarios a alguien; sin nombre, vuelven a Secretaría. */
export function DialogoEntrega({ talonario, total, onEntregar, ...base }: Base & { talonario: Talonario | null; total: number; onEntregar: (e: { desde: number; hasta: number; responsable: string | null; telefono: string | null }) => void }) {
  const [desde, setDesde] = useState(String(talonario?.numero ?? 1))
  const [hasta, setHasta] = useState(String(talonario?.numero ?? 1))
  const [responsable, setResponsable] = useState(talonario?.responsable ?? '')
  const [telefono, setTelefono] = useState(talonario?.telefono ?? '')
  const d = entero(desde)
  const h = entero(hasta)
  const tramo = d !== null && h !== null && d >= 1 && h >= d && h <= total
  const recoger = responsable.trim() === ''
  return (
    <Dialogo {...base} titulo="Dar talonarios" texto={recoger ? 'Dejar en Secretaría' : 'Dar'} puede={tramo}
      onHacer={() => onEntregar({ desde: d!, hasta: h!, responsable: responsable.trim() || null, telefono: telefono.trim() || null })}>
      <Stack direction="row" spacing={2}>
        <TextField label="Del talonario" value={desde} onChange={(e) => setDesde(e.target.value)} slotProps={{ htmlInput: { inputMode: 'numeric' } }} fullWidth />
        <TextField label="Al talonario" value={hasta} onChange={(e) => setHasta(e.target.value)} slotProps={{ htmlInput: { inputMode: 'numeric' } }} error={!tramo} fullWidth />
      </Stack>
      <TextField label="A quién" value={responsable} onChange={(e) => setResponsable(e.target.value)} helperText="Un hermano, un bar del barrio… Vacío: vuelven a Secretaría." slotProps={{ htmlInput: { maxLength: 120 } }} />
      <TextField label="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} disabled={recoger} slotProps={{ htmlInput: { maxLength: 30, inputMode: 'tel' } }} />
      <Typography variant="body2" color="text.secondary">Los que ya están liquidados no cambian.</Typography>
    </Dialogo>
  )
}

/** Cerrar un talonario: cuántas se vendieron y cómo se pagó. Lo vendido se apunta en Contabilidad. */
export function DialogoLiquidacion({ talonario, sorteo, onLiquidar, ...base }: Base & { talonario: Talonario | null; sorteo: Sorteo; onLiquidar: (vendidas: number, metodo: MetodoDeLoteria | null) => void }) {
  const [vendidas, setVendidas] = useState(String(sorteo.porTalonario))
  const [metodo, setMetodo] = useState<MetodoDeLoteria>('EFECTIVO')
  const n = entero(vendidas)
  const valida = n !== null && n <= sorteo.porTalonario
  return (
    <Dialogo {...base} titulo={`Liquidar el talonario n.º ${talonario?.numero ?? ''}`} texto="Liquidar" puede={valida}
      onHacer={() => onLiquidar(n!, n! > 0 ? metodo : null)}>
      <TextField label="Vendidas" value={vendidas} onChange={(e) => setVendidas(e.target.value)} error={!valida}
        helperText={valida ? `${euros(n! * sorteo.precioParticipacion)}. Vuelven ${sorteo.porTalonario - n!} sin vender.` : `De 0 a ${sorteo.porTalonario}.`}
        slotProps={{ htmlInput: { inputMode: 'numeric' } }} />
      <TextField select label="Cómo lo ha pagado" value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoDeLoteria)} disabled={n === 0}>
        {METODOS_DE_LOTERIA.map((m) => <MenuItem key={m.valor} value={m.valor}>{m.etiqueta}</MenuItem>)}
      </TextField>
      <Typography variant="body2" color="text.secondary">El ingreso se apunta en Contabilidad, en «Lotería y rifas».</Typography>
    </Dialogo>
  )
}

/** Apuntar el gasto de los décimos. */
export function DialogoCompra({ sorteo, onApuntar, ...base }: Base & { sorteo: Sorteo; onApuntar: (metodo: MetodoDeLoteria) => void }) {
  const [metodo, setMetodo] = useState<MetodoDeLoteria>('TRANSFERENCIA')
  const decimos = sorteo.numeros.length * sorteo.decimos
  return (
    <Dialogo {...base} titulo="Apuntar la compra de los décimos" texto={`Apuntar ${euros(decimos * sorteo.precioDecimo)}`} puede onHacer={() => onApuntar(metodo)}>
      <Typography>{decimos} décimos de {euros(sorteo.precioDecimo)}: se apunta como gasto en Contabilidad, en «Compra de lotería».</Typography>
      <TextField select label="Cómo se ha pagado" value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoDeLoteria)}>
        {METODOS_DE_LOTERIA.map((m) => <MenuItem key={m.valor} value={m.valor}>{m.etiqueta}</MenuItem>)}
      </TextField>
    </Dialogo>
  )
}

/** Lo que gana un décimo de cada número, tras el sorteo. */
export function DialogoPremios({ sorteo, onGuardar, ...base }: Base & { sorteo: Sorteo; onGuardar: (premios: (number | null)[]) => void }) {
  const [premios, setPremios] = useState(sorteo.numeros.map((n) => (n.premio === null ? '' : String(n.premio).replace('.', ','))))
  const leidos = premios.map((p) => (p.trim() === '' ? null : aNumero(p)))
  const validos = premios.every((p, i) => p.trim() === '' || leidos[i] !== null)
  return (
    <Dialogo {...base} titulo="Premios" texto="Guardar" puede={validos} onHacer={() => onGuardar(leidos)}>
      <Typography variant="body2" color="text.secondary">Lo que cobra un décimo de cada número, como sale en la lista oficial. Vacío: no ha tocado.</Typography>
      {sorteo.numeros.map((n, i) => (
        <TextField key={n.numero} label={`Premio al décimo del ${n.numero} (€)`} value={premios[i]} error={premios[i].trim() !== '' && leidos[i] === null}
          onChange={(e) => setPremios(premios.map((p, j) => (j === i ? e.target.value : p)))} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
      ))}
    </Dialogo>
  )
}

/** Qué talonarios imprimir: de una vez, como mucho los que caben en 2.000 participaciones. */
export function DialogoImprimir({ sorteo, onImprimir, ...base }: Base & { sorteo: Sorteo; onImprimir: (desde: number, hasta: number) => void }) {
  const tope = Math.max(1, Math.floor(2000 / sorteo.porTalonario))
  const [desde, setDesde] = useState('1')
  const [hasta, setHasta] = useState(String(Math.min(sorteo.talonarios, tope)))
  const d = entero(desde)
  const h = entero(hasta)
  const tramo = d !== null && h !== null && d >= 1 && h >= d && h <= sorteo.talonarios && h - d + 1 <= tope
  return (
    <Dialogo {...base} titulo="Imprimir participaciones" texto="Imprimir" puede={tramo} onHacer={() => onImprimir(d!, h!)}>
      <Stack direction="row" spacing={2}>
        <TextField label="Del talonario" value={desde} onChange={(e) => setDesde(e.target.value)} slotProps={{ htmlInput: { inputMode: 'numeric' } }} fullWidth />
        <TextField label="Al talonario" value={hasta} onChange={(e) => setHasta(e.target.value)} error={!tramo} slotProps={{ htmlInput: { inputMode: 'numeric' } }} fullWidth />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Cinco por hoja, cada una con su matriz. Cada talonario empieza en hoja nueva. Como mucho {tope} talonarios por archivo.
      </Typography>
    </Dialogo>
  )
}
