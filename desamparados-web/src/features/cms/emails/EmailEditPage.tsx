import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import PantallaEdicion from '../PantallaEdicion'
import {
  catalogoDeEmails, crearPlantilla, guardarPlantilla, pruebaDePlantilla, traerPlantilla, usarPlantilla, vistaPreviaDePlantilla,
  type DatosPlantilla, type TextoDePlantilla, type UsoDeCorreo,
} from '../../../lib/api/emails'
import { site } from '../../../config/site'

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)
type Campo = 'asunto' | 'titulo' | 'cuerpo' | 'despedida'

/**
 * Crear o editar una plantilla de un correo. Una nueva parte del texto
 * original de ese correo. Los campos ({{nombre}}) se meten donde esté el
 * cursor; los bloques fijos ([[papeleta]]), en su propia línea del texto.
 * A la derecha, cómo queda con datos de ejemplo.
 */
export default function EmailEditPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nueva = id === undefined || id === 'nueva'
  const navegar = useNavigate()
  const cliente = useQueryClient()
  const { data: catalogo } = useQuery({ queryKey: ['emails'], queryFn: catalogoDeEmails })
  const { data: guardada, error: errorCarga } = useQuery({ queryKey: ['emails', 'plantilla', id], queryFn: () => traerPlantilla(Number(id)), enabled: !nueva })

  const [form, setForm] = useState<DatosPlantilla | null>(null)
  const [inicial, setInicial] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [previa, setPrevia] = useState<{ asunto: string; html: string; problemas: string[] } | null>(null)
  const ultimoCampo = useRef<{ campo: Campo; el: HTMLInputElement | HTMLTextAreaElement } | null>(null)

  const usoClave = nueva ? params.get('uso') ?? '' : guardada?.uso ?? ''
  const uso: UsoDeCorreo | undefined = catalogo?.usos.find((u) => u.clave === usoClave)

  // El formulario nace una vez, de lo guardado o del texto original del correo.
  if (!form && uso && (nueva || guardada)) {
    const datos: DatosPlantilla = nueva
      ? { nombre: '', uso: uso.clave, ...uso.original }
      : { nombre: guardada!.nombre, uso: guardada!.uso, asunto: guardada!.asunto, titulo: guardada!.titulo, cuerpo: guardada!.cuerpo, despedida: guardada!.despedida }
    setForm(datos)
    setInicial(JSON.stringify(datos))
  }

  const texto: TextoDePlantilla | null = useMemo(() => (form ? { asunto: form.asunto, titulo: form.titulo, cuerpo: form.cuerpo, despedida: form.despedida } : null), [form])

  // La vista previa, medio segundo después de dejar de escribir.
  useEffect(() => {
    if (!texto || !usoClave) return
    let cancelado = false
    const reloj = window.setTimeout(() => {
      vistaPreviaDePlantilla(usoClave, texto)
        .then((p) => { if (!cancelado) setPrevia(p) })
        .catch(() => { /* la vista previa es una ayuda: si falla, se queda la anterior */ })
    }, 500)
    return () => { cancelado = true; window.clearTimeout(reloj) }
  }, [texto, usoClave])

  if (errorCarga) return <Alert severity="error">{mensaje(errorCarga, 'No se ha podido cargar la plantilla.')}</Alert>
  if (catalogo && !uso) return <Alert severity="error">Ese correo no existe.</Alert>
  if (!form || !uso) return <CircularProgress aria-label="Cargando la plantilla" />

  const cambiar = (c: Partial<DatosPlantilla>) => setForm({ ...form, ...c })
  const recordar = (campo: Campo) => (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { ultimoCampo.current = { campo, el: e.target } }

  /** Mete el texto donde estaba el cursor (o al final del texto). */
  const insertar = (trozo: string, soloEnElCuerpo = false) => {
    const ultimo = ultimoCampo.current
    const campo: Campo = soloEnElCuerpo || !ultimo ? 'cuerpo' : ultimo.campo
    const actual = form[campo]
    const el = ultimo?.campo === campo ? ultimo.el : null
    const desde = el?.selectionStart ?? actual.length
    const hasta = el?.selectionEnd ?? actual.length
    let nuevoTexto: string
    if (soloEnElCuerpo) {
      // Un bloque va solo en su línea, con una en blanco antes y después.
      const antes = actual.slice(0, desde).replace(/\s*$/, '')
      const despues = actual.slice(hasta).replace(/^\s*/, '')
      nuevoTexto = [antes, trozo, despues].filter(Boolean).join('\n\n')
    } else {
      nuevoTexto = actual.slice(0, desde) + trozo + actual.slice(hasta)
    }
    cambiar({ [campo]: nuevoTexto } as Partial<DatosPlantilla>)
  }

  const guardar = async (yUsar = false) => {
    setGuardando(true); setError(null)
    try {
      const p = nueva ? await crearPlantilla(form) : await guardarPlantilla(Number(id), form)
      if (yUsar) await usarPlantilla(uso.clave, p.id)
      await cliente.invalidateQueries({ queryKey: ['emails'] })
      navegar('/cms/emails')
    } catch (err: unknown) {
      setError(mensaje(err, 'No se ha podido guardar la plantilla.'))
      setGuardando(false)
    }
  }

  const probar = async () => {
    setError(null); setAviso(null)
    try { setAviso((await pruebaDePlantilla(uso.clave, texto!)).message) }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido mandar la prueba.')) }
  }

  const campos = [...(catalogo?.comunes ?? []), ...uso.campos]
  const problemas = previa?.problemas ?? []
  const puedeGuardar = form.nombre.trim() !== '' && problemas.length === 0

  return <>
    <Helmet><title>{`${nueva ? 'Nueva plantilla' : 'Editar plantilla'} | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
    {aviso && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAviso(null)}>{aviso}</Alert>}
    <PantallaEdicion
      titulo={nueva ? 'Nueva plantilla' : 'Editar plantilla'}
      nombre={uso.nombre}
      sucio={JSON.stringify(form) !== inicial}
      guardando={guardando}
      volverA="/cms/emails"
      onGuardar={() => (puedeGuardar ? guardar() : setError(form.nombre.trim() ? problemas.join(' ') : 'Ponle un nombre a la plantilla.'))}
      anchoCompleto
      extra={!uso.libre && !guardada?.enUso ? <Button onClick={() => void guardar(true)} disabled={guardando || !puedeGuardar}>Guardar y usar</Button> : undefined}
    >
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) minmax(0, 1fr)' }, alignItems: 'start' }}>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">{uso.descripcion}</Typography>
          <TextField label="Nombre de la plantilla" value={form.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} required
            helperText="Solo lo ves tú, para reconocerla: «Bienvenida 2027», «Pésame breve»…" slotProps={{ htmlInput: { maxLength: 120 } }} fullWidth />
          <TextField label="Asunto" value={form.asunto} onChange={(e) => cambiar({ asunto: e.target.value })} onFocus={recordar('asunto')} slotProps={{ htmlInput: { maxLength: 200 } }} fullWidth />
          {!uso.libre && (
            <TextField label="Título" value={form.titulo} onChange={(e) => cambiar({ titulo: e.target.value })} onFocus={recordar('titulo')}
              helperText="El que va grande arriba, bajo el escudo" slotProps={{ htmlInput: { maxLength: 200 } }} fullWidth />
          )}
          <TextField label="Texto" value={form.cuerpo} onChange={(e) => cambiar({ cuerpo: e.target.value })} onFocus={recordar('cuerpo')} multiline minRows={12}
            slotProps={{ htmlInput: { maxLength: 20000, spellCheck: true }, input: { sx: { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 14, lineHeight: 1.55 } } }} fullWidth />
          {!uso.libre && (
            <TextField label="Despedida (opcional)" value={form.despedida} onChange={(e) => cambiar({ despedida: e.target.value })} onFocus={recordar('despedida')}
              helperText="En cursiva, encima de la firma: «Que Nuestra Señora le guarde y bendiga.»" slotProps={{ htmlInput: { maxLength: 300 } }} fullWidth />
          )}

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 600, mb: 1 }}>Campos</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Se rellenan con los datos de cada correo. Pulsa uno para meterlo donde tengas el cursor.</Typography>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
              {campos.map((c) => (
                <Tooltip describeChild key={c.clave} title={`${c.ayuda}${c.ejemplo ? ` · p. ej. «${c.ejemplo}»` : ''}`}>
                  <Chip label={`{{${c.clave}}}`} onClick={() => insertar(`{{${c.clave}}}`)} variant="outlined" />
                </Tooltip>
              ))}
            </Stack>
            {uso.bloques.length > 0 && <>
              <Typography sx={{ fontWeight: 600, mt: 2, mb: 1 }}>Bloques fijos</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Los pone el sistema tal cual: van solos en su línea. Los marcados con * no pueden faltar.</Typography>
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                {uso.bloques.map((b) => (
                  <Tooltip describeChild key={b.clave} title={b.ayuda}>
                    <Chip label={`[[${b.clave}]]${b.obligatorio ? ' *' : ''}`} onClick={() => insertar(`[[${b.clave}]]`, true)} color={b.obligatorio ? 'primary' : 'default'} variant="outlined" />
                  </Tooltip>
                ))}
              </Stack>
            </>}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Formato: deja una línea en blanco entre párrafos · <code>**negrita**</code> · líneas que empiezan por <code>- </code> son una lista · líneas que empiezan por <code>&gt; </code> son un recuadro (si la primera va entera en negrita, es su título).
            </Typography>
          </Paper>
        </Stack>

        <Stack spacing={1.5} sx={{ position: { lg: 'sticky' }, top: { lg: 16 } }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 600 }}>Vista previa</Typography>
            <Button size="small" onClick={() => void probar()} disabled={problemas.length > 0}>Mandarme una prueba</Button>
          </Stack>
          {problemas.length > 0 && <Alert severity="warning">{problemas.map((p) => <div key={p}>{p}</div>)}</Alert>}
          {previa && <Typography variant="body2"><strong>Asunto:</strong> {previa.asunto}</Typography>}
          <Box component="iframe" title="Vista previa del correo" sandbox="" srcDoc={previa?.html ?? ''}
            sx={{ width: '100%', height: { xs: 520, lg: 'calc(100vh - 220px)' }, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: '#fff' }} />
          <Typography variant="caption" color="text.secondary">Con datos de ejemplo. Los bloques fijos salen como un recuadro que dice qué irá en su sitio.</Typography>
        </Stack>
      </Box>
    </PantallaEdicion>
  </>
}
