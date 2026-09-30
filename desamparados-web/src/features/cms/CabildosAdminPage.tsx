import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, Paper, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DownloadIcon from '@mui/icons-material/Download'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate } from 'react-router-dom'
import { cabildos, convocarCabildo, libroDeActas, type CabildoEnLista, type TipoCabildo } from '../../lib/api/cabildos'
import { guardarEnDisco } from '../../lib/api/datos'
import CabeceraSeccion from './CabeceraSeccion'
import VentanaFormulario from './VentanaFormulario'
import { fechaCabildo } from './cabildos/formato'

const ESTADO: Record<CabildoEnLista['estado'], { texto: string; color: 'default' | 'info' | 'success' }> = {
  CONVOCADO: { texto: 'Convocado', color: 'info' },
  CELEBRADO: { texto: 'Acta en redacción', color: 'default' },
  ACTA_APROBADA: { texto: 'Acta aprobada', color: 'success' },
}

interface Nuevo { tipo: TipoCabildo; fecha: string; lugar: string; puntos: string }
const VACIO: Nuevo = { tipo: 'ORDINARIO', fecha: '', lugar: '', puntos: '' }

/**
 * Los cabildos: la lista y «Convocar», en una ventana que crea el cabildo y
 * lleva a su pantalla (asistencia, votaciones y acta). Arriba, el libro de
 * actas del año en PDF.
 */
export default function CabildosAdminPage() {
  const navegar = useNavigate()
  const [lista, setLista] = useState<CabildoEnLista[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abierta, setAbierta] = useState(false)
  const [nuevo, setNuevo] = useState<Nuevo>(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState<string | null>(null)
  const [anioLibro, setAnioLibro] = useState(String(new Date().getFullYear()))

  useEffect(() => {
    let cancelado = false
    cabildos()
      .then((l) => { if (!cancelado) setLista(l) })
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se han podido cargar los cabildos.') })
    return () => { cancelado = true }
  }, [])

  const convocar = async () => {
    setGuardando(true); setErrorNuevo(null)
    try {
      const c = await convocarCabildo({
        tipo: nuevo.tipo,
        fecha: new Date(nuevo.fecha).toISOString(),
        lugar: nuevo.lugar.trim(),
        ordenDelDia: nuevo.puntos.split('\n').map((p) => p.trim()).filter(Boolean),
      })
      navegar(`/cms/cabildos/${c.id}`)
    } catch (err: unknown) {
      setErrorNuevo(err instanceof Error ? err.message : 'No se ha podido convocar.')
    } finally { setGuardando(false) }
  }

  const descargarLibro = async () => {
    setError(null)
    try { guardarEnDisco(await libroDeActas(Number(anioLibro)), `libro-de-actas-${anioLibro}.pdf`) }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido generar el libro de actas.') }
  }

  const valido = Boolean(nuevo.fecha) && nuevo.lugar.trim() !== ''

  return <>
    <Helmet><title>Cabildos | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Cabildos" subtitulo="Convocatoria, asistencia y quórum, votaciones y libro de actas.">
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setNuevo(VACIO); setErrorNuevo(null); setAbierta(true) }}>Convocar</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

    <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', maxWidth: 560 }}>
      <Typography sx={{ flex: '1 1 200px' }}>Libro de actas</Typography>
      <TextField size="small" label="Año" type="number" value={anioLibro} onChange={(e) => setAnioLibro(e.target.value)} sx={{ width: 110 }} />
      <Button variant="outlined" startIcon={<DownloadIcon />} disabled={!/^\d{4}$/.test(anioLibro)} onClick={() => void descargarLibro()}>PDF</Button>
    </Paper>

    {!lista && !error && <CircularProgress aria-label="Cargando los cabildos" />}
    {lista?.length === 0 && <Alert severity="info">Todavía no se ha convocado ninguno.</Alert>}
    {lista && lista.length > 0 && (
      <Paper component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
        {lista.map((c, i) => (
          <Box component="li" key={c.id} sx={{ borderTop: i === 0 ? 'none' : '1px solid', borderColor: 'divider' }}>
            <Box component={Link} to={`/cms/cabildos/${c.id}`} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', px: 2.5, py: 2, color: 'inherit', textDecoration: 'none', '&:hover': { bgcolor: 'action.hover' } }}>
              <Box sx={{ flex: '1 1 320px', minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>Cabildo {c.tipo === 'ORDINARIO' ? 'ordinario' : 'extraordinario'}</Typography>
                <Typography variant="body2" color="text.secondary">{fechaCabildo(c.fecha)} · {c.lugar}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 170 }}>
                {c.puntos} {c.puntos === 1 ? 'punto' : 'puntos'} · {c.asistentes} {c.asistentes === 1 ? 'asistente' : 'asistentes'}
              </Typography>
              <Chip size="small" label={ESTADO[c.estado].texto} color={ESTADO[c.estado].color} variant={c.estado === 'CELEBRADO' ? 'outlined' : 'filled'} />
            </Box>
          </Box>
        ))}
      </Paper>
    )}

    <VentanaFormulario
      abierto={abierta}
      titulo="Convocar un cabildo"
      textoGuardar="Convocar"
      sucio={JSON.stringify(nuevo) !== JSON.stringify(VACIO)}
      guardando={guardando}
      puedeGuardar={valido}
      error={errorNuevo}
      onGuardar={convocar}
      onCerrar={() => setAbierta(false)}
    >
      <TextField select label="Tipo" value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value as TipoCabildo })} fullWidth>
        <MenuItem value="ORDINARIO">Ordinario</MenuItem>
        <MenuItem value="EXTRAORDINARIO">Extraordinario</MenuItem>
      </TextField>
      <TextField label="Día y hora" type="datetime-local" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
      <TextField label="Lugar" value={nuevo.lugar} onChange={(e) => setNuevo({ ...nuevo, lugar: e.target.value })} slotProps={{ htmlInput: { maxLength: 191 } }} fullWidth />
      <TextField label="Orden del día" value={nuevo.puntos} onChange={(e) => setNuevo({ ...nuevo, puntos: e.target.value })} helperText="Un punto por línea." multiline minRows={4} fullWidth />
    </VentanaFormulario>
  </>
}
