import { useState, type ReactNode } from 'react'
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Helmet } from 'react-helmet-async'
import { Link, useParams } from 'react-router-dom'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import TarjetaPublicacion from '../../components/TarjetaPublicacion'
import temaPublico from '../../theme'
import { hoy } from '../../lib/fechas'
import { ANCHO_EDICION } from './PantallaEdicion'
import AvisoCambiosSinGuardar from './ficha/AvisoCambiosSinGuardar'
import { useFichaCms } from './ficha/useFichaCms'
import CampoImagen from './CampoImagen'
import CampoPdf from './CampoPdf'
import { EtiquetaEstado, Progreso } from './redaccion/FilaRedaccion'
import { haceCuanto, piezasDePublicacion } from './redaccion/completitud'
import { AYUDA_PDF, AYUDA_PORTADA, ETIQUETA_PORTADA, TIPOS_PUBLICACION } from './portadaPublicacion'
import { crearPublicacion, publicacionDelCms, actualizarPublicacion, type PublicacionDeLaApi, type DatosDePublicacion } from '../../lib/api/publicaciones'
import { site } from '../../config/site'

type Accion = 'borrador' | 'publicar' | 'guardar' | 'despublicar'


/**
 * La ficha de una publicación, nueva o ya subida.
 *
 * Igual que la de una noticia: a la izquierda se escribe (título, descripción
 * y tipo); a la derecha se decide (estado y fecha) y se sube lo que se
 * descarga y lo que se ve: el PDF y la portada, con la tarjeta tal como sale
 * en el listado de la web. Antes crear era una ventana y editar otra pantalla
 * con los campos en fila; ahora las dos cosas son esta ficha.
 *
 * Publicar o no son los botones de arriba, no un interruptor al final. Un
 * borrador se guarda como borrador o se publica; una publicada guarda sus
 * cambios o vuelve a borrador. Lo que se ve en la web al momento (publicar,
 * cambiar una publicada, retirarla) pide confirmación.
 *
 * El servidor pide el PDF para guardar, también un borrador: es la
 * publicación misma. Sin él los botones no se activan, y se dice por qué.
 */
