import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, FormControlLabel, Paper, Switch, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate } from 'react-router-dom'
import { campanasDelCms, crearCampana, type CampanaEnLista, type DatosCampana } from '../../lib/api/apadrinamientos'
import CabeceraSeccion from './CabeceraSeccion'
import VentanaFormulario from './VentanaFormulario'
import CampoImagen from './CampoImagen'
import { euros } from './contabilidad/formato'
import { site } from '../../config/site'

const VACIA: DatosCampana = { titulo: '', descripcion: '', foto: '', activa: true }

/**
 * Las campañas de apadrinamiento: la lista con lo recaudado y «Nueva», que
 * crea la campaña y lleva a su pantalla para colocar las piezas en la foto.
 */
export default function ApadrinamientosAdminPage() {
  const navegar = useNavigate()
  const [lista, setLista] = useState<CampanaEnLista[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nueva, setNueva] = useState<DatosCampana | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorNueva, setErrorNueva] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    campanasDelCms()
      .then((l) => { if (!cancelado) setLista(l) })
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se han podido cargar las campañas.') })
    return () => { cancelado = true }
  }, [])

  const crear = async () => {
    if (!nueva) return
    setGuardando(true); setErrorNueva(null)
    try { const c = await crearCampana(nueva); navegar(`/cms/apadrinamientos/${c.id}`) }
    catch (err: unknown) { setErrorNueva(err instanceof Error ? err.message : 'No se ha podido crear.') }
    finally { setGuardando(false) }
  }

  return <>
    <Helmet><title>{`Apadrinamientos | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Apadrinamientos" subtitulo="Fotos con piezas para que cada una la costee un padrino.">
      <Button variant="outlined" component={Link} to="/apadrina" target="_blank" startIcon={<OpenInNewIcon />}>Ver en la web</Button>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setErrorNueva(null); setNueva(VACIA) }}>Nueva campaña</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {!lista && !error && <CircularProgress aria-label="Cargando las campañas" />}
    {lista?.length === 0 && <Alert severity="info">Todavía no hay ninguna. Crea la primera con «Nueva campaña».</Alert>}
    {lista && lista.length > 0 && (
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } }}>
        {lista.map((c) => (
          <Paper key={c.id} component={Link} to={`/cms/apadrinamientos/${c.id}`} sx={{ overflow: 'hidden', textDecoration: 'none', color: 'inherit', opacity: c.activa ? 1 : 0.65 }}>
            <Box component="img" src={c.foto} alt="" sx={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block' }} />
            <Box sx={{ p: 2, display: 'grid', gap: 0.5 }}>
              <Typography sx={{ fontWeight: 600 }}>{c.titulo}</Typography>
              <Typography variant="body2" color="text.secondary">{c.apadrinadas} de {c.piezas} piezas apadrinadas · {euros(c.recaudado)}</Typography>
              {!c.activa && <Chip size="small" label="Retirada de la web" sx={{ justifySelf: 'start' }} />}
            </Box>
          </Paper>
        ))}
      </Box>
    )}

    <VentanaFormulario
      abierto={nueva !== null}
      titulo="Nueva campaña"
      textoGuardar="Crear y colocar las piezas"
      sucio={Boolean(nueva && (nueva.titulo || nueva.foto))}
      guardando={guardando}
      puedeGuardar={Boolean(nueva?.titulo.trim() && nueva.foto)}
      error={errorNueva}
      onGuardar={crear}
      onCerrar={() => setNueva(null)}
    >
      {nueva && <>
        <TextField label="Título" value={nueva.titulo} onChange={(e) => setNueva({ ...nueva, titulo: e.target.value })} slotProps={{ htmlInput: { maxLength: 150 } }} fullWidth />
        <TextField label="Descripción" value={nueva.descripcion} onChange={(e) => setNueva({ ...nueva, descripcion: e.target.value })} multiline minRows={2} fullWidth />
        <CampoImagen valor={nueva.foto} onCambio={(foto) => setNueva({ ...nueva, foto })} etiqueta="Foto" apaisada />
        <FormControlLabel control={<Switch checked={nueva.activa} onChange={(e) => setNueva({ ...nueva, activa: e.target.checked })} />} label="Se ve en la web" />
      </>}
    </VentanaFormulario>
  </>
}
