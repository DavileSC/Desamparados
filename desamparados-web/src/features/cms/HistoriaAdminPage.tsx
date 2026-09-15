import { useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, IconButton, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import AddIcon from '@mui/icons-material/Add'
import { Helmet } from 'react-helmet-async'
import { useQueryClient } from '@tanstack/react-query'
import PantallaEdicion from './PantallaEdicion'
import CampoImagen from './CampoImagen'
import SeccionPlegable from './contenido/SeccionPlegable'
import CampoTexto from './contenido/CampoTexto'
import {
  CLAVE_HISTORIA, getContenido, guardarContenido,
  type ContenidoHistoria, type HitoHistoria, type TonoHito,
} from '../../lib/api/contenido'

const AYUDA_FONDO = 'JPG, PNG o WebP grande y apaisado, de hasta 5 MB. Se ve muy velado detrás de toda la página de Historia. Sin foto, el fondo queda liso.'
const AYUDA_FOTO = 'JPG, PNG o WebP apaisado, de hasta 5 MB. Sale dentro del hito, debajo de su texto.'
const AYUDA_FOTO_ALT = 'La foto, en una frase. Es lo que oye quien usa un lector de pantalla.'
export const AVISO_FOTO_SIN_ALT = 'Hay una foto de hito sin descripción: es lo que oye quien usa un lector de pantalla. Descríbela o quítala antes de guardar.'

/**
 * Los tres colores de un hito. No hay un color libre: cada uno responde a algo
 * de la web, y así se le explica a quien edita.
 */
const TONOS: { valor: TonoHito; nombre: string }[] = [
  { valor: 'ninguno', nombre: 'Ninguno' },
  { valor: 'granate', nombre: 'Granate: el color del Sábado de Pasión' },
  { valor: 'oro', nombre: 'Dorado: el momento actual' },
]

/** Los campos sueltos del documento, sin los hitos: esos llevan su propia clave de fila. */
type Campos = Omit<ContenidoHistoria, 'hitos'>

/** Una fila de la lista de hitos: la clave la da el propio CMS, para que React siga la fila al reordenar. */
interface Fila extends HitoHistoria {
  clave: number
}

let ultimaClave = 0
const conClave = (hito: HitoHistoria): Fila => ({ ...hito, clave: ++ultimaClave })
const sinClave = (filas: Fila[]): HitoHistoria[] =>
  filas.map(({ periodo, etiqueta, titulo, relato, foto, tono }) => ({ periodo, etiqueta, titulo, relato, foto, tono }))

const HITO_NUEVO: HitoHistoria = { periodo: '', etiqueta: '', titulo: '', relato: '', foto: { url: '', alt: '', pie: '' }, tono: 'ninguno' }

const fotoSinAlt = (hito: HitoHistoria) => hito.foto.url !== '' && hito.foto.alt.trim() === ''

/** Cabecera, foto de fondo, hitos y cierre de la página de Historia: se editan a la vez y se guardan en bloque. */
export default function HistoriaAdminPage() {
  const queryClient = useQueryClient()
  const [campos, setCampos] = useState<Campos | null>(null)
  const [filas, setFilas] = useState<Fila[]>([])
  const [inicial, setInicial] = useState<ContenidoHistoria | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getContenido<ContenidoHistoria>('historia')
      .then(({ hitos, ...resto }) => {
        setCampos(resto)
        setFilas(hitos.map(conClave))
        setInicial({ ...resto, hitos })
      })
      .catch(() => setError('No se ha podido cargar la historia.'))
  }, [])

  const cambiarHito = (clave: number, cambios: Partial<HitoHistoria>) =>
    setFilas((actual) => actual.map((fila) => (fila.clave === clave ? { ...fila, ...cambios } : fila)))

  const cambiarFoto = (clave: number, cambios: Partial<HitoHistoria['foto']>) =>
    setFilas((actual) => actual.map((fila) => (fila.clave === clave ? { ...fila, foto: { ...fila.foto, ...cambios } } : fila)))

  const quitarHito = (clave: number) => setFilas((actual) => actual.filter((fila) => fila.clave !== clave))

  const moverHito = (indice: number, salto: -1 | 1) =>
    setFilas((actual) => {
      const destino = indice + salto
      if (destino < 0 || destino >= actual.length) return actual
      const copia = [...actual]
      copia[indice] = actual[destino]
      copia[destino] = actual[indice]
      return copia
    })

  const anadirHito = () => setFilas((actual) => [...actual, conClave(HITO_NUEVO)])

  const guardar = async () => {
    if (!campos) return
    // El servidor también lo rechaza (contenido.schema.ts): mejor no ni mandarlo.
    // Arriba y no solo junto al campo: el hito puede estar fuera de la vista.
    if (filas.some(fotoSinAlt)) {
      setError(AVISO_FOTO_SIN_ALT)
      return
    }
    const datos: ContenidoHistoria = { ...campos, hitos: sinClave(filas) }
    // Guardar sin haber tocado nada mandaría un PUT, escribiría un apunte de
    // auditoría y movería el `updatedAt` para dejar el documento igual que
    // estaba, como ya evitan la portada y el recorrido.
    if (JSON.stringify(datos) === JSON.stringify(inicial)) return
    setGuardando(true)
    setError(null)
    try {
      await guardarContenido('historia', datos)
      setInicial(datos)
      setGuardado(true)
      // La página pública de Historia comparte caché con el CMS en la misma
      // pestaña: que la siguiente visita pida el documento nuevo, no el guardado.
      void queryClient.invalidateQueries({ queryKey: CLAVE_HISTORIA })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar la historia.')
    } finally {
      setGuardando(false)
    }
  }

  if (error && !campos) return <Alert severity="error">{error}</Alert>
  if (!campos) return <CircularProgress aria-label="Cargando la historia" />

  const documento: ContenidoHistoria = { ...campos, hitos: sinClave(filas) }
  const sucio = JSON.stringify(documento) !== JSON.stringify(inicial)

  return (
    <>
      <Helmet><title>Historia | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {guardado && !sucio && <Alert severity="success" sx={{ mb: 3 }}>Historia guardada. La página ya la enseña así.</Alert>}
      <PantallaEdicion
        titulo="Historia"
        nombre="Cabecera, foto de fondo, hitos y cierre de la página de Historia"
        sucio={sucio}
        guardando={guardando}
        volverA="/cms"
        onGuardar={guardar}
      >
        <SeccionPlegable titulo="Cabecera" abiertaPorDefecto>
          <CampoTexto
            etiqueta="Antetítulo"
            valor={campos.ceja}
            onCambio={(ceja) => setCampos((actual) => actual && { ...actual, ceja })}
            ayuda="Línea pequeña en mayúsculas, encima del título grande."
            maxLength={60}
          />
          <CampoTexto
            etiqueta="Título"
            valor={campos.titulo}
            onCambio={(titulo) => setCampos((actual) => actual && { ...actual, titulo })}
            ayuda="Encabezado grande de la página, arriba del todo."
            maxLength={120}
          />
          <CampoTexto
            etiqueta="Subtítulo"
            valor={campos.subtitulo}
            onCambio={(subtitulo) => setCampos((actual) => actual && { ...actual, subtitulo })}
            ayuda="Frase bajo el título, a la izquierda del índice de momentos."
            maxLength={600}
            multilinea
          />
        </SeccionPlegable>

        <SeccionPlegable titulo="Foto de fondo">
          <CampoImagen
            etiqueta="Foto de fondo"
            ayuda={AYUDA_FONDO}
            apaisada
            valor={campos.fondo.url}
            onCambio={(url) => setCampos((actual) => actual && { ...actual, fondo: { url } })}
          />
        </SeccionPlegable>

        <SeccionPlegable titulo="Hitos" abiertaPorDefecto>
          <Typography variant="body2" color="text.secondary">
            Cada hito es un momento de la cronología, en el orden en que se leen. El índice de la cabecera se hace solo con el periodo y la etiqueta de cada uno.
          </Typography>
          <Stack component="ol" spacing={2} sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {filas.map((fila, indice) => {
              const n = indice + 1
              return (
                <Paper key={fila.clave} component="li" variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography component="h3" sx={{ fontWeight: 600 }}>Hito {n}</Typography>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Subir">
                          <span>
                            <IconButton aria-label={`Subir el hito ${n}`} disabled={indice === 0} onClick={() => moverHito(indice, -1)}>
                              <ArrowUpwardIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Bajar">
                          <span>
                            <IconButton aria-label={`Bajar el hito ${n}`} disabled={indice === filas.length - 1} onClick={() => moverHito(indice, 1)}>
                              <ArrowDownwardIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Quitar">
                          <span>
                            <IconButton aria-label={`Quitar el hito ${n}`} onClick={() => quitarHito(fila.clave)}>
                              <DeleteOutlineIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    </Stack>

                    {/* Los tres campos cortos en una fila: con la columna de
                        edición ancha caben, y el relato queda solo con todo el ancho. */}
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'flex-start' } }}>
                      <TextField
                        label={`Periodo del hito ${n}`}
                        value={fila.periodo}
                        onChange={(e) => cambiarHito(fila.clave, { periodo: e.target.value })}
                        helperText="En grande, en serif: «Años 50», «1954» o «Hoy»."
                        slotProps={{ htmlInput: { maxLength: 60 } }}
                        size="small"
                        sx={{ width: { xs: '100%', md: 220 }, flexShrink: 0 }}
                      />
                      <TextField
                        label={`Etiqueta del hito ${n}`}
                        value={fila.etiqueta}
                        onChange={(e) => cambiarHito(fila.clave, { etiqueta: e.target.value })}
                        helperText="Bajo el periodo y en el índice de la cabecera."
                        slotProps={{ htmlInput: { maxLength: 60 } }}
                        size="small"
                        fullWidth
                      />
                      <TextField
                        select
                        label={`Color del hito ${n}`}
                        value={fila.tono}
                        onChange={(e) => cambiarHito(fila.clave, { tono: e.target.value as TonoHito })}
                        helperText="Tiñe el periodo y el punto de la línea. No hay colores libres."
                        slotProps={{ select: { native: true } }}
                        size="small"
                        sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}
                      >
                        {TONOS.map((tono) => <option key={tono.valor} value={tono.valor}>{tono.nombre}</option>)}
                      </TextField>
                    </Stack>
                    <TextField
                      label={`Título del hito ${n}`}
                      value={fila.titulo}
                      onChange={(e) => cambiarHito(fila.clave, { titulo: e.target.value })}
                      helperText="Encabezado del hito, junto a su texto."
                      slotProps={{ htmlInput: { maxLength: 120 } }}
                      size="small"
                      fullWidth
                    />
                    <TextField
                      label={`Relato del hito ${n}`}
                      value={fila.relato}
                      onChange={(e) => cambiarHito(fila.clave, { relato: e.target.value })}
                      helperText="El texto del hito. Una línea en blanco separa un párrafo del siguiente."
                      slotProps={{ htmlInput: { maxLength: 1200 } }}
                      multiline
                      minRows={4}
                      size="small"
                      fullWidth
                    />
                    <CampoImagen
                      etiqueta={`Foto del hito ${n}`}
                      ayuda={AYUDA_FOTO}
                      apaisada
                      valor={fila.foto.url}
                      onCambio={(url) => cambiarFoto(fila.clave, { url })}
                    />
                    {fila.foto.url !== '' && (
                      <>
                        <TextField
                          label={`Qué se ve en la foto del hito ${n}`}
                          value={fila.foto.alt}
                          onChange={(e) => cambiarFoto(fila.clave, { alt: e.target.value })}
                          helperText={AYUDA_FOTO_ALT}
                          slotProps={{ htmlInput: { maxLength: 200 } }}
                          size="small"
                          fullWidth
                        />
                        <TextField
                          label={`Pie de la foto del hito ${n}`}
                          value={fila.foto.pie}
                          onChange={(e) => cambiarFoto(fila.clave, { pie: e.target.value })}
                          helperText="Línea pequeña bajo la foto. Puede quedar vacía."
                          slotProps={{ htmlInput: { maxLength: 60 } }}
                          size="small"
                          fullWidth
                        />
                        {fotoSinAlt(fila) && <Alert severity="warning">{AVISO_FOTO_SIN_ALT}</Alert>}
                      </>
                    )}
                  </Stack>
                </Paper>
              )
            })}
          </Stack>

          <Box sx={{ mt: filas.length ? 2 : 0 }}>
            <Button startIcon={<AddIcon />} onClick={anadirHito}>Añadir hito</Button>
          </Box>
        </SeccionPlegable>

        <SeccionPlegable titulo="Cierre">
          <CampoTexto
            etiqueta="Antetítulo del cierre"
            valor={campos.cierre.ceja}
            onCambio={(ceja) => setCampos((actual) => actual && { ...actual, cierre: { ...actual.cierre, ceja } })}
            ayuda="Línea pequeña en mayúsculas del bloque final, después de los hitos."
            maxLength={60}
          />
          <CampoTexto
            etiqueta="Título del cierre"
            valor={campos.cierre.titulo}
            onCambio={(titulo) => setCampos((actual) => actual && { ...actual, cierre: { ...actual.cierre, titulo } })}
            ayuda="Frase grande del bloque final."
            maxLength={120}
          />
          <CampoTexto
            etiqueta="Texto del enlace"
            valor={campos.cierre.enlace}
            onCambio={(enlace) => setCampos((actual) => actual && { ...actual, cierre: { ...actual.cierre, enlace } })}
            ayuda="Lo que se lee en el enlace del bloque final. Lleva siempre a Órganos de Gobierno; el destino no se cambia desde aquí."
            maxLength={60}
          />
        </SeccionPlegable>
      </PantallaEdicion>
    </>
  )
}
