import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import CamposCertificado from '../../components/CamposCertificado'
import { SIN_CERTIFICADO, certificadoCompleto, datosFiscalesDe } from '../../lib/certificado'
import { enfocarLoQueFalla } from '../../lib/enfocarLoQueFalla'
import { esTelefonoValido, normalizarTelefono } from '../../lib/validacion/identidad'
import { Alert, Box, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { Link, useNavigate } from 'react-router-dom'
import MetaDePagina from '../../components/MetaDePagina'
import CabeceraDePagina from '../../components/CabeceraDePagina'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import Boton from '../../components/Boton'
import FotoConPiezas from '../../components/apadrinamiento/FotoConPiezas'
import { apadrinar, campanasPublicas, type CampanasPublicas, type Pieza } from '../../lib/api/apadrinamientos'
import type { MetodoEnLinea } from '../../lib/api/tienda'
import { irAlBanco } from '../../lib/api/procesion'
import { site } from '../../config/site'
import { euros } from '../../lib/euros'

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
  const [certificado, setCertificado] = useState(SIN_CERTIFICADO)

  useEffect(() => {
    let cancelado = false
    campanasPublicas()
      .then((d) => { if (!cancelado) setDatos(d) })
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se han podido cargar los apadrinamientos.') })
    return () => { cancelado = true }
  }, [])

  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
  /*
   * «Pagar» no se queda en gris sin decir por qué: al pulsarlo, si falta algo,
   * se marca en su campo y el foco va a lo primero.
   */
  const [intentado, setIntentado] = useState(false)
  const formulario = useRef<HTMLDivElement>(null)
  const fallos = {
    nombre: form.nombre.trim() === '' ? 'Escribe tu nombre.' : null,
    email: form.email.trim() === '' ? 'Escribe tu correo.' : !correoValido ? 'Revisa el correo: tiene que ser como nombre@dominio.es.' : null,
    telefono: form.telefono.trim() === '' ? 'Escribe tu teléfono.' : !esTelefonoValido(form.telefono) ? 'Un teléfono de nueve cifras.' : null,
  }
  const fallo = (campo: keyof typeof fallos) => (intentado ? fallos[campo] : null)
  const listo = !fallos.nombre && !fallos.email && !fallos.telefono && certificadoCompleto(certificado)

  const pagar = async () => {
    if (!elegida) return
    if (!listo) {
      flushSync(() => setIntentado(true))
      enfocarLoQueFalla(formulario.current)
      return
    }
    setEnviando(true); setErrorForm(null)
    try {
      // El servidor guarda nueve dígitos pelados: «+34 600 12 34 56» también vale.
      const r = await apadrinar({ piezaId: elegida.id, nombre: form.nombre, email: form.email.trim(), telefono: normalizarTelefono(form.telefono), dedicatoria: form.dedicatoria.trim() || null, mostrarNombre: form.mostrarNombre, metodo: form.metodo, ...(certificado.quiere && { fiscal: datosFiscalesDe(certificado) }) })
      if (r.tipo === 'banco') irAlBanco(r)
      else navegar(`/apadrina/gracias/${r.token}`)
    } catch (err: unknown) {
      setErrorForm(err instanceof Error ? err.message : 'No se ha podido apadrinar.')
      setEnviando(false)
    }
  }

  return <>
    <MetaDePagina titulo="Apadrina" descripcion={`Apadrina una vela, una flor o una pieza del ajuar de ${site.titular}.`} />
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
              <FotoConPiezas foto={c.foto} titulo={c.titulo} piezas={c.piezas} elegida={elegida?.id ?? null} onElegir={datos.pagoDisponible ? (p) => { setElegida(p); setErrorForm(null); setIntentado(false) } : undefined} />
            </Box>
          </Box>
        ))}
      </Box>
    </ContenedorDePagina>

    <Dialog open={elegida !== null} onClose={enviando ? undefined : () => setElegida(null)} fullWidth maxWidth="sm" aria-labelledby="apadrinar-titulo">
      {elegida && <>
        <DialogTitle id="apadrinar-titulo">Apadrinar {elegida.nombre} · {euros(elegida.precio)}</DialogTitle>
        <DialogContent ref={formulario}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Nombre y apellidos" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} fullWidth
              error={!!fallo('nombre')} helperText={fallo('nombre')} slotProps={{ htmlInput: { maxLength: 120, autoComplete: 'name' } }} />
            <TextField label="Correo" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth
              error={!!fallo('email')} helperText={fallo('email') ?? 'Te mandamos ahí la confirmación.'} slotProps={{ htmlInput: { autoComplete: 'email' } }} />
            <TextField label="Teléfono" type="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} fullWidth
              error={!!fallo('telefono')} helperText={fallo('telefono')} slotProps={{ htmlInput: { autoComplete: 'tel' } }} />
            <TextField label="Dedicatoria (opcional)" value={form.dedicatoria} onChange={(e) => setForm({ ...form, dedicatoria: e.target.value })} fullWidth slotProps={{ htmlInput: { maxLength: 200 } }} helperText="Por ejemplo: «En memoria de mis padres»." />
            <FormControlLabel control={<Checkbox checked={form.mostrarNombre} onChange={(e) => setForm({ ...form, mostrarNombre: e.target.checked })} />} label="Que mi nombre y la dedicatoria salgan en la foto" />
            <CamposCertificado valor={certificado} onChange={setCertificado} marcarVacios={intentado} />
            {datos && datos.metodos.length > 1 && (
              <TextField select label="Pagar con" value={form.metodo} onChange={(e) => setForm({ ...form, metodo: e.target.value as MetodoEnLinea })} fullWidth>
                {datos.metodos.map((m) => <MenuItem key={m} value={m}>{m === 'BIZUM' ? 'Bizum' : 'Tarjeta'}</MenuItem>)}
              </TextField>
            )}
            {errorForm && <Alert severity="error">{errorForm}</Alert>}
            {/* La primera capa de información que pide el RGPD donde se recogen los datos; el resto, en la política. */}
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
              Tus datos solo se usan para el apadrinamiento y, si pides el certificado, para declararlo a Hacienda (modelo 182). Más en la{' '}
              <Box component={Link} to="/politica-privacidad" target="_blank" sx={{ color: 'secondary.main' }}>política de privacidad</Box>.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Boton appVariant="outline" onClick={() => setElegida(null)} disabled={enviando}>Volver</Boton>
          <Boton onClick={() => void pagar()} disabled={enviando}>{enviando ? 'Un momento…' : `Pagar ${euros(elegida.precio)}`}</Boton>
        </DialogActions>
      </>}
    </Dialog>
  </>
}
