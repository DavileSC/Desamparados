import { useState } from 'react'
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import { cobrarEnMesa, perdonarCuotas, type FichaDeMesa, type MetodoEnMesa } from '../../../lib/api/mesa'
import { leyenda } from './datosDeLaFicha'
import { AvisoSituacion, type Aviso } from './piezas'
import { METODOS, NOMBRE_METODO, euros } from './formato'
import { mensajeDeFallo, useClaveDeOperacion } from './enVivo'

interface Props {
  ficha: FichaDeMesa
  role: string
  onHecho: (aviso: Aviso) => void
  onRecargar: () => void
}

interface Linea {
  /** «r-12» para un recibo, «s-3» para lo de la salida de una solicitud. */
  clave: string
  reciboId?: number
  solicitudId?: number
  quien: string | null
  concepto: string
  importe: number
  cuota: boolean
  devuelta: boolean
  donativo: boolean
}

/**
 * Zona de Tesorería: cobrar de una vez lo que la persona tiene pendiente (sus
 * cuotas, las de su familia si paga por ellos, la papeleta o el donativo del
 * Rosario) o, si el Hermano Mayor lo decide, perdonar la cuota. Todo viene
 * marcado: lo normal es confirmar el importe y la forma de pago, y pulsar.
 */
export default function ZonaTesoreria({ ficha, role, onHecho, onRecargar }: Props) {
  const solicitud = ficha.solicitud
  const lineas: Linea[] = [
    // Lo de la salida (la cuota de salida o la voluntad del Rosario): se vuelve recibo al cobrarlo.
    ...(solicitud && solicitud.pendiente > 0
      ? [{
          clave: `s-${solicitud.id}`, solicitudId: solicitud.id, quien: null, concepto: solicitud.concepto, importe: solicitud.pendiente,
          cuota: false, devuelta: false, donativo: ficha.salida === 'ROSARIO',
        }]
      : []),
    ...ficha.requisitos.cuotasPendientes.map((c) => ({
      clave: `r-${c.id}`, reciboId: c.id, quien: null, concepto: c.concepto, importe: c.importe, cuota: true, devuelta: c.estado === 'DEVUELTO', donativo: false,
    })),
    ...ficha.familia.flatMap((f) => f.cuotasPendientes.map((c) => ({
      clave: `r-${c.id}`, reciboId: c.id, quien: f.nombre, concepto: c.concepto, importe: c.importe, cuota: true, devuelta: c.estado === 'DEVUELTO', donativo: false,
    }))),
  ]
  // Lo de la familia viene sin marcar: se cobra si lo paga quien está delante.
  const [marcadas, setMarcadas] = useState<string[]>(() => lineas.filter((l) => l.quien === null).map((l) => l.clave))
  const [donativos, setDonativos] = useState<Record<string, string>>({})
  const [metodo, setMetodo] = useState<MetodoEnMesa>('EFECTIVO')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [perdonando, setPerdonando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const cobro = useClaveDeOperacion()
  const perdon = useClaveDeOperacion()

  const puedePerdonar = ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'].includes(role)
  const importeDe = (l: Linea) => {
    const escrito = donativos[l.clave]
    if (!l.donativo || escrito === undefined) return l.importe
    const n = Number(escrito.replace(',', '.'))
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN
  }
  const elegidas = lineas.filter((l) => marcadas.includes(l.clave))
  const total = elegidas.reduce((s, l) => s + Math.round(importeDe(l) * 100), 0) / 100
  const valido = elegidas.length > 0 && Number.isFinite(total) && elegidas.every((l) => importeDe(l) <= 1000)
  const cuotasElegidas = elegidas.filter((l) => l.cuota)
  const siguiente = ficha.solicitud ? 'Que pase a Túnicas.' : 'Que pase a Inscripción.'

  const alternar = (clave: string) => setMarcadas((m) => (m.includes(clave) ? m.filter((x) => x !== clave) : [...m, clave]))

  const cobrar = async () => {
    setEnviando(true); setError(null)
    try {
      const r = await cobrarEnMesa({
        hermanoId: ficha.id,
        reciboIds: elegidas.flatMap((l) => (l.reciboId ? [l.reciboId] : [])),
        solicitudes: elegidas.flatMap((l) => (l.solicitudId ? [{ solicitudId: l.solicitudId, ...(l.donativo && { importe: importeDe(l) }) }] : [])),
        metodoPago: metodo,
        clave: cobro.clave,
      })
      cobro.renovar()
      onHecho({ tono: 'success', texto: `${ficha.nombre}: ${r.total === 0 ? 'sin nada que cobrar' : `cobrado ${euros(r.total)} en ${NOMBRE_METODO[metodo].toLowerCase()}`}. ${siguiente}` })
    } catch (e) {
      setError(mensajeDeFallo(e, 'No se ha podido cobrar.'))
    } finally {
      setEnviando(false)
    }
  }

  const perdonar = async () => {
    setEnviando(true); setError(null)
    try {
      await perdonarCuotas({ reciboIds: cuotasElegidas.map((l) => l.reciboId!), clave: perdon.clave, ...(motivo.trim() && { motivo: motivo.trim() }) })
      perdon.renovar()
      setPerdonando(false)
      onHecho({ tono: 'success', texto: `${ficha.nombre}: ${cuotasElegidas.length === 1 ? 'cuota perdonada' : `${cuotasElegidas.length} cuotas perdonadas`}. ${siguiente}` })
    } catch (e) {
      setPerdonando(false)
      setError(mensajeDeFallo(e, 'No se ha podido perdonar.'))
    } finally {
      setEnviando(false)
    }
  }

  if (lineas.length === 0) {
    return (
      <Stack spacing={2}>
        <AvisoSituacion ficha={ficha} role={role} onRecargar={onRecargar} />
        <Alert severity="success">No tiene nada pendiente. {siguiente}</Alert>
        {ficha.requisitos.cuotasEnElBanco.length > 0 && (
          <Typography variant="body2" color="text.secondary">Tiene {ficha.requisitos.cuotasEnElBanco.length === 1 ? 'una cuota' : `${ficha.requisitos.cuotasEnElBanco.length} cuotas`} en el banco, cobrándose por domiciliación.</Typography>
        )}
      </Stack>
    )
  }

  return (
    <Stack spacing={2.25} component="form" onSubmit={(e) => { e.preventDefault(); if (valido) void cobrar() }}>
      <AvisoSituacion ficha={ficha} role={role} onRecargar={onRecargar} />
      {ficha.requisitos.cuotasPendientes.length > 2 && (
        <Alert severity="warning">Debe {ficha.requisitos.cuotasPendientes.length} cuotas: más de dos atrasadas hacen perder la condición de hermano si no se ponen al día.</Alert>
      )}

      <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
        <Typography component="legend" sx={leyenda}>Por pagar</Typography>
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 0.5 }}>
          {lineas.map((l) => (
            <Box component="li" key={l.clave} sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider', py: 0.5 }}>
              <Checkbox size="small" checked={marcadas.includes(l.clave)} onChange={() => alternar(l.clave)} slotProps={{ input: { 'aria-label': `Cobrar ${l.concepto}${l.quien ? ` de ${l.quien}` : ''}` } }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14.5, fontWeight: 600 }}>{l.concepto}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {[l.quien && `De ${l.quien}`, l.devuelta && 'Devuelta por el banco: se cobra su reemisión', l.donativo && 'La voluntad: se puede cambiar'].filter(Boolean).join(' · ') || ' '}
                </Typography>
              </Box>
              {l.donativo ? (
                <TextField
                  size="small" value={donativos[l.clave] ?? String(l.importe).replace('.', ',')}
                  onChange={(e) => setDonativos({ ...donativos, [l.clave]: e.target.value })}
                  error={!Number.isFinite(importeDe(l))}
                  slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': 'Donativo', style: { textAlign: 'right', width: 72 } } }}
                />
              ) : (
                <Typography sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{euros(l.importe)}</Typography>
              )}
            </Box>
          ))}
        </Box>
      </Box>

      <ToggleButtonGroup exclusive size="small" fullWidth value={metodo} onChange={(_e, v: MetodoEnMesa | null) => v && setMetodo(v)} aria-label="Forma de pago">
        {METODOS.map((m) => <ToggleButton key={m.valor} value={m.valor}>{m.etiqueta}</ToggleButton>)}
      </ToggleButtonGroup>

      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        {puedePerdonar && cuotasElegidas.length > 0
          ? <Button onClick={() => setPerdonando(true)} disabled={enviando}>Perdonar {cuotasElegidas.length === 1 ? 'la cuota' : 'las cuotas'}</Button>
          : <span />}
        <Button type="submit" variant="contained" size="large" disabled={enviando || !valido}>
          {enviando ? 'Cobrando…' : `Cobrar ${Number.isFinite(total) ? euros(total) : ''}`}
        </Button>
      </Stack>

      <Dialog open={perdonando} onClose={() => !enviando && setPerdonando(false)} maxWidth="xs" fullWidth>
        <DialogTitle>¿Perdonar {cuotasElegidas.length === 1 ? 'la cuota' : `${cuotasElegidas.length} cuotas`}?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Lo decide el Hermano Mayor. {cuotasElegidas.map((l) => l.concepto).join(', ')} quedará como perdonada, y así lo verá el hermano en su área.
          </DialogContentText>
          <TextField fullWidth size="small" label="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPerdonando(false)} disabled={enviando}>Volver</Button>
          <Button variant="contained" onClick={() => void perdonar()} disabled={enviando}>Perdonar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
