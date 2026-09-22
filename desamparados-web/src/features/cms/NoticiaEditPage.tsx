import { useState, type ReactNode } from 'react'
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Helmet } from 'react-helmet-async'
import { Link, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import TarjetaNoticia from '../../components/TarjetaNoticia'
import { hoy } from '../../lib/fechas'
import { direccionAutomatica } from '../../lib/slug'
import { ANCHO_EDICION } from './PantallaEdicion'
import AvisoCambiosSinGuardar from './ficha/AvisoCambiosSinGuardar'
import { useFichaCms } from './ficha/useFichaCms'
import CampoImagen from './CampoImagen'
import EditorTexto from './EditorTexto'
import { EtiquetaEstado, Progreso } from './redaccion/FilaRedaccion'
import { haceCuanto, piezasDeNoticia, tieneTexto } from './redaccion/completitud'
import { useTemaCms } from '../../app/useTemaCms'
import { CLAVE_PANEL_HOY } from '../../app/usePanelDeHoy'
import { crearNoticia, noticiaDelCms, actualizarNoticia, type NoticiaDeLaApi, type DatosDeNoticia } from '../../lib/api/noticias'

/** Lo que cabe en las tres líneas de la tarjeta de la portada; pasarse no impide guardar. */
const EXTRACTO_RECOMENDADO = 180

type Accion = 'borrador' | 'publicar' | 'guardar' | 'despublicar'



/**
 * La ficha de una noticia, nueva o ya escrita.
 *
 * A la izquierda se escribe (título, extracto y texto); a la derecha se decide
 * (estado, fecha, foto y dirección) y se ve la tarjeta tal como saldrá en la
 * portada. Antes crear era una ventana y editar otra pantalla con los campos en
 * fila; ahora las dos cosas son esta ficha.
 *
 * Publicar o no ya no es un interruptor al final del formulario: son los
 * botones de arriba. Un borrador se guarda como borrador o se publica; una
 * publicada guarda sus cambios o vuelve a borrador. Lo que se ve en la web al
 * momento (publicar, cambiar una publicada, retirarla) pide confirmación.
 */
export default function NoticiaEditPage() {
  const { id } = useParams()
  const nueva = id === undefined
  const queryClient = useQueryClient()
  const [confirmando, setConfirmando] = useState<Accion | null>(null)
  const { cargado: guardada, form, inicial, sucio, guardando, error, bloqueo, volverAlListado, campo, guardar: guardarFicha } =
    useFichaCms<NoticiaDeLaApi, DatosDeNoticia>({
      listado: '/cms/noticias',
      origen: nueva ? null : Number(id),
      cargar: noticiaDelCms,
      aFormulario: (item) => ({
        titulo: item.titulo, contenido: item.contenido, extracto: item.extracto ?? '',
        imagenUrl: item.imagenUrl ?? '', visible: item.visible, fecha: item.fecha.slice(0, 10), slug: item.slug,
      }),
      vacio: vacia(),
      errorAlCargar: 'No se ha podido cargar la noticia.',
    })

  if (error && !form) return <Alert severity="error">{error}</Alert>
  if (!form || !inicial) return <CircularProgress aria-label="Cargando la noticia" />

  const publicada = !nueva && inicial.visible
  const conTitulo = form.titulo.trim() !== ''
  const conTexto = tieneTexto(form.contenido)

  const guardar = async (accion: Accion) => {
    setConfirmando(null)
    const datos: DatosDeNoticia = {
      ...form,
      visible: accion === 'publicar' || accion === 'guardar',
      // El esquema pide contenido no vacío; un borrador puede no tener texto aún.
      contenido: form.contenido || '<p></p>',
      // En una nueva, la fecha solo se manda si se ha tocado: si no, el servidor
      // pone el momento de guardar, con su hora, y el orden del día se respeta.
      fecha: nueva && form.fecha === inicial.fecha ? undefined : form.fecha,
      slug: form.slug?.trim() || undefined,
    }
    await guardarFicha(
      async () => {
        if (nueva) await crearNoticia(datos)
        else await actualizarNoticia(Number(id), datos)
        // El contador de borradores del menú sale del panel del Inicio.
        void queryClient.invalidateQueries({ queryKey: CLAVE_PANEL_HOY })
      },
      {
        siFalla: 'No se ha podido guardar la noticia.',
        aviso: {
          borrador: 'Borrador guardado. No se ve en la web hasta que se publique.',
          publicar: 'Noticia publicada: ya se ve en la web.',
          guardar: 'Cambios guardados: ya se ven en la web.',
          despublicar: 'Noticia pasada a borrador: ya no se ve en la web.',
        }[accion],
      },
    )
  }

  // Guardar un borrador no se ve fuera: va directo. Lo demás cambia la web y se confirma.
  const pedir = (accion: Accion) => (accion === 'borrador' ? void guardar(accion) : setConfirmando(accion))

  const titulo = nueva ? 'Nueva noticia' : (guardada?.titulo ?? form.titulo)
  const estadoTexto = nueva
    ? 'Sin guardar todavía'
    : `${inicial.visible ? 'Publicada' : 'Borrador'}${guardada?.updatedAt ? ` · guardada ${haceCuanto(guardada.updatedAt)}` : ''}`

  return (
    <>
      <Helmet><title>{`${nueva ? 'Nueva noticia' : 'Editar noticia'} | CMS Desamparados`}</title><meta name="robots" content="noindex" /></Helmet>
      <Box sx={{ maxWidth: ANCHO_EDICION, mx: 'auto' }}>
        <Button component={Link} to={volverAlListado} startIcon={<ArrowBackIcon />} size="small" color="inherit" sx={{ mb: 1.5, color: 'text.secondary' }}>Noticias</Button>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-end', mb: 3 }}>
          <Box sx={{ minWidth: 0, flex: '1 1 320px' }}>
            <Typography variant="h2" component="h1" sx={{ fontSize: { xs: 26, md: 32 }, textWrap: 'balance', overflowWrap: 'anywhere' }}>{titulo}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{estadoTexto}</Typography>
          </Box>
          <Stack direction="row" spacing={1.25} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {publicada ? (
              <>
                <Button variant="outlined" color="inherit" disabled={guardando} onClick={() => pedir('despublicar')} sx={{ borderColor: 'divider' }}>Pasar a borrador</Button>
                <Button variant="contained" disabled={guardando || !sucio || !conTitulo || !conTexto} onClick={() => pedir('guardar')}>Guardar cambios</Button>
              </>
            ) : (
              <>
                <Button variant="outlined" color="inherit" disabled={guardando || !conTitulo || (!nueva && !sucio)} onClick={() => pedir('borrador')} sx={{ borderColor: 'divider' }}>Guardar borrador</Button>
                <Button variant="contained" disabled={guardando || !conTitulo || !conTexto} onClick={() => pedir('publicar')}>Publicar</Button>
              </>
            )}
          </Stack>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 320px' }, alignItems: 'start' }}>
          <Paper sx={{ p: { xs: 2.5, md: 4 } }}>
            <Stack spacing={3}>
              <TextField
                label="Título"
                value={form.titulo}
                onChange={(e) => campo('titulo', e.target.value)}
                fullWidth
                multiline
                variant="standard"
                slotProps={{ input: { sx: { fontSize: { xs: 22, md: 26 }, fontWeight: 600, lineHeight: 1.25 } } }}
              />
              <TextField
                label="Extracto"
                value={form.extracto}
                onChange={(e) => campo('extracto', e.target.value)}
                fullWidth
                multiline
                minRows={2}
                helperText={<ContadorExtracto largo={form.extracto?.length ?? 0} />}
              />
              <EditorTexto valor={form.contenido} onCambio={(html) => campo('contenido', html)} etiqueta="Contenido de la noticia" />
            </Stack>
          </Paper>

          <Stack spacing={2.5}>
            <Panel titulo="Publicación">
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <EtiquetaEstado visible={inicial.visible && !nueva} />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {publicada ? 'Se ve en la web.' : 'Nadie la ve hasta que se publique.'}
                  </Typography>
                </Box>
                <Progreso piezas={piezasDeNoticia(form)} />
                <TextField
                  label="Fecha"
                  type="date"
                  size="small"
                  value={form.fecha ?? ''}
                  onChange={(e) => campo('fecha', e.target.value)}
                  helperText="Ordena las noticias: la más reciente sale la primera en la portada."
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />
                {publicada && guardada && (
                  <Button size="small" href={`/actualidad/noticias/${guardada.slug}`} target="_blank" rel="noopener" startIcon={<OpenInNewIcon />} sx={{ alignSelf: 'flex-start' }}>
                    Ver en la web
                  </Button>
                )}
              </Stack>
            </Panel>

            <Panel titulo="Foto">
              <CampoImagen
                apilada
                etiqueta="Foto de la noticia"
                valor={form.imagenUrl ?? ''}
                onCambio={(ruta) => campo('imagenUrl', ruta)}
                ayuda="JPG, PNG o WebP de hasta 5 MB. Mejor apaisada: en la portada se recorta a 4:3."
              />
            </Panel>

            <Panel titulo="Dirección en la web">
              <Direccion nueva={nueva} slug={form.slug ?? ''} automatica={direccionAutomatica(form.titulo, form.fecha ?? hoy())} onCambio={(slug) => campo('slug', slug)} />
            </Panel>

            <Panel titulo="Así sale en la portada">
              {/* La tarjeta de verdad, la misma que en la web, pero sin poder pulsarla. */}
              <div inert style={{ pointerEvents: 'none' }} data-testid="vista-previa-tarjeta">
                <TarjetaNoticia noticia={{
                  id: String(id ?? 'nueva'), slug: form.slug || 'vista-previa', categoria: 'Noticias',
                  titulo: form.titulo.trim() || 'Título de la noticia', extracto: form.extracto ?? '', contenido: form.contenido,
                  imagen: form.imagenUrl || undefined, fecha: form.fecha ? `${form.fecha}T12:00:00` : new Date().toISOString(),
                }} />
              </div>
            </Panel>
          </Stack>
        </Box>
      </Box>

      <DialogoConfirmacion
        abierto={confirmando !== null}
        titulo={{ publicar: '¿Publicar la noticia?', guardar: '¿Guardar los cambios?', despublicar: '¿Pasar la noticia a borrador?', borrador: '' }[confirmando ?? 'borrador']}
        mensaje={{
          publicar: 'Se verá en la web al momento.',
          guardar: 'La noticia está publicada: los cambios se verán en la web al momento.',
          despublicar: 'Dejará de verse en la web y en la portada. Podrás volver a publicarla cuando quieras.',
          borrador: '',
        }[confirmando ?? 'borrador']}
        textoConfirmar={{ publicar: 'Publicar', guardar: 'Guardar cambios', despublicar: 'Pasar a borrador', borrador: '' }[confirmando ?? 'borrador']}
        onConfirmar={() => { if (confirmando) void guardar(confirmando) }}
        onCancelar={() => setConfirmando(null)}
      />
      <AvisoCambiosSinGuardar bloqueo={bloqueo} deQue="esta noticia" />
      <Box sx={{ height: 24 }} />
    </>
  )
}

function vacia(): DatosDeNoticia {
  return { titulo: '', contenido: '', extracto: '', imagenUrl: '', visible: false, fecha: hoy(), slug: '' }
}

function Panel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Paper component="section" sx={{ p: 2.25 }}>
      <Typography component="h2" sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', mb: 1.5 }}>{titulo}</Typography>
      {children}
    </Paper>
  )
}

