import { useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, FormControlLabel, Paper, Stack, Switch, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { Link, useParams } from 'react-router-dom'
import {
  cambiarPieza, campanaDelCms, guardarCampana, ponerPieza, quitarPieza, type Campana, type DatosCampana, type Pieza,
} from '../../lib/api/apadrinamientos'
import FotoConPiezas from '../../components/apadrinamiento/FotoConPiezas'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import CabeceraSeccion from './CabeceraSeccion'
import VentanaFormulario from './VentanaFormulario'
import CampoImagen from './CampoImagen'
import { euros, fechaCorta } from './contabilidad/formato'
import { site } from '../../config/site'

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)
const PRECIO = /^\d{1,5}(?:[.,]\d{1,2})?$/

interface EdicionPieza { id: number | null; nombre: string; precio: string; x: number; y: number; apadrinada: boolean }

/**
 * Una campaña: se pulsa en la foto para poner una pieza donde está (una vela,
 * una flor) y se pulsa una pieza para cambiarla. Debajo, quién apadrinó cada una.
 */
export default function CampanaApadrinamientoPage() {
  const id = Number(useParams().id)
  const [c, setC] = useState<Campana | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pieza, setPieza] = useState<EdicionPieza | null>(null)
  const [datos, setDatos] = useState<DatosCampana | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorVentana, setErrorVentana] = useState<string | null>(null)
  const [aQuitar, setAQuitar] = useState<Pieza | null>(null)

  useEffect(() => {
    let cancelado = false
    campanaDelCms(id)
      .then((x) => { if (!cancelado) setC(x) })
      .catch((err: unknown) => { if (!cancelado) setError(mensaje(err, 'No se ha podido cargar la campaña.')) })
    return () => { cancelado = true }
  }, [id])

  if (!c) return error ? <Alert severity="error">{error}</Alert> : <CircularProgress aria-label="Cargando la campaña" />

  const guardarPieza = async () => {
    if (!pieza) return
    setGuardando(true); setErrorVentana(null)
    const d = { nombre: pieza.nombre.trim(), precio: Number(pieza.precio.replace(',', '.')), x: pieza.x, y: pieza.y }
    try { setC(await (pieza.id === null ? ponerPieza(id, d) : cambiarPieza(id, pieza.id, d))); setPieza(null) }
    catch (err: unknown) { setErrorVentana(mensaje(err, 'No se ha podido guardar la pieza.')) }
    finally { setGuardando(false) }
  }

  const guardarDatos = async () => {
    if (!datos) return
    setGuardando(true); setErrorVentana(null)
    try { setC(await guardarCampana(id, datos)); setDatos(null) }
    catch (err: unknown) { setErrorVentana(mensaje(err, 'No se ha podido guardar.')) }
    finally { setGuardando(false) }
  }

  const quitar = async () => {
    if (!aQuitar) return
    const p = aQuitar
    setAQuitar(null); setPieza(null)
    try { setC(await quitarPieza(id, p.id)) }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido quitar.')) }
  }

  const apadrinadas = c.piezas.filter((p) => p.apadrinada)
  return <>
    <Helmet><title>{`${c.titulo} | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo={c.titulo} subtitulo={`${apadrinadas.length} de ${c.piezas.length} piezas apadrinadas · ${euros(apadrinadas.reduce((s, p) => s + p.precio, 0))}${c.activa ? '' : ' · retirada de la web'}`}>
      <Button variant="outlined" onClick={() => { setErrorVentana(null); setDatos({ titulo: c.titulo, descripcion: c.descripcion, foto: c.foto, activa: c.activa }) }}>Cambiar datos</Button>
      <Button component={Link} to="/cms/apadrinamientos">Volver</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Pulsa en la foto donde va una pieza para ponerla; pulsa una pieza para cambiarla o quitarla.</Typography>
    <Box sx={{ maxWidth: 900, mb: 3 }}>
      <FotoConPiezas
        foto={c.foto} titulo={c.titulo} piezas={c.piezas} elegida={pieza?.id ?? null} apadrinadasElegibles
        onPulsarFoto={(x, y) => { setErrorVentana(null); setPieza({ id: null, nombre: `Pieza ${c.piezas.length + 1}`, precio: c.piezas.at(-1)?.precio.toFixed(2).replace('.', ',') ?? '', x, y, apadrinada: false }) }}
        onElegir={(p) => { setErrorVentana(null); setPieza({ id: p.id, nombre: p.nombre, precio: p.precio.toFixed(2).replace('.', ','), x: p.x, y: p.y, apadrinada: p.apadrinada }) }}
      />
    </Box>

    {apadrinadas.length > 0 && (
      <Paper sx={{ p: 2.5, maxWidth: 900 }}>
        <Typography component="h2" sx={{ fontWeight: 600, mb: 1 }}>Padrinos</Typography>
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 1 }}>
          {apadrinadas.map((p) => (
            <Box component="li" key={p.id} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <Typography variant="body2"><strong>{p.nombre}</strong> · {p.padrino}{p.dedicatoria ? ` · «${p.dedicatoria}»` : ''}</Typography>
              <Typography variant="body2" color="text.secondary">
                {p.contacto?.email} · {p.contacto?.telefono}{p.contacto?.pagadoEl ? ` · ${fechaCorta(p.contacto.pagadoEl)}` : ''}{p.contacto && !p.contacto.mostrarNombre ? ' · anónimo en la web' : ''}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>
    )}

    <VentanaFormulario
      abierto={pieza !== null}
      titulo={pieza?.id === null ? 'Nueva pieza' : 'Cambiar la pieza'}
      sucio
      guardando={guardando}
      puedeGuardar={Boolean(pieza?.nombre.trim() && PRECIO.test(pieza.precio.trim()) && Number(pieza.precio.replace(',', '.')) > 0)}
      error={errorVentana}
      onGuardar={guardarPieza}
      onCerrar={() => setPieza(null)}
    >
      {pieza && <>
        <TextField label="Nombre" value={pieza.nombre} onChange={(e) => setPieza({ ...pieza, nombre: e.target.value })} helperText="Lo que se ve al pasar por encima: «Vela 3», «Jarra de la derecha»…" slotProps={{ htmlInput: { maxLength: 120 } }} fullWidth />
        <TextField label="Precio (€)" value={pieza.precio} onChange={(e) => setPieza({ ...pieza, precio: e.target.value })} disabled={pieza.apadrinada} helperText={pieza.apadrinada ? 'Ya está apadrinada: el precio no se cambia.' : undefined} slotProps={{ htmlInput: { inputMode: 'decimal' } }} fullWidth />
        {pieza.id !== null && !pieza.apadrinada && (
          <Stack direction="row"><Button color="error" onClick={() => setAQuitar(c.piezas.find((p) => p.id === pieza.id) ?? null)}>Quitar la pieza</Button></Stack>
        )}
      </>}
    </VentanaFormulario>

    <VentanaFormulario
      abierto={datos !== null}
      titulo="Datos de la campaña"
      sucio
      guardando={guardando}
      puedeGuardar={Boolean(datos?.titulo.trim() && datos.foto)}
      error={errorVentana}
      onGuardar={guardarDatos}
      onCerrar={() => setDatos(null)}
    >
      {datos && <>
        <TextField label="Título" value={datos.titulo} onChange={(e) => setDatos({ ...datos, titulo: e.target.value })} fullWidth />
        <TextField label="Descripción" value={datos.descripcion} onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })} multiline minRows={2} fullWidth />
        <CampoImagen valor={datos.foto} onCambio={(foto) => setDatos({ ...datos, foto })} etiqueta="Foto" apaisada sinQuitar />
        <FormControlLabel control={<Switch checked={datos.activa} onChange={(e) => setDatos({ ...datos, activa: e.target.checked })} />} label="Se ve en la web" />
      </>}
    </VentanaFormulario>

    <DialogoConfirmacion
      abierto={aQuitar !== null}
      titulo="¿Quitar la pieza?"
      mensaje={aQuitar ? `«${aQuitar.nombre}» deja de estar en la foto.` : ''}
      textoConfirmar="Quitar"
      peligro
      onConfirmar={() => void quitar()}
      onCancelar={() => setAQuitar(null)}
    />
  </>
}