export default function PublicacionEditPage() {
  const { id } = useParams()
  const nueva = id === undefined
  const [confirmando, setConfirmando] = useState<Accion | null>(null)
  const { cargado: guardada, form, inicial, sucio, guardando, error, bloqueo, volverAlListado, campo, guardar: guardarFicha } =
    useFichaCms<PublicacionDeLaApi, DatosDePublicacion>({
      listado: '/cms/publicaciones',
      origen: nueva ? null : Number(id),
      cargar: publicacionDelCms,
      aFormulario: (item) => ({
        titulo: item.titulo, descripcion: item.descripcion ?? '', imagenUrl: item.imagenUrl ?? '',
        archivoUrl: item.archivoUrl, categoria: item.categoria, visible: item.visible, fecha: item.fecha.slice(0, 10),
      }),
      vacio: vacia(),
      errorAlCargar: 'No se ha podido cargar la publicación.',
    })

  if (error && !form) return <Alert severity="error">{error}</Alert>
  if (!form || !inicial) return <CircularProgress aria-label="Cargando la publicación" />

  const publicada = !nueva && inicial.visible
  const falta = [form.titulo.trim() === '' && 'el título', !form.archivoUrl && 'el PDF'].filter(Boolean) as string[]
  const sePuedeGuardar = falta.length === 0

  const guardar = async (accion: Accion) => {
    setConfirmando(null)
    const datos: DatosDePublicacion = {
      ...form,
      visible: accion === 'publicar' || accion === 'guardar',
      // En una nueva, la fecha solo se manda si se ha tocado: si no, el servidor
      // pone el momento de guardar, con su hora, y el orden del día se respeta.
      fecha: nueva && form.fecha === inicial.fecha ? undefined : form.fecha,
    }
    await guardarFicha(
      () => (nueva ? crearPublicacion(datos) : actualizarPublicacion(Number(id), datos)),
      {
        siFalla: 'No se ha podido guardar la publicación.',
        aviso: {
          borrador: 'Borrador guardado. No se ve en la web hasta que se publique.',
          publicar: 'Publicada: ya se puede descargar desde la web.',
          guardar: 'Cambios guardados: ya se ven en la web.',
          despublicar: 'Pasada a borrador: ya no se ve en la web.',
        }[accion],
      },
    )
  }

  // Guardar un borrador no se ve fuera: va directo. Lo demás cambia la web y se confirma.
  const pedir = (accion: Accion) => (accion === 'borrador' ? void guardar(accion) : setConfirmando(accion))

  const titulo = nueva ? 'Nueva publicación' : (guardada?.titulo ?? form.titulo)
  const estadoTexto = nueva
    ? 'Sin guardar todavía'
    : `${inicial.visible ? 'Publicada' : 'Borrador'}${guardada?.updatedAt ? ` · guardada ${haceCuanto(guardada.updatedAt)}` : ''}`

  return (
    <>
      <Helmet><title>{`${nueva ? 'Nueva publicación' : 'Editar publicación'} | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <Box sx={{ maxWidth: ANCHO_EDICION, mx: 'auto' }}>
        <Button component={Link} to={volverAlListado} startIcon={<ArrowBackIcon />} size="small" color="inherit" sx={{ mb: 1.5, color: 'text.secondary' }}>Publicaciones</Button>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-end', mb: 3 }}>
          <Box sx={{ minWidth: 0, flex: '1 1 320px' }}>
            <Typography variant="h2" component="h1" sx={{ fontSize: { xs: 26, md: 32 }, textWrap: 'balance', overflowWrap: 'anywhere' }}>{titulo}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>{estadoTexto}</Typography>
          </Box>
          <Box>
            <Stack direction="row" spacing={1.25} useFlexGap sx={{ flexWrap: 'wrap' }}>
              {publicada ? (
                <>
                  <Button variant="outlined" color="inherit" disabled={guardando} onClick={() => pedir('despublicar')} sx={{ borderColor: 'divider' }}>Pasar a borrador</Button>
                  <Button variant="contained" disabled={guardando || !sucio || !sePuedeGuardar} onClick={() => pedir('guardar')}>Guardar cambios</Button>
                </>
              ) : (
                <>
                  <Button variant="outlined" color="inherit" disabled={guardando || !sePuedeGuardar || (!nueva && !sucio)} onClick={() => pedir('borrador')} sx={{ borderColor: 'divider' }}>Guardar borrador</Button>
                  <Button variant="contained" disabled={guardando || !sePuedeGuardar} onClick={() => pedir('publicar')}>Publicar</Button>
                </>
              )}
            </Stack>
            {!sePuedeGuardar && (
              <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: 'text.secondary' }}>
                Para guardar hace falta {falta.join(' y ')}.
              </Typography>
            )}
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 320px' }, alignItems: 'start' }}>
          <Stack spacing={2.5}>
            <Paper sx={{ p: { xs: 2.5, md: 4 } }}>
              <Stack spacing={3}>
                <TextField
                  label="Título"
                  value={form.titulo}
                  onChange={(e) => campo('titulo', e.target.value)}
                  fullWidth
                  multiline
                  variant="standard"
                  helperText="Si lleva el número («Boletín n.º 12») o el curso («2025-2026»), la web lo pone grande en la cubierta cuando no hay portada."
                  slotProps={{ input: { sx: { fontSize: { xs: 22, md: 26 }, fontWeight: 600, lineHeight: 1.25 } } }}
                />
                <TextField
                  label="Descripción"
                  value={form.descripcion}
                  onChange={(e) => campo('descripcion', e.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                  helperText="Lo que se lee bajo el título en la portada y en el listado de publicaciones: qué trae este número."
                />
                <TextField select label="Tipo" value={form.categoria} onChange={(e) => campo('categoria', e.target.value as DatosDePublicacion['categoria'])} sx={{ maxWidth: 280 }}>
                  {TIPOS_PUBLICACION.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                </TextField>
              </Stack>
            </Paper>

            <Panel titulo="Así sale en la web">
              {/* La tarjeta de verdad, la del listado de publicaciones, pero sin poder pulsarla.
                  Es translúcida: sin el tema y el fondo de la web pública, en el CMS claro se leería gris sobre gris. */}
              <ThemeProvider theme={temaPublico}>
                <Box inert data-testid="vista-previa-tarjeta" sx={{ p: 2, borderRadius: 1, backgroundColor: 'background.default', color: 'text.primary', fontFamily: temaPublico.typography.fontFamily, pointerEvents: 'none', '& > *': { maxWidth: 340 } }}>
                  <TarjetaPublicacion publicacion={{
                    id: String(id ?? 'nueva'), titulo: form.titulo.trim() || 'Título de la publicación', descripcion: form.descripcion || undefined,
                    imagen: form.imagenUrl || undefined, fecha: form.fecha ? `${form.fecha}T12:00:00` : new Date().toISOString(), categoria: form.categoria,
                  }} />
                </Box>
              </ThemeProvider>
            </Panel>
          </Stack>

          <Stack spacing={2.5}>
            <Panel titulo="Publicación">
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <EtiquetaEstado visible={publicada} />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {publicada ? 'Se puede descargar desde la web.' : 'Nadie la ve hasta que se publique.'}
                  </Typography>
                </Box>
                <Progreso piezas={piezasDePublicacion(form)} />
                <TextField
                  label="Fecha"
                  type="date"
                  size="small"
                  value={form.fecha ?? ''}
                  onChange={(e) => campo('fecha', e.target.value)}
                  helperText="Ordena las publicaciones: las tres más recientes salen en la portada."
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />
              </Stack>
            </Panel>

            <Panel titulo="PDF">
              <CampoPdf apilada etiqueta="Lo que se descarga" ayuda={AYUDA_PDF} valor={form.archivoUrl} onCambio={(ruta) => campo('archivoUrl', ruta)} />
            </Panel>

            <Panel titulo="Portada">
              <CampoImagen
                apilada
                vertical
                etiqueta={ETIQUETA_PORTADA}
                valor={form.imagenUrl ?? ''}
                onCambio={(ruta) => campo('imagenUrl', ruta)}
                ayuda={AYUDA_PORTADA}
              />
            </Panel>
          </Stack>
        </Box>
      </Box>

      <DialogoConfirmacion
        abierto={confirmando !== null}
        titulo={{ publicar: '¿Publicarla en la web?', guardar: '¿Guardar los cambios?', despublicar: '¿Pasarla a borrador?', borrador: '' }[confirmando ?? 'borrador']}
        mensaje={{
          publicar: 'Se podrá descargar desde la web al momento.',
          guardar: 'La publicación está en la web: los cambios se verán al momento.',
          despublicar: 'Dejará de verse en la web y en la portada. Podrás volver a publicarla cuando quieras.',
          borrador: '',
        }[confirmando ?? 'borrador']}
        textoConfirmar={{ publicar: 'Publicar', guardar: 'Guardar cambios', despublicar: 'Pasar a borrador', borrador: '' }[confirmando ?? 'borrador']}
        onConfirmar={() => { if (confirmando) void guardar(confirmando) }}
        onCancelar={() => setConfirmando(null)}
      />
      <AvisoCambiosSinGuardar bloqueo={bloqueo} deQue="esta publicación" />
      <Box sx={{ height: 24 }} />
    </>
  )
}

function vacia(): DatosDePublicacion {
  return { titulo: '', descripcion: '', imagenUrl: '', archivoUrl: '', categoria: 'boletin', visible: false, fecha: hoy() }
}

function Panel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Paper component="section" sx={{ p: 2.25 }}>
      <Typography component="h2" sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', mb: 1.5 }}>{titulo}</Typography>
      {children}
    </Paper>
  )
}
