import { useEffect, useState } from 'react'
import { Alert, Box, Button, Chip, CircularProgress, IconButton, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined'
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined'
import { Helmet } from 'react-helmet-async'
import { useQueryClient } from '@tanstack/react-query'
import topes from '../../../../shared/topes-contenido.json'
import PantallaEdicion from './PantallaEdicion'
import CampoImagen from './CampoImagen'
import SeccionPlegable from './contenido/SeccionPlegable'
import CampoTexto from './contenido/CampoTexto'
import {
  CLAVE_TITULAR, getContenido, guardarContenido,
  type ContenidoTitular, type MedioGaleria,
} from '../../lib/api/contenido'

export const AVISO_SIN_ALT = 'Hay un medio sin descripción: es lo que oye quien usa un lector de pantalla. Descríbelo o quítalo antes de guardar.'
export const AVISO_VIDEO_SIN_PORTADA = 'Hay un vídeo sin foto de portada. Hace falta para no llamar a YouTube hasta que el visitante pulse el play.'

const AYUDA_VIDEO = 'Pega la dirección de YouTube o Vimeo. Se guarda en su forma sin cookies, y el vídeo no se carga hasta que alguien pulsa el play.'
const AYUDA_PORTADA = 'JPG, PNG o WebP apaisado, de hasta 5 MB. Es lo que se ve antes de darle al play, en vez de pedirle la miniatura a YouTube.'
const AYUDA_FOTO = 'JPG, PNG o WebP apaisado, de hasta 5 MB.'
const AYUDA_ALT = 'Lo que se ve, en una frase. Es lo que oye quien usa un lector de pantalla.'

type Campos = Omit<ContenidoTitular, 'galeria'>

/** La clave la pone el CMS para que React siga la fila al reordenarla. */
interface Fila extends MedioGaleria { clave: number }

let ultimaClave = 0
const conClave = (medio: MedioGaleria): Fila => ({ ...medio, clave: ++ultimaClave })
const sinClave = (filas: Fila[]): MedioGaleria[] =>
  filas.map(({ tipo, url, portada, alt, pie }) => ({ tipo, url, portada, alt, pie }))

const FOTO_NUEVA: MedioGaleria = { tipo: 'foto', url: '', portada: '', alt: '', pie: '' }
const VIDEO_NUEVO: MedioGaleria = { tipo: 'video', url: '', portada: '', alt: '', pie: '' }

const sinAlt = (medio: MedioGaleria) => medio.alt.trim() === ''
const videoSinPortada = (medio: MedioGaleria) => medio.tipo === 'video' && medio.portada === ''

/**
 * La galería de la Sagrada Titular: fotos propias y vídeos de YouTube o Vimeo,
 * en el orden en que se pasan.
 *
 * Los vídeos no se suben: se pega su dirección. Un vídeo en el servidor ocupa
 * cientos de megas, hay que servirlo con ancho de banda propio y pasarlo por el
 * antivirus; y el Grupo Parroquial ya los publica en sus canales. Lo que sí se
 * sube es la **portada** de cada vídeo, para no pedirle la miniatura a YouTube
 * nada más abrir la página.
 */
export default function TitularAdminPage() {
  const queryClient = useQueryClient()
  const [campos, setCampos] = useState<Campos | null>(null)
  const [filas, setFilas] = useState<Fila[]>([])
  const [inicial, setInicial] = useState<ContenidoTitular | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getContenido<ContenidoTitular>('titular')
      .then(({ galeria, ...resto }) => {
        setCampos(resto)
        setFilas(galeria.map(conClave))
        setInicial({ ...resto, galeria })
      })
      .catch(() => setError('No se ha podido cargar la página de la Sagrada Titular.'))
  }, [])

  const cambiar = (clave: number, cambios: Partial<MedioGaleria>) =>
    setFilas((actual) => actual.map((fila) => (fila.clave === clave ? { ...fila, ...cambios } : fila)))

  const quitar = (clave: number) => setFilas((actual) => actual.filter((fila) => fila.clave !== clave))

  const mover = (indice: number, salto: -1 | 1) =>
    setFilas((actual) => {
      const destino = indice + salto
      if (destino < 0 || destino >= actual.length) return actual
      const copia = [...actual]
      copia[indice] = actual[destino]
      copia[destino] = actual[indice]
      return copia
    })

  const anadir = (medio: MedioGaleria) => setFilas((actual) => [...actual, conClave(medio)])

  const guardar = async () => {
    if (!campos) return
    // El servidor rechaza las dos cosas (contenido.schema.ts). Se avisa arriba y
    // no solo junto al campo porque la fila puede estar fuera de la vista.
    if (filas.some(sinAlt)) { setError(AVISO_SIN_ALT); return }
    if (filas.some(videoSinPortada)) { setError(AVISO_VIDEO_SIN_PORTADA); return }

    const datos: ContenidoTitular = { ...campos, galeria: sinClave(filas) }
    // Guardar sin haber tocado nada mandaría un PUT y un apunte de auditoría
    // para dejarlo todo igual, como ya evitan la portada, el recorrido e Historia.
    if (JSON.stringify(datos) === JSON.stringify(inicial)) return
    setGuardando(true)
    setError(null)
    try {
      await guardarContenido('titular', datos)
      setInicial(datos)
      setGuardado(true)
      void queryClient.invalidateQueries({ queryKey: CLAVE_TITULAR })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar la galería.')
    } finally {
      setGuardando(false)
    }
  }

  if (error && !campos) return <Alert severity="error">{error}</Alert>
  if (!campos) return <CircularProgress aria-label="Cargando la página de la Sagrada Titular" />

  const documento: ContenidoTitular = { ...campos, galeria: sinClave(filas) }
  const sucio = JSON.stringify(documento) !== JSON.stringify(inicial)

  return (
    <>
      <Helmet><title>Sagrada Titular | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {guardado && !sucio && <Alert severity="success" sx={{ mb: 3 }}>Galería guardada. La página ya la enseña así.</Alert>}

      <PantallaEdicion
        titulo="Sagrada Titular"
        nombre="Galería de la Titular"
        sucio={sucio}
        guardando={guardando}
        volverA="/cms"
        onGuardar={guardar}
      >
        <Stack spacing={3}>
          <SeccionPlegable titulo="Cabecera" abiertaPorDefecto>
            <CampoTexto
              etiqueta="Antetítulo"
              valor={campos.ceja}
              onCambio={(ceja) => setCampos((actual) => actual && { ...actual, ceja })}
              ayuda="Línea pequeña en mayúsculas, encima del título grande."
              maxLength={topes.etiqueta}
            />
            <CampoTexto
              etiqueta="Título"
              valor={campos.titulo}
              onCambio={(titulo) => setCampos((actual) => actual && { ...actual, titulo })}
              ayuda="Encabezado grande de la página, arriba del todo."
              maxLength={topes.titulo}
            />
            <CampoTexto
              etiqueta="Presentación"
              valor={campos.subtitulo}
              onCambio={(subtitulo) => setCampos((actual) => actual && { ...actual, subtitulo })}
              ayuda="Párrafo centrado bajo la cabecera, antes del pase de fotos."
              maxLength={topes.parrafo}
              multilinea
            />
          </SeccionPlegable>

          <Box>
            <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1.5, alignItems: 'center' }}>
              <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
                Galería ({filas.length})
              </Typography>
              <Button startIcon={<AddPhotoAlternateOutlinedIcon />} onClick={() => anadir(FOTO_NUEVA)}>Añadir foto</Button>
              <Button startIcon={<MovieOutlinedIcon />} onClick={() => anadir(VIDEO_NUEVO)}>Añadir vídeo</Button>
            </Stack>

            {filas.length === 0 && (
              <Alert severity="info">
                Sin medios, la página de la Sagrada Titular no enseña el pase de fotos. El resto de la página sigue igual.
              </Alert>
            )}

            <Stack spacing={2}>
              {filas.map((fila, indice) => (
                <Paper key={fila.clave} sx={{ p: 2.5 }}>
                  <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center' }}>
                    <Chip
                      size="small"
                      icon={fila.tipo === 'video' ? <MovieOutlinedIcon /> : <AddPhotoAlternateOutlinedIcon />}
                      label={fila.tipo === 'video' ? 'Vídeo' : 'Foto'}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                      Posición {indice + 1} de {filas.length}
                    </Typography>
                    <Tooltip title="Subir">
                      <span>
                        <IconButton aria-label={`Subir el medio ${indice + 1}`} disabled={indice === 0} onClick={() => mover(indice, -1)}>
                          <ArrowUpwardIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Bajar">
                      <span>
                        <IconButton aria-label={`Bajar el medio ${indice + 1}`} disabled={indice === filas.length - 1} onClick={() => mover(indice, 1)}>
                          <ArrowDownwardIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Quitar">
                      <IconButton color="error" aria-label={`Quitar el medio ${indice + 1}`} onClick={() => quitar(fila.clave)}>
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>

                  <Stack spacing={2}>
                    {fila.tipo === 'video' ? (
                      <>
                        <TextField
                          label="Dirección del vídeo"
                          value={fila.url}
                          onChange={(e) => cambiar(fila.clave, { url: e.target.value })}
                          fullWidth
                          placeholder="https://www.youtube.com/watch?v=…"
                          helperText={AYUDA_VIDEO}
                        />
                        <CampoImagen
                          valor={fila.portada}
                          onCambio={(ruta) => cambiar(fila.clave, { portada: ruta })}
                          etiqueta="Foto de portada del vídeo"
                          ayuda={AYUDA_PORTADA}
                          apaisada
                        />
                      </>
                    ) : (
                      <CampoImagen
                        valor={fila.url}
                        onCambio={(ruta) => cambiar(fila.clave, { url: ruta })}
                        etiqueta="Foto"
                        ayuda={AYUDA_FOTO}
                        apaisada
                      />
                    )}

                    <CampoTexto
                      etiqueta="Descripción"
                      valor={fila.alt}
                      onCambio={(alt) => cambiar(fila.clave, { alt })}
                      ayuda={AYUDA_ALT}
                      maxLength={topes.descripcion}
                    />
                    <CampoTexto
                      etiqueta="Pie (opcional)"
                      valor={fila.pie}
                      onCambio={(pie) => cambiar(fila.clave, { pie })}
                      ayuda="Frase corta bajo la foto o el vídeo. Se puede dejar vacía."
                      maxLength={topes.etiqueta}
                    />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Box>
        </Stack>
      </PantallaEdicion>
    </>
  )
}