function ContadorExtracto({ largo }: { largo: number }) {
  const { superficies } = useTemaCms()
  const pasado = largo > EXTRACTO_RECOMENDADO
  return (
    <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
      <span>Lo que se lee en la portada y en el archivo.</span>
      <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: pasado ? superficies.avisoTexto : undefined, fontWeight: pasado ? 600 : undefined }}>
        {largo} / {EXTRACTO_RECOMENDADO}
      </Box>
    </Box>
  )
}

/**
 * La dirección pública de la noticia. En una nueva se puede escribir (o dejar
 * que salga del título); una vez guardada queda fija, porque cambiarla rompe
 * los enlaces que ya se hayan compartido.
 */
function Direccion({ nueva, slug, automatica, onCambio }: { nueva: boolean; slug: string; automatica: string; onCambio: (slug: string) => void }) {
  if (!nueva) {
    return (
      <>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 1.25, borderRadius: 1, backgroundColor: 'action.hover', fontFamily: 'monospace', fontSize: 12.5, overflowWrap: 'anywhere', '& svg': { fontSize: 16, color: 'text.secondary', flexShrink: 0 } }}>
          <LockOutlinedIcon aria-hidden="true" />/actualidad/noticias/{slug}
        </Box>
        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
          Fija: cambiarla rompería los enlaces que ya se hayan compartido.
        </Typography>
      </>
    )
  }
  return (
    <TextField
      label="Dirección (opcional)"
      size="small"
      value={slug}
      // Solo lo que admite el servidor: minúsculas, números y guiones.
      onChange={(e) => onCambio(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
      placeholder={automatica || 'se crea con el título'}
      helperText={`Vacía, se crea con el título${automatica ? `: /actualidad/noticias/${automatica}` : ''}. Queda fija al guardar.`}
      slotProps={{ inputLabel: { shrink: true } }}
      fullWidth
    />
  )
}
