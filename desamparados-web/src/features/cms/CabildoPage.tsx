import { useEffect, useState } from 'react'
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, IconButton, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import DownloadIcon from '@mui/icons-material/Download'
import { Helmet } from 'react-helmet-async'
import { Link, useBlocker, useNavigate, useParams } from 'react-router-dom'
import {
  aprobarActa, actaEnPdf, borrarCabildo, apuntarAsistente, apuntarVotacion, borrarVotacion, cabildo, darPorCelebrado, guardarActa, guardarCabildo,
  prepararConvocatoria, quitarAsistente, type Cabildo, type Mayoria, type TipoCabildo,
} from '../../lib/api/cabildos'
import { buscarHermanos, type AdminBrother } from '../../lib/api/hermanos'
import { guardarEnDisco } from '../../lib/api/datos'
import { limpiarHtml } from '../../lib/limpiarHtml'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import AvisoCambiosSinGuardar from './ficha/AvisoCambiosSinGuardar'
import { useAvisoAlCerrarLaPestana } from '../../hooks/useAvisoAlCerrarLaPestana'
import CabeceraSeccion from './CabeceraSeccion'
import VentanaFormulario from './VentanaFormulario'
import EditorTexto from './EditorTexto'
import { fechaCabildo } from './cabildos/formato'
import { site } from '../../config/site'
import { aCampoFechaMadrid, isoEnMadrid } from '../../lib/horaDeMadrid'

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)
const plural = (n: number, uno: string, varios: string) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`)
const nombreDe = (h: { nombre: string; apellidos: string; numeroHermano: number | null }) => `${h.apellidos}, ${h.nombre}${h.numeroHermano !== null ? ` · n.º ${h.numeroHermano}` : ''}`

const ESTADO: Record<Cabildo['estado'], string> = { CONVOCADO: 'Convocado', CELEBRADO: 'Acta en redacción', ACTA_APROBADA: 'Acta aprobada' }
const VOTACION_VACIA = { asunto: '', mayoria: 'SIMPLE' as Mayoria, aFavor: '', enContra: '', abstenciones: '' }

function Seccion({ titulo, children, detalle }: { titulo: string; detalle?: string; children: React.ReactNode }) {
  return (
    <Paper component="section" sx={{ p: { xs: 2, md: 3 }, mb: 3, maxWidth: 900, display: 'grid', gap: 2 }}>
      <Box>
        <Typography component="h2" sx={{ fontSize: 18, fontWeight: 600 }}>{titulo}</Typography>
        {detalle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{detalle}</Typography>}
      </Box>
      {children}
    </Paper>
  )
}

/**
 * Un cabildo de principio a fin: la convocatoria, la asistencia con el quórum
 * a la vista, las votaciones y el acta. Con el acta aprobada, todo queda de
 * solo lectura y pasa al libro de actas.
 */
export default function CabildoPage() {
  const id = Number(useParams().id)
  const navegar = useNavigate()
  const [c, setC] = useState<Cabildo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [editando, setEditando] = useState<{ tipo: TipoCabildo; fecha: string; lugar: string; puntos: string } | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [candidatos, setCandidatos] = useState<AdminBrother[]>([])
  const [votacion, setVotacion] = useState(VOTACION_VACIA)
  const [acta, setActa] = useState('')
  const [confirmar, setConfirmar] = useState<'aprobar' | 'segunda' | 'borrar' | null>(null)

  useEffect(() => {
    let cancelado = false
    cabildo(id)
      .then((x) => { if (!cancelado) { setC(x); setActa(x.acta) } })
      .catch((err: unknown) => { if (!cancelado) setError(mensaje(err, 'No se ha podido cargar el cabildo.')) })
    return () => { cancelado = true }
  }, [id])

  // El buscador de la asistencia: activos, cuando se deja de teclear.
  const texto = busqueda.trim()
  useEffect(() => {
    if (texto.length < 2) return
    let cancelado = false
    const reloj = setTimeout(() => {
      buscarHermanos({ q: texto, estado: 'activo' }, { pagina: 1, porPagina: 10 })
        .then((r) => { if (!cancelado) setCandidatos(r.data) })
        .catch(() => { if (!cancelado) setCandidatos([]) })
    }, 300)
    return () => { cancelado = true; clearTimeout(reloj) }
  }, [texto])

  // El acta se redacta durante días: «Volver» o cerrar la pestaña con texto
  // sin guardar lo tiraba sin preguntar.
  const actaSucia = c !== null && c.estado === 'CELEBRADO' && acta !== c.acta
  const bloqueo = useBlocker(({ currentLocation, nextLocation }) => actaSucia && !ocupado && currentLocation.pathname !== nextLocation.pathname)
  useAvisoAlCerrarLaPestana(actaSucia && !ocupado)

  if (!c) return error ? <Alert severity="error">{error}</Alert> : <CircularProgress aria-label="Cargando el cabildo" />

  const cerrado = c.estado === 'ACTA_APROBADA'
  // Lo mismo que exige el servidor: con asistencia apuntada ya es un cabildo que ocurrió.
  const borrable = c.estado === 'CONVOCADO' && c.asistentes.length === 0
  const hacer = async (accion: () => Promise<Cabildo | void>, textoOk?: string) => {
    setOcupado(true); setError(null); setAviso(null)
    try {
      const nuevo = await accion()
      if (nuevo) { setC(nuevo); if (nuevo.estado !== c.estado) setActa(nuevo.acta) }
      if (textoOk) setAviso(textoOk)
    } catch (err: unknown) { setError(mensaje(err, 'No se ha podido hacer.')) }
    finally { setOcupado(false) }
  }

  const q = c.quorum
  const votos = { aFavor: Number(votacion.aFavor || 0), enContra: Number(votacion.enContra || 0), abstenciones: Number(votacion.abstenciones || 0) }
  const votacionValida = votacion.asunto.trim() !== '' && votos.aFavor + votos.enContra + votos.abstenciones > 0

  const descargarActa = async () => {
    setError(null)
    try { guardarEnDisco(await actaEnPdf(id), `acta-cabildo-${id}.pdf`) }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido generar el acta.')) }
  }

  return <>
    <Helmet><title>{`Cabildo | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo={`Cabildo ${c.tipo === 'ORDINARIO' ? 'ordinario' : 'extraordinario'}`} subtitulo={`${fechaCabildo(c.fecha)} · ${c.lugar}`}>
      <Chip label={ESTADO[c.estado]} color={cerrado ? 'success' : 'default'} />
      {c.estado !== 'CONVOCADO' && <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => void descargarActa()}>Acta en PDF</Button>}
      <Button component={Link} to="/cms/cabildos">Volver</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 2, maxWidth: 900 }} onClose={() => setError(null)}>{error}</Alert>}
    {aviso && <Alert severity="success" sx={{ mb: 2, maxWidth: 900 }} onClose={() => setAviso(null)}>{aviso}</Alert>}

    <Seccion titulo="Orden del día y convocatoria">
      <Box component="ol" sx={{ m: 0, pl: 3 }}>
        {c.ordenDelDia.length === 0 ? <Typography color="text.secondary">Sin puntos.</Typography> : c.ordenDelDia.map((p, i) => <li key={i}>{p}</li>)}
      </Box>
      {!cerrado && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="outlined" onClick={() => setEditando({ tipo: c.tipo, fecha: aCampoFechaMadrid(c.fecha), lugar: c.lugar, puntos: c.ordenDelDia.join('\n') })}>Cambiar datos</Button>
          {c.convocatoriaId
            ? <Button component={Link} to={`/cms/comunicados/${c.convocatoriaId}`}>Abrir la convocatoria en Boletín y avisos</Button>
            : <Button disabled={ocupado} onClick={() => void hacer(async () => { const { comunicadoId } = await prepararConvocatoria(id); return { ...c, convocatoriaId: comunicadoId } }, 'Convocatoria preparada como borrador de aviso. Revísala y envíala desde Boletín y avisos.')}>Preparar la convocatoria por correo</Button>}
          {borrable && <Button color="error" startIcon={<DeleteOutlineIcon />} disabled={ocupado} onClick={() => setConfirmar('borrar')} sx={{ ml: { sm: 'auto' } }}>Borrar el cabildo</Button>}
        </Stack>
      )}
    </Seccion>

    <Seccion
      titulo="Asistencia y quórum"
      detalle={`Tienen voto los activos con ${c.reglas.edadMinima} años cumplidos y ${plural(c.reglas.antiguedadMinima, 'año', 'años')} de antigüedad el día del cabildo.`}
    >
      <Alert severity={q.enPrimera ? 'success' : 'info'}>
        {`${plural(q.presentesConVoto, 'presente', 'presentes')} con voto de un censo de ${q.censoConVoto}. `}
        {q.enPrimera ? 'Hay quórum en primera convocatoria.' : `Para la primera convocatoria hacen falta ${q.necesarios}; en segunda bastan los presentes.`}
        {c.estado !== 'CONVOCADO' && ` Se celebró en ${c.enSegunda ? 'segunda' : 'primera'} convocatoria.`}
      </Alert>
      {!cerrado && (
        <Autocomplete
          options={texto.length >= 2 ? candidatos.filter((h) => !c.asistentes.some((a) => a.hermanoId === h.id)) : []}
          getOptionLabel={nombreDe}
          filterOptions={(o) => o}
          inputValue={busqueda}
          onInputChange={(_, v) => setBusqueda(v)}
          value={null}
          onChange={(_, h) => { if (h) { setBusqueda(''); void hacer(() => apuntarAsistente(id, h.id)) } }}
          noOptionsText={texto.length < 2 ? 'Escribe dos letras del nombre o el número' : 'Nadie activo coincide'}
          renderInput={(params) => <TextField {...params} label="Apuntar a un hermano" size="small" />}
        />
      )}
      {c.asistentes.length > 0 && (
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 0.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' } }}>
          {c.asistentes.map((a) => (
            <Box component="li" key={a.hermanoId} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>{nombreDe(a)}</Typography>
              {!a.conVoto && <Chip size="small" label="Sin voto" variant="outlined" />}
              {!cerrado && <IconButton size="small" aria-label={`Quitar a ${a.nombre} ${a.apellidos}`} onClick={() => void hacer(() => quitarAsistente(id, a.hermanoId))}><DeleteOutlineIcon fontSize="small" /></IconButton>}
            </Box>
          ))}
        </Box>
      )}
      {c.estado === 'CONVOCADO' && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button variant="contained" disabled={ocupado || !q.enPrimera} onClick={() => void hacer(() => darPorCelebrado(id, false), 'Cabildo celebrado. Ya se puede redactar el acta.')}>Celebrado en primera convocatoria</Button>
          <Button variant="outlined" disabled={ocupado || c.asistentes.length === 0} onClick={() => setConfirmar('segunda')}>Celebrado en segunda convocatoria</Button>
        </Stack>
      )}
    </Seccion>

    <Seccion titulo="Votaciones">
      {c.votaciones.length === 0 && <Typography color="text.secondary">Ninguna todavía.</Typography>}
      {c.votaciones.map((v) => (
        <Box key={v.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography sx={{ flex: '1 1 260px', fontWeight: 600 }}>{v.asunto}</Typography>
          <Typography variant="body2" color="text.secondary">{v.aFavor} a favor · {v.enContra} en contra · {v.abstenciones} abst.{v.mayoria === 'DOS_TERCIOS' ? ' · 2/3' : ''}</Typography>
          <Chip size="small" label={v.resultado === 'APROBADO' ? 'Aprobado' : 'No aprobado'} color={v.resultado === 'APROBADO' ? 'success' : 'default'} />
          {!cerrado && <IconButton size="small" aria-label={`Borrar la votación ${v.asunto}`} onClick={() => void hacer(() => borrarVotacion(id, v.id))}><DeleteOutlineIcon fontSize="small" /></IconButton>}
        </Box>
      ))}
      {!cerrado && (
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '2fr 1fr' } }}>
          <TextField size="small" label="Qué se vota" value={votacion.asunto} onChange={(e) => setVotacion({ ...votacion, asunto: e.target.value })} slotProps={{ htmlInput: { maxLength: 300 } }} />
          <TextField size="small" select label="Mayoría" value={votacion.mayoria} onChange={(e) => setVotacion({ ...votacion, mayoria: e.target.value as Mayoria })}>
            <MenuItem value="SIMPLE">Simple</MenuItem>
            <MenuItem value="DOS_TERCIOS">Dos tercios</MenuItem>
          </TextField>
          <Stack direction="row" spacing={1.5} sx={{ gridColumn: { sm: '1 / -1' } }}>
            {(['aFavor', 'enContra', 'abstenciones'] as const).map((k) => (
              <TextField key={k} size="small" type="number" label={k === 'aFavor' ? 'A favor' : k === 'enContra' ? 'En contra' : 'Abstenciones'} value={votacion[k]} onChange={(e) => setVotacion({ ...votacion, [k]: e.target.value })} slotProps={{ htmlInput: { min: 0 } }} fullWidth />
            ))}
            <Button variant="outlined" disabled={ocupado || !votacionValida} onClick={() => void hacer(async () => { const r = await apuntarVotacion(id, { asunto: votacion.asunto.trim(), mayoria: votacion.mayoria, ...votos }); setVotacion(VOTACION_VACIA); return r })} sx={{ flexShrink: 0 }}>Apuntar</Button>
          </Stack>
        </Box>
      )}
    </Seccion>

    {c.estado !== 'CONVOCADO' && (
      <Seccion titulo="Acta" detalle={cerrado && c.actaAprobadaEl ? `Aprobada el ${new Date(c.actaAprobadaEl).toLocaleDateString('es-ES')}. Está en el libro de actas.` : 'Lo que el PDF no pone solo: el desarrollo de la sesión y los acuerdos. La asistencia, el quórum, el orden del día y las votaciones ya van en el acta.'}>
        {cerrado
          ? <Box sx={{ '& p': { mt: 0 } }} dangerouslySetInnerHTML={{ __html: limpiarHtml(c.acta) }} />
          : <>
            <EditorTexto valor={acta} onCambio={setActa} etiqueta="Texto del acta" />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button variant="outlined" disabled={ocupado || acta === c.acta} onClick={() => void hacer(() => guardarActa(id, acta), 'Acta guardada.')}>Guardar el acta</Button>
              <Button variant="contained" disabled={ocupado || acta !== c.acta || !c.acta.replace(/<[^>]*>/g, '').trim()} onClick={() => setConfirmar('aprobar')}>Aprobar el acta</Button>
            </Stack>
          </>}
      </Seccion>
    )}

    <VentanaFormulario
      abierto={editando !== null}
      titulo="Datos del cabildo"
      sucio
      guardando={ocupado}
      puedeGuardar={Boolean(editando?.fecha && editando.lugar.trim())}
      error={null}
      onGuardar={async () => {
        if (!editando) return
        await hacer(() => guardarCabildo(id, { tipo: editando.tipo, fecha: isoEnMadrid(editando.fecha), lugar: editando.lugar.trim(), ordenDelDia: editando.puntos.split('\n').map((p) => p.trim()).filter(Boolean) }), 'Datos guardados.')
        setEditando(null)
      }}
      onCerrar={() => setEditando(null)}
    >
      {editando && <>
        <TextField select label="Tipo" value={editando.tipo} onChange={(e) => setEditando({ ...editando, tipo: e.target.value as TipoCabildo })} fullWidth>
          <MenuItem value="ORDINARIO">Ordinario</MenuItem>
          <MenuItem value="EXTRAORDINARIO">Extraordinario</MenuItem>
        </TextField>
        <TextField label="Día y hora" type="datetime-local" value={editando.fecha} onChange={(e) => setEditando({ ...editando, fecha: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} fullWidth />
        <TextField label="Lugar" value={editando.lugar} onChange={(e) => setEditando({ ...editando, lugar: e.target.value })} fullWidth />
        <TextField label="Orden del día" value={editando.puntos} onChange={(e) => setEditando({ ...editando, puntos: e.target.value })} helperText="Un punto por línea." multiline minRows={4} fullWidth />
      </>}
    </VentanaFormulario>

    <AvisoCambiosSinGuardar bloqueo={bloqueo} deQue="el acta" />
    <DialogoConfirmacion
      abierto={confirmar === 'segunda'}
      titulo="¿Celebrado en segunda convocatoria?"
      mensaje={`En segunda convocatoria basta con los presentes (${plural(c.asistentes.length, 'hermano', 'hermanos')}). Se guarda el censo con voto de hoy para el acta.`}
      textoConfirmar="Sí, en segunda"
      onConfirmar={() => { setConfirmar(null); void hacer(() => darPorCelebrado(id, true), 'Cabildo celebrado en segunda convocatoria. Ya se puede redactar el acta.') }}
      onCancelar={() => setConfirmar(null)}
    />
    <DialogoConfirmacion
      abierto={confirmar === 'borrar'}
      titulo="¿Borrar el cabildo?"
      mensaje={`Se borra el cabildo del ${fechaCabildo(c.fecha)} con su orden del día.${c.convocatoriaId
        ? ' La convocatoria se queda en Boletín y avisos: si ya se envió, avisa a los hermanos de que se anula.'
        : ''}`}
      textoConfirmar="Borrar el cabildo"
      peligro
      onConfirmar={() => {
        setConfirmar(null)
        void hacer(async () => { await borrarCabildo(id); void navegar('/cms/cabildos', { replace: true }) })
      }}
      onCancelar={() => setConfirmar(null)}
    />
    <DialogoConfirmacion
      abierto={confirmar === 'aprobar'}
      titulo="¿Aprobar el acta?"
      mensaje="El acta pasa al libro de actas y el cabildo ya no se puede cambiar: ni la asistencia, ni las votaciones, ni el texto."
      textoConfirmar="Aprobar"
      onConfirmar={() => { setConfirmar(null); void hacer(() => aprobarActa(id), 'Acta aprobada. Ya está en el libro de actas.') }}
      onCancelar={() => setConfirmar(null)}
    />
  </>
}
