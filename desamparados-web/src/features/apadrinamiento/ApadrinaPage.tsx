import { useEffect, useState } from 'react'
import { Alert, Box, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import MetaDePagina from '../../components/MetaDePagina'
import CabeceraDePagina from '../../components/CabeceraDePagina'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import Boton from '../../components/Boton'
import FotoConPiezas from '../../components/apadrinamiento/FotoConPiezas'
import { apadrinar, campanasPublicas, type CampanasPublicas, type Pieza } from '../../lib/api/apadrinamientos'
import type { MetodoEnLinea } from '../../lib/api/tienda'
import { irAlBanco } from '../../lib/api/procesion'

const euros = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
const VACIO = { nombre: '', email: '', telefono: '', dedicatoria: '', mostrarNombre: true, metodo: 'TARJETA' as MetodoEnLinea }

/**
 * Apadrinar sobre la foto: cada campaña enseña su foto con las piezas; se
 * elige una libre, se dan los datos y se paga, sin cuenta.
 */
export default function ApadrinaPage() {
  const navegar = useNavigate()
  const [datos, setDatos] = useState<CampanasPublicas | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elegida, setElegida] = useState<Pieza | null>(null)
  const [form, setForm] = useState(VACIO)
  const [enviando, setEnviando] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    campanasPublicas()
      .then((d) => { if (!cancelado) setDatos(d) })
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se han podido cargar los apadrinamientos.') })
    return () => { cancelado = true }
  }, [])

  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  const listo = form.nombre.trim() !== '' && correoValido && form.telefono.trim().length >= 9

  const pagar = async () => {
    if (!elegida) return
    setEnviando(true); setErrorForm(null)
    try {
      const r = await apadrinar({ piezaId: elegida.id, nombre: form.nombre, email: form.email, telefono: form.telefono, dedicatoria: form.dedicatoria.trim() || null, mostrarNombre: form.mostrarNombre, metodo: form.metodo })
      if (r.tipo === 'banco') irAlBanco(r)
      else navegar(`/apadrina/gracias/${r.token}`)
    } catch (err: unknown) {
      setErrorForm(err instanceof Error ? err.message : 'No se ha podido apadrinar.')
      setEnviando(false)
    }
  }

  return <>
    <MetaDePagina titulo="Apadrina" descripcion="Apadrina una vela, una flor o una pieza del ajuar de Nuestra Señora de los Desamparados." />
    <CabeceraDePagina title="Apadrina" subtitle="Elige sobre la foto la pieza que quieres costear. Las marcadas con ✓ ya tienen padrino." />
    <ContenedorDePagina>
      <Box sx={{ py: { xs: 4, md: 6 }, display: 'grid', gap: 6 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {!datos && !error && <CircularProgress aria-label="Cargando los apadrinamientos" />}
        {datos?.campanas.length === 0 && <Alert severity="info">Ahora mismo no hay nada que apadrinar. Vuelve pronto.</Alert>}
        {datos && !datos.pagoDisponible && datos.campanas.length > 0 && <Alert severity="info">Todavía no se puede apadrinar en línea: pregunta en Secretaría.</Alert>}
        {datos?.campanas.map((c) => (
          <Box component="section" key={c.id} aria-labelledby={`campana-${c.id}`} sx={{ display: 'grid', gap: 2 }}>
            <Box>
              <Typography id={`campana-${c.id}`} component="h2" variant="h4">{c.titulo}</Typography>
              {c.descripcion && <Typography sx={{ color: 'text.secondary', mt: 1, maxWidth: 760 }}>{c.descripcion}</Typography>}
              <Typography variant="body2" sx={{ mt: 1 }}>{c.libres === 0 ? 'Todas las piezas tienen padrino. ¡Gracias!' : c.libres === 1 ? 'Queda 1 pieza libre.' : `Quedan ${c.libres} piezas libres.`}</Typography>
            </Box>
            <Box sx={{ maxWidth: 900 }}>
              <FotoConPiezas foto={c.foto} titulo={c.titulo} piezas={c.piezas} elegida={elegida?.id ?? null} onElegir={datos.pagoDisponible ? (p) => { setElegida(p); setErrorForm(null) } : undefined} />
            </Box>
          </Box>
        ))}
      </Box>
    </ContenedorDePagina>

    <Dialog open={elegida !== null} onClose={enviando ? undefined : () => setElegida(null)} fullWidth maxWidth="sm" aria-labelledby="apadrinar-titulo">
      {elegida && <>
        <DialogTitle id="apadrinar-titulo">Apadrinar {elegida.nombre} · {euros(elegida.precio)}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Nombre y apellidos" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} fullWidth slotProps={{ htmlInput: { maxLength: 120, autoComplete: 'name' } }} />
            <TextField label="Correo" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth helperText="Te mandamos ahí la confirmación." slotProps={{ htmlInput: { autoComplete: 'email' } }} />
            <TextField label="Teléfono" type="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} fullWidth slotProps={{ htmlInput: { autoComplete: 'tel' } }} />
            <TextField label="Dedicatoria (opcional)" value={form.dedicatoria} onChange={(e) => setForm({ ...form, dedicatoria: e.target.value })} fullWidth slotProps={{ htmlInput: { maxLength: 200 } }} helperText="Por ejemplo: «En memoria de mis padres»." />
            <FormControlLabel control={<Checkbox checked={form.mostrarNombre} onChange={(e) => setForm({ ...form, mostrarNombre: e.target.checked })} />} label="Que mi nombre y la dedicatoria salgan en la foto" />
            {datos && datos.metodos.length > 1 && (
              <TextField select label="Pagar con" value={form.metodo} onChange={(e) => setForm({ ...form, metodo: e.target.value as MetodoEnLinea })} fullWidth>
                {datos.metodos.map((m) => <MenuItem key={m} value={m}>{m === 'BIZUM' ? 'Bizum' : 'Tarjeta'}</MenuItem>)}
              </TextField>
            )}
            {errorForm && <Alert severity="error">{errorForm}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Boton appVariant="outline" onClick={() => setElegida(null)} disabled={enviando}>Volver</Boton>
          <Boton onClick={() => void pagar()} disabled={!listo || enviando}>{enviando ? 'Un momento…' : `Pagar ${euros(elegida.precio)}`}</Boton>
        </DialogActions>
      </>}
    </Dialog>
  </>
}
