import { useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, IconButton, Paper, Stack, TextField, Tooltip } from '@mui/material'
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
import { CLAVE_RECORRIDO, getContenido, guardarContenido, type ContenidoRecorrido, type ParadaRecorrido } from '../../lib/api/contenido'

const AYUDA_PLANO = 'JPG, PNG o WebP apaisado, de hasta 5 MB. Se enseña en la página del Recorrido, encima de las paradas.'
const AYUDA_PLANO_ALT = 'El plano, en una frase. Es lo que oye quien usa un lector de pantalla.'
export const AVISO_PLANO_SIN_ALT = 'El plano necesita una descripción antes de guardar: es lo que oye quien usa un lector de pantalla.'

/** Los campos sueltos del documento, sin las paradas: esas llevan su propia clave de fila. */
type Campos = Omit<ContenidoRecorrido, 'paradas'>

/** Una fila de la tabla de paradas: la clave la da el propio CMS, para que React siga la fila al reordenar.
 *  El itinerario repite lugares —la procesión pasa dos veces por «Plaza de la Constitución»—, así que ni el
 *  índice ni la pareja hora/lugar sirven de clave. */
interface Fila extends ParadaRecorrido {
  clave: number
}

let ultimaClave = 0
const conClave = (parada: ParadaRecorrido): Fila => ({ ...parada, clave: ++ultimaClave })
const sinClave = (filas: Fila[]): ParadaRecorrido[] => filas.map(({ hora, lugar }) => ({ hora, lugar }))

