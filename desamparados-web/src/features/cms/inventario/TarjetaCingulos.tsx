import { useState } from 'react'
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import type { RecuentoDeCingulos } from '../../../lib/api/inventario'
import { deLaCorporacion } from '../../../domain/articulos'

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
    <Paper component="section" aria-labelledby="cingulos-titulo" sx={{ px: { xs: 2, md: 2.5 }, py: 1.5, mb: 2.5, display: 'grid', gap: 1.5 }}>
      {/* Una franja y no cuatro casillas: es una cuenta, no lo principal del ropero. */}
      {/* En el PC, todo en una línea; en el móvil, el título con «Cambiar» y
          debajo las cuatro cifras en rejilla, que en línea se partían a trozos. */}
      <Box sx={{ display: 'grid', alignItems: 'center', columnGap: 3, rowGap: 1, minHeight: 44, gridTemplateColumns: { xs: '1fr auto', md: 'auto repeat(4, max-content) 1fr auto' } }}>
        <Typography id="cingulos-titulo" component="h2" sx={{ fontSize: 17, fontWeight: 600 }}>Cíngulos</Typography>
        {recuento && (
          <Box sx={{ display: { xs: 'grid', md: 'contents' }, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, gridColumn: { xs: '1 / -1', md: 'auto' }, gridRow: { xs: 2, md: 'auto' } }}>
            <Cifra valor={recuento.total} texto={deLaCorporacion({ corto: true })} />
            <Cifra valor={recuento.enElRopero} texto="en el ropero" />
            <Cifra valor={recuento.prestados} texto={recuento.prestados === 1 ? 'prestado' : 'prestados'} />
            <Cifra valor={recuento.debidos} texto={recuento.debidos === 1 ? 'se debe' : 'se deben'} />
          </Box>
        )}
        <Box sx={{ display: { xs: 'none', md: 'block' } }} />
        {recuento && !editando ? (
          <Button size="small" onClick={() => { setTexto(String(recuento.total)); setError(null); setEditando(true) }} sx={{ textTransform: 'none', fontSize: 14, justifySelf: 'end', gridRow: { xs: 1, md: 'auto' }, gridColumn: { xs: 2, md: 'auto' } }}>Cambiar el total</Button>
        ) : <span />}
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
      {recuento && faltan > 0 && (
        <Alert severity="warning">
          Se deben {recuento.debidos} y en el ropero {recuento.enElRopero === 1 ? 'queda 1' : `quedan ${recuento.enElRopero}`}: hay que pedir o hacer {faltan} más.
        </Alert>
      )}
    </Paper>
  )
}

/** Una cifra de la franja: el número, grande, y lo que cuenta (en el móvil, debajo). */
function Cifra({ valor, texto }: { valor: number; texto: string }) {
  return (
    <Typography component="span" sx={{ fontSize: { xs: 12.5, md: 14.5 }, color: 'text.secondary', whiteSpace: 'nowrap', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'flex-start', md: 'baseline' }, lineHeight: 1.3 }}>
      <Box component="span" sx={{ fontSize: 20, fontWeight: 600, color: 'text.primary', fontVariantNumeric: 'tabular-nums', mr: { md: 0.75 } }}>{valor}</Box>
      {texto}
    </Typography>
  )
}
