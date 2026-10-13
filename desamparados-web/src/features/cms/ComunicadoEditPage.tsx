import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, LinearProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  borrarComunicado, comunicado, comunicados, destinatariosDe, enviarComunicado, enviarPrueba, guardarComunicado, reintentarFallidos,
  type ComunicadoCompleto, type DatosComunicado, type Segmento, type TipoComunicado,
} from '../../lib/api/comunicados'
import { limpiarHtml } from '../../lib/limpiarHtml'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import PantallaEdicion from './PantallaEdicion'
import CabeceraSeccion from './CabeceraSeccion'
import EditorTexto from './EditorTexto'
import { plantillasLibres } from '../../lib/api/emails'
import { site } from '../../config/site'
import { useSalidas } from '../procesion/useSalidas'
import { aArticulo, deArticulo } from '../../domain/articulos'
import { useModulos } from '../../hooks/useModulos'

const LISTADO = '/cms/comunicados'
const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)
const plural = (n: number, uno: string, varios: string) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`)

const aDatos = (c: ComunicadoCompleto): DatosComunicado => ({
  tipo: c.tipo, asunto: c.asunto, cuerpo: c.cuerpo,
  segmento: { conPapeleta: c.segmento.conPapeleta ?? null, apuntadosA: c.segmento.apuntadosA ?? null, conDeuda: c.segmento.conDeuda ?? false, edad: c.segmento.edad ?? null, poblacion: c.segmento.poblacion ?? '' },
})

/**
 * Un boletín o un aviso. Mientras es borrador se escribe, se elige a quién va
 * (con el recuento de direcciones a la vista), se prueba y se envía. Enviado,
 * se enseña tal cual salió y cómo va el envío.
 */
export default function ComunicadoEditPage() {
  const id = Number(useParams().id)
  const navegar = useNavigate()
  const { activo } = useModulos()
  const [original, setOriginal] = useState<ComunicadoCompleto | null>(null)
  const [form, setForm] = useState<DatosComunicado | null>(null)
  // Las salidas solo hacen falta para el filtro «con papeleta de», que es de Procesión.
  const { data: salidas = [] } = useSalidas({ enabled: activo('procesion') })
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [cuenta, setCuenta] = useState<{ correos: number; sinCorreo: number; para: string } | null>(null)
  const [confirmar, setConfirmar] = useState<'enviar' | 'borrar' | null>(null)
  const [progreso, setProgreso] = useState<{ enviados: number; fallidos: number; pendientes: number } | null>(null)
  // Las plantillas libres de Emails; si no llegan (sin permiso, o sin red), no hay desplegable.
  const [libres, setLibres] = useState<Awaited<ReturnType<typeof plantillasLibres>> | null>(null)
  useEffect(() => {
    let cancelado = false
    plantillasLibres().then((l) => { if (!cancelado) setLibres(l) }).catch(() => undefined)
    return () => { cancelado = true }
  }, [])

  const cargar = useCallback(async () => {
    const c = await comunicado(id)
    setOriginal(c)
    setForm(aDatos(c))
    if (c.estado !== 'BORRADOR') setProgreso((await comunicados()).find((x) => x.id === id)?.envios ?? null)
  }, [id])

  useEffect(() => {
    let cancelado = false
    comunicado(id)
      .then(async (c) => {
        if (cancelado) return
        setOriginal(c); setForm(aDatos(c))
        if (c.estado !== 'BORRADOR') {
          const envios = (await comunicados()).find((x) => x.id === id)?.envios ?? null
          if (!cancelado) setProgreso(envios)
        }
      })
      .catch((err: unknown) => { if (!cancelado) setError(mensaje(err, 'No se ha podido cargar el comunicado.')) })
    return () => { cancelado = true }
  }, [id])

  // Mientras se envía, cómo va: cada pocos segundos, hasta que termina.
  const enviandose = original?.estado === 'ENVIANDO'
  useEffect(() => {
    if (!enviandose) return
    const reloj = setInterval(() => { void cargar().catch(() => undefined) }, 3000)
    return () => clearInterval(reloj)
  }, [enviandose, cargar])

  // A cuántas direcciones llegaría, cuando se deja de tocar el segmento.
  const tipo = form?.tipo
  const segmentoTexto = JSON.stringify(form?.segmento ?? null)
  useEffect(() => {
    if (!tipo || original?.estado !== 'BORRADOR') return
    let cancelado = false
    const reloj = setTimeout(() => {
      destinatariosDe(tipo, JSON.parse(segmentoTexto) as Segmento)
        .then((c) => { if (!cancelado) setCuenta(c) })
        .catch(() => { if (!cancelado) setCuenta(null) })
    }, 350)
    return () => { cancelado = true; clearTimeout(reloj) }
  }, [tipo, segmentoTexto, original?.estado])

  if (!original || !form) {
    return error ? <Alert severity="error">{error}</Alert> : <CircularProgress aria-label="Cargando el comunicado" />
  }

  const sucio = JSON.stringify(form) !== JSON.stringify(aDatos(original))
  const campo = <K extends keyof DatosComunicado>(k: K, v: DatosComunicado[K]) => setForm({ ...form, [k]: v })
  const segmento = (cambios: Partial<Segmento>) => setForm({ ...form, segmento: { ...form.segmento, ...cambios } })
  const cuerpoVacio = form.cuerpo.replace(/<[^>]*>/g, '').trim() === '' && !/<img/i.test(form.cuerpo)

  const guardar = async () => {
    setGuardando(true); setError(null)
    try { const c = await guardarComunicado(id, form); setOriginal(c); setForm(aDatos(c)); setAviso('Borrador guardado.') }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido guardar.')) }
    finally { setGuardando(false) }
  }

  const probar = async () => {
    setGuardando(true); setError(null); setAviso(null)
    try {
      if (sucio) { const c = await guardarComunicado(id, form); setOriginal(c); setForm(aDatos(c)) }
      setAviso((await enviarPrueba(id)).message)
    } catch (err: unknown) { setError(mensaje(err, 'No se ha podido enviar la prueba.')) }
    finally { setGuardando(false) }
  }

  const enviar = async () => {
    setConfirmar(null); setGuardando(true); setError(null); setAviso(null)
    try {
      if (sucio) await guardarComunicado(id, form)
      setAviso((await enviarComunicado(id)).message)
      await cargar()
    } catch (err: unknown) { setError(mensaje(err, 'No se ha podido enviar.')) }
    finally { setGuardando(false) }
  }

  const borrar = async () => {
    setConfirmar(null)
    try { await borrarComunicado(id); navegar(LISTADO) }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido borrar.')) }
  }

  const reintentar = async () => {
    setError(null)
    try { setAviso((await reintentarFallidos(id)).message); await cargar() }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido reintentar.')) }
  }

  const titulo = `${original.tipo === 'BOLETIN' ? 'Boletín' : 'Aviso'}: ${original.asunto}`

  if (original.estado !== 'BORRADOR') {
    const total = progreso ? progreso.enviados + progreso.fallidos + progreso.pendientes : 0
    return <>
      <Helmet><title>{`${original.asunto} | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <CabeceraSeccion titulo={titulo} subtitulo={original.para}>
        <Button component={Link} to={LISTADO}>Volver al listado</Button>
      </CabeceraSeccion>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {aviso && <Alert severity="success" sx={{ mb: 2 }}>{aviso}</Alert>}
      {progreso && (
        <Paper sx={{ p: 2.5, mb: 3, maxWidth: 760 }}>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>
            {original.estado === 'ENVIANDO' ? `Enviando: ${progreso.enviados + progreso.fallidos} de ${total}` : `Enviado a ${plural(progreso.enviados, 'dirección', 'direcciones')}`}
          </Typography>
          <LinearProgress variant="determinate" value={total ? ((progreso.enviados + progreso.fallidos) / total) * 100 : 100} aria-label="Progreso del envío" sx={{ mb: 1.5 }} />
          {original.estado === 'ENVIANDO' && <Typography variant="body2" color="text.secondary">Sale poco a poco para no pasar del cupo de la cuenta de correo. Se puede cerrar esta pantalla: sigue enviándose.</Typography>}
          {progreso.fallidos > 0 && (
            <Alert severity="warning" sx={{ mt: 1.5 }} action={original.estado === 'ENVIADO' ? <Button color="inherit" size="small" onClick={() => void reintentar()}>Reintentar</Button> : undefined}>
              {plural(progreso.fallidos, 'correo no ha salido', 'correos no han salido')}. Suele ser el cupo diario de la cuenta: reinténtalo mañana.
            </Alert>
          )}
        </Paper>
      )}
      <Paper sx={{ p: { xs: 2.5, md: 4 }, maxWidth: 760, '& img': { maxWidth: '100%', height: 'auto' } }}>
        <Box dangerouslySetInnerHTML={{ __html: limpiarHtml(original.cuerpo) }} />
      </Paper>
    </>
  }

  return <>
    <Helmet><title>{`${original.asunto} | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {aviso && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAviso(null)}>{aviso}</Alert>}
    <PantallaEdicion titulo="Escribir el comunicado" nombre={original.asunto} sucio={sucio} guardando={guardando} volverA={LISTADO} onGuardar={guardar}>
      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField select label="Qué es" value={form.tipo} onChange={(e) => campo('tipo', e.target.value as TipoComunicado)} sx={{ minWidth: 180 }}>
            <MenuItem value="BOLETIN">Boletín</MenuItem>
            <MenuItem value="AVISO">Aviso</MenuItem>
          </TextField>
          <TextField label="Asunto" value={form.asunto} onChange={(e) => campo('asunto', e.target.value)} slotProps={{ htmlInput: { maxLength: 150 } }} fullWidth />
        </Stack>
        {libres && libres.length > 0 && (
          <TextField select size="small" label="Partir de una plantilla" value="" sx={{ maxWidth: 420 }}
            helperText="Pone el asunto y el texto de la plantilla en lugar de lo escrito. Se crean en Emails."
            onChange={(e) => {
              const p = libres.find((x) => x.id === Number(e.target.value))
              if (p) setForm({ ...form, asunto: p.asunto || form.asunto, cuerpo: p.cuerpo })
            }}>
            {libres.map((p) => <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>)}
          </TextField>
        )}
        <EditorTexto
          valor={form.cuerpo}
          onCambio={(html) => campo('cuerpo', html)}
          etiqueta="Texto"
          ayuda="Empieza tras el saludo («Estimado Pablo:»), que se pone solo con el nombre de cada uno. La firma también va sola."
        />

        <Paper variant="outlined" sx={{ p: 2.5, display: 'grid', gap: 2 }}>
          <Typography sx={{ fontWeight: 600 }}>A quién va</Typography>
          <Typography variant="body2" color="text.secondary">
            {form.tipo === 'BOLETIN' ? 'A los hermanos activos suscritos al boletín' : 'A los hermanos activos'}{', y de ellos, solo a quienes cumplan lo que marques aquí.'}
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' } }}>
            {activo('procesion') && (
              // Un solo desplegable para los dos filtros de una salida: «apuntados»
              // ya incluye a quien tiene la papeleta, y juntos no dirían nada más.
              <TextField
                select size="small" label="Papeleta"
                slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                value={form.segmento.apuntadosA ? `apuntados-${form.segmento.apuntadosA}` : form.segmento.conPapeleta ? `papeleta-${form.segmento.conPapeleta}` : ''}
                onChange={(e) => {
                  const [filtro, salida] = e.target.value.split('-')
                  segmento({ conPapeleta: filtro === 'papeleta' ? Number(salida) : null, apuntadosA: filtro === 'apuntados' ? Number(salida) : null })
                }}
                helperText={form.segmento.apuntadosA ? 'Con su papeleta de este año, o pedida y aún sin recoger.' : undefined}
              >
                <MenuItem value="">Da igual</MenuItem>
                {salidas.flatMap((s) => [
                  <MenuItem key={`papeleta-${s.id}`} value={`papeleta-${s.id}`}>{`Con papeleta ${deArticulo(s.articulo, s.nombre)}`}</MenuItem>,
                  <MenuItem key={`apuntados-${s.id}`} value={`apuntados-${s.id}`}>{`Apuntados ${aArticulo(s.articulo, s.nombre)}`}</MenuItem>,
                ])}
              </TextField>
            )}
            <TextField select size="small" label="Edad" slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} value={form.segmento.edad ?? ''} onChange={(e) => segmento({ edad: (e.target.value || null) as Segmento['edad'] })}>
              <MenuItem value="">Da igual</MenuItem>
              <MenuItem value="MAYORES">Mayores de edad</MenuItem>
              <MenuItem value="MENORES">Menores (les llega a su tutor)</MenuItem>
            </TextField>
            <TextField size="small" label="Población" value={form.segmento.poblacion ?? ''} onChange={(e) => segmento({ poblacion: e.target.value })} placeholder="Todas" slotProps={{ htmlInput: { maxLength: 100 }, inputLabel: { shrink: true } }} />
          </Box>
          <FormControlLabel control={<Checkbox checked={form.segmento.conDeuda ?? false} onChange={(e) => segmento({ conDeuda: e.target.checked })} />} label="Solo quien tiene cuotas pendientes" />
          {cuenta && (
            <Alert severity={cuenta.correos > 0 ? 'info' : 'warning'}>
              {cuenta.correos > 0 ? `Llegará a ${plural(cuenta.correos, 'dirección', 'direcciones')}` : 'No llegaría a nadie'}
              {cuenta.sinCorreo > 0 ? ` (${plural(cuenta.sinCorreo, 'ficha no tiene', 'fichas no tienen')} correo).` : '.'}
              {' '}Una familia con varias fichas recibe un solo correo.
            </Alert>
          )}
        </Paper>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between' }}>
          <Button color="error" onClick={() => setConfirmar('borrar')}>Borrar el borrador</Button>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button variant="outlined" disabled={guardando || cuerpoVacio || !form.asunto.trim()} onClick={() => void probar()}>Enviarme una prueba</Button>
            <Button variant="contained" startIcon={<SendIcon />} disabled={guardando || cuerpoVacio || !form.asunto.trim() || !cuenta?.correos} onClick={() => setConfirmar('enviar')}>
              Enviar
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </PantallaEdicion>

    <DialogoConfirmacion
      abierto={confirmar === 'enviar'}
      titulo="¿Enviar el comunicado?"
      mensaje={`Se mandará a ${plural(cuenta?.correos ?? 0, 'dirección', 'direcciones')}. Una vez enviado ya no se puede cambiar ni retirar.`}
      textoConfirmar="Enviar"
      onConfirmar={() => void enviar()}
      onCancelar={() => setConfirmar(null)}
    />
    <DialogoConfirmacion
      abierto={confirmar === 'borrar'}
      titulo="¿Borrar el borrador?"
      mensaje="Se pierde lo escrito. No se puede deshacer."
      textoConfirmar="Borrar"
      peligro
      onConfirmar={() => void borrar()}
      onCancelar={() => setConfirmar(null)}
    />
  </>
}