/** Cabecera, plano y paradas del recorrido de la procesión: se editan a la vez y se guardan en bloque. */
export default function RecorridoAdminPage() {
  const queryClient = useQueryClient()
  const [campos, setCampos] = useState<Campos | null>(null)
  const [filas, setFilas] = useState<Fila[]>([])
  const [inicial, setInicial] = useState<ContenidoRecorrido | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getContenido<ContenidoRecorrido>('recorrido')
      .then(({ paradas, ...resto }) => {
        setCampos(resto)
        setFilas(paradas.map(conClave))
        setInicial({ ...resto, paradas })
      })
      .catch(() => setError('No se ha podido cargar el recorrido.'))
  }, [])

  const cambiarParada = (clave: number, cambios: Partial<ParadaRecorrido>) =>
    setFilas((actual) => actual.map((fila) => (fila.clave === clave ? { ...fila, ...cambios } : fila)))

  const quitarParada = (clave: number) => setFilas((actual) => actual.filter((fila) => fila.clave !== clave))

  const moverParada = (indice: number, salto: -1 | 1) =>
    setFilas((actual) => {
      const destino = indice + salto
      if (destino < 0 || destino >= actual.length) return actual
      const copia = [...actual]
      copia[indice] = actual[destino]
      copia[destino] = actual[indice]
      return copia
    })

  const anadirParada = () => setFilas((actual) => [...actual, conClave({ hora: '', lugar: '' })])

  const guardar = async () => {
    if (!campos) return
    // El servidor también lo rechaza (contenido.schema.ts): mejor no ni mandarlo.
    // Se pone el error arriba y no solo el aviso del campo porque ese vive
    // dentro de la sección «Plano», que arranca plegada: quien confirmaba el
    // diálogo se quedaba mirando una pantalla que no decía nada ni hacía nada.
    if (campos.plano.url && !campos.plano.alt.trim()) {
      setError(AVISO_PLANO_SIN_ALT)
      return
    }
    const datos: ContenidoRecorrido = { ...campos, paradas: sinClave(filas) }
    // Guardar sin haber tocado nada mandaría un PUT, escribiría un apunte de
    // auditoría y movería el `updatedAt` para dejar el documento igual que
    // estaba. La portada ya se negaba a hacerlo a propósito (PortadaAdminPage);
    // esta pantalla no tenía por qué comportarse distinto.
    if (JSON.stringify(datos) === JSON.stringify(inicial)) return
    setGuardando(true)
    setError(null)
    try {
      await guardarContenido('recorrido', datos)
      setInicial(datos)
      setGuardado(true)
      // La página pública del Recorrido comparte caché con el CMS en la misma
      // pestaña: que la siguiente visita pida el documento nuevo, no el guardado.
      void queryClient.invalidateQueries({ queryKey: CLAVE_RECORRIDO })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar el recorrido.')
    } finally {
      setGuardando(false)
    }
  }

  if (error && !campos) return <Alert severity="error">{error}</Alert>
  if (!campos) return <CircularProgress aria-label="Cargando el recorrido" />

  const documento: ContenidoRecorrido = { ...campos, paradas: sinClave(filas) }
  const sucio = JSON.stringify(documento) !== JSON.stringify(inicial)
  const planoSinAlt = campos.plano.url !== '' && campos.plano.alt.trim() === ''

  return (
    <>
      <Helmet><title>Recorrido | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {guardado && !sucio && <Alert severity="success" sx={{ mb: 3 }}>Recorrido guardado. La página ya lo enseña así.</Alert>}
      <PantallaEdicion
        titulo="Recorrido"
        nombre="Itinerario, plano y textos de la página del Recorrido del Sábado de Pasión"
        sucio={sucio}
        guardando={guardando}
        volverA="/cms"
        onGuardar={guardar}
      >
        <SeccionPlegable titulo="Cabecera" abiertaPorDefecto>
          <CampoTexto
            etiqueta="Título"
            valor={campos.titulo}
            onCambio={(titulo) => setCampos((actual) => actual && { ...actual, titulo })}
            ayuda="Encabezado grande de la página del Recorrido, arriba del todo."
            maxLength={120}
          />
          <CampoTexto
            etiqueta="Subtítulo"
            valor={campos.subtitulo}
            onCambio={(subtitulo) => setCampos((actual) => actual && { ...actual, subtitulo })}
            ayuda="Texto pequeño bajo el título, en la cabecera de la página."
            maxLength={600}
          />
          <CampoTexto
            etiqueta="Introducción"
            valor={campos.introduccion}
            onCambio={(introduccion) => setCampos((actual) => actual && { ...actual, introduccion })}
            ayuda="Párrafo introductorio, antes del plano y de la lista de paradas."
            maxLength={600}
            multilinea
          />
          <CampoTexto
            etiqueta="Título del itinerario"
            valor={campos.tituloItinerario}
            onCambio={(tituloItinerario) => setCampos((actual) => actual && { ...actual, tituloItinerario })}
            ayuda="Encabezado que va justo encima de la lista de paradas."
            maxLength={120}
          />
        </SeccionPlegable>

        <SeccionPlegable titulo="Plano">
          <CampoImagen
            etiqueta="Plano del recorrido"
            ayuda={AYUDA_PLANO}
            apaisada
            valor={campos.plano.url}
            onCambio={(url) => setCampos((actual) => actual && { ...actual, plano: { ...actual.plano, url } })}
          />
          <CampoTexto
            etiqueta="Qué se ve en la imagen"
            valor={campos.plano.alt}
            onCambio={(alt) => setCampos((actual) => actual && { ...actual, plano: { ...actual.plano, alt } })}
            ayuda={AYUDA_PLANO_ALT}
            maxLength={200}
          />
          {planoSinAlt && <Alert severity="warning">{AVISO_PLANO_SIN_ALT}</Alert>}
        </SeccionPlegable>

        <SeccionPlegable titulo="Paradas" abiertaPorDefecto>
          <Stack component="ol" spacing={2} sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {filas.map((fila, indice) => (
              <Paper key={fila.clave} component="li" variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
                  <TextField
                    label={`Hora de la parada ${indice + 1}`}
                    type="time"
                    value={fila.hora}
                    onChange={(e) => cambiarParada(fila.clave, { hora: e.target.value })}
                    size="small"
                    sx={{ width: { xs: '100%', sm: 160 } }}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    label={`Lugar de la parada ${indice + 1}`}
                    value={fila.lugar}
                    onChange={(e) => cambiarParada(fila.clave, { lugar: e.target.value })}
                    slotProps={{ htmlInput: { maxLength: 200 } }}
                    size="small"
                    fullWidth
                  />
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Subir">
                      <span>
                        <IconButton aria-label={`Subir la parada ${indice + 1}`} disabled={indice === 0} onClick={() => moverParada(indice, -1)}>
                          <ArrowUpwardIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Bajar">
                      <span>
                        <IconButton aria-label={`Bajar la parada ${indice + 1}`} disabled={indice === filas.length - 1} onClick={() => moverParada(indice, 1)}>
                          <ArrowDownwardIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Quitar">
                      <span>
                        <IconButton aria-label={`Quitar la parada ${indice + 1}`} onClick={() => quitarParada(fila.clave)}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>

          <Box sx={{ mt: filas.length ? 2 : 0 }}>
            <Button startIcon={<AddIcon />} onClick={anadirParada}>Añadir parada</Button>
          </Box>
        </SeccionPlegable>
      </PantallaEdicion>
    </>
  )
}
