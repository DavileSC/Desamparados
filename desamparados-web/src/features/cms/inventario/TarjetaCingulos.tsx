import { useState } from 'react'
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import type { RecuentoDeCingulos } from '../../../lib/api/inventario'
import { deLaCorporacion, mayuscula } from '../../../domain/articulos'

interface Props {
  recuento: RecuentoDeCingulos | null
  onGuardar: (total: number) => Promise<void>
}

/**
 * Los cíngulos del ropero. No van numerados (son todos iguales): se cuentan.
 * Aquí se apunta cuántos tiene el Grupo cuando se compran o se hacen más; los
 * prestados y los que se deben salen de la mesa. Si no quedan para los que
 * se deben, lo dice: hay que pedir o hacer más.
 */
export default function TarjetaCingulos({ recuento, onGuardar }: Props) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nuevo = Number(texto.trim())
  const valido = /^\d{1,4}$/.test(texto.trim()) && (!recuento || nuevo >= recuento.prestados)

  const guardar = async () => {
    setGuardando(true); setError(null)
    try { await onGuardar(nuevo); setEditando(false) } catch (e) { setError(e instanceof Error ? e.message : 'No se ha podido guardar.') } finally { setGuardando(false) }
  }

  const faltan = recuento ? recuento.debidos - recuento.enElRopero : 0
  return (
    <Paper component="section" aria-labelledby="cingulos-titulo" sx={{ p: { xs: 2, md: 2.5 }, mb: 2.5, display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Typography id="cingulos-titulo" component="h2" sx={{ fontSize: 17, fontWeight: 600 }}>Cíngulos</Typography>
        {recuento && !editando && (
          <Button size="small" onClick={() => { setTexto(String(recuento.total)); setError(null); setEditando(true) }}>Cambiar el total</Button>
        )}
      </Box>

      {editando && recuento && (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'flex-start' }} component="form" onSubmit={(e) => { e.preventDefault(); if (valido) void guardar() }}>
          <TextField
            size="small" label={`Cíngulos ${deLaCorporacion({ corto: true })}`} value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus error={!valido}
            helperText={valido ? 'Todos, estén prestados o en el ropero' : `No puede ser menos que los ${recuento.prestados} prestados`}
            slotProps={{ htmlInput: { inputMode: 'numeric' } }} sx={{ width: 220 }}
          />
          <Button onClick={() => setEditando(false)} disabled={guardando}>Volver</Button>
          <Button type="submit" variant="contained" disabled={guardando || !valido}>Guardar</Button>
        </Stack>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      {recuento && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1.25 }}>
          <Cifra titulo={mayuscula(deLaCorporacion({ corto: true }))} valor={recuento.total} />
          <Cifra titulo="En el ropero" valor={recuento.enElRopero} />
          <Cifra titulo="Prestados" valor={recuento.prestados} detalle="sin devolver" />
          <Cifra titulo="Se deben" valor={recuento.debidos} detalle="no había al recoger" />
        </Box>
      )}
      {recuento && faltan > 0 && (
        <Alert severity="warning">
          Se deben {recuento.debidos} y en el ropero {recuento.enElRopero === 1 ? 'queda 1' : `quedan ${recuento.enElRopero}`}: hay que pedir o hacer {faltan} más.
        </Alert>
      )}
    </Paper>
  )
}

function Cifra({ titulo, valor, detalle }: { titulo: string; valor: number; detalle?: string }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 1, backgroundColor: 'action.hover' }}>
      <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary' }}>{titulo}</Typography>
      <Typography sx={{ mt: 0.25, fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{valor}</Typography>
      {detalle && <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{detalle}</Typography>}
    </Box>
  )
}
