import { useState, type ChangeEvent, type DragEvent } from 'react'
import { Alert, Box, Button, LinearProgress, Stack, Typography } from '@mui/material'
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined'
import { TIPOS_FOTO, subirFotos, type ResultadoSubida } from './subidaFotos'

// El input queda oculto a la vista pero no a la accesibilidad: lo activa su etiqueta, que es el botón.
const inputOculto = {
  position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
} as const

interface Props {
  /** Cuántas fotos caben todavía en la galería. */
  hueco: number
  /** Las rutas de las que han subido, en el orden en que se eligieron. */
  onSubidas: (rutas: string[]) => void
  /** Otros botones del mismo sitio («Añadir vídeo»), a la derecha del de subir. */
  otrasAcciones?: React.ReactNode
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/**
 * Subir varias fotos de una vez a una galería: con el selector (se pueden
 * marcar muchas) o arrastrándolas encima. Antes había que añadir una foto,
 * abrirla, subirla, y repetir por cada una.
 *
 * Cada foto sale sin descripción, y la galería no se guarda hasta que la
 * tengan todas: se dice al terminar, para que no sea una sorpresa al guardar.
 */
export default function SubidaDeFotos({ hueco, onSubidas, otrasAcciones }: Props) {
  const [progreso, setProgreso] = useState<{ hechas: number; total: number } | null>(null)
  const [resultado, setResultado] = useState<ResultadoSubida | null>(null)
  const [encima, setEncima] = useState(false)
  const subiendo = progreso !== null
  const lleno = hueco <= 0

  const subir = async (archivos: File[]) => {
    if (archivos.length === 0 || subiendo || lleno) return
    setResultado(null)
    const final = await subirFotos(archivos, hueco, (hechas, total) => setProgreso({ hechas, total }))
    setProgreso(null)
    setResultado(final)
    if (final.rutas.length > 0) onSubidas(final.rutas)
  }

  const elegir = (evento: ChangeEvent<HTMLInputElement>) => {
    const archivos = Array.from(evento.target.files ?? [])
    // Se vacía para poder volver a elegir las mismas después de un error.
    evento.target.value = ''
    void subir(archivos)
  }

  const soltar = (evento: DragEvent) => {
    evento.preventDefault()
    setEncima(false)
    void subir(Array.from(evento.dataTransfer.files))
  }

  return (
    <Stack spacing={1.5}>
      <Box
        onDragOver={(e) => { e.preventDefault(); if (!subiendo && !lleno) setEncima(true) }}
        onDragLeave={() => setEncima(false)}
        onDrop={soltar}
        sx={{
          p: 2, borderRadius: 1, border: '1px dashed', borderColor: encima ? 'primary.main' : 'divider',
          bgcolor: encima ? 'action.hover' : 'transparent', transition: 'background-color 120ms, border-color 120ms',
        }}
      >
        {/* `useFlexGap`: con el `spacing` de siempre, el botón que baja de línea
            arrastra el margen izquierdo y queda descolocado. */}
        <Stack direction="row" useFlexGap spacing={1.5} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateOutlinedIcon />} disabled={subiendo || lleno}>
            Subir fotos
            <Box component="input" type="file" multiple accept={TIPOS_FOTO.join(',')} onChange={elegir} sx={inputOculto} />
          </Button>
          {otrasAcciones}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
          {lleno ? 'La galería está llena.' : 'Puedes elegir varias fotos a la vez, o arrastrarlas aquí. JPG, PNG o WebP de hasta 5 MB cada una.'}
        </Typography>
        {subiendo && (
          <Box sx={{ mt: 1.5 }} aria-live="polite">
            <Typography variant="body2" sx={{ mb: 0.75 }}>Subiendo {progreso.hechas} de {progreso.total}…</Typography>
            <LinearProgress variant="determinate" value={progreso.total ? (progreso.hechas / progreso.total) * 100 : 0} />
          </Box>
        )}
      </Box>

      {resultado && resultado.rutas.length > 0 && (
        <Alert severity="info" onClose={() => setResultado({ ...resultado, rutas: [] })}>
          {plural(resultado.rutas.length, 'foto añadida', 'fotos añadidas')} al final de la galería. Escribe la descripción de
          cada una: sin ella no se puede guardar.
        </Alert>
      )}
      {resultado && (resultado.fallos.length > 0 || resultado.sobrantes > 0) && (
        <Alert severity="warning" onClose={() => setResultado({ ...resultado, fallos: [], sobrantes: 0 })}>
          {resultado.fallos.length > 0 && (
            <>
              {resultado.fallos.length === 1 ? 'Esta no se ha subido:' : `Estas ${resultado.fallos.length} no se han subido:`}
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {resultado.fallos.map((f) => <li key={f.nombre}>{f.nombre}: {f.motivo}.</li>)}
              </Box>
            </>
          )}
          {resultado.sobrantes > 0 && (
            <Box component="span" sx={{ display: 'block', mt: resultado.fallos.length > 0 ? 1 : 0 }}>
              {plural(resultado.sobrantes, 'foto no ha cabido', 'fotos no han cabido')}: la galería ya tiene el máximo.
            </Box>
          )}
        </Alert>
      )}
    </Stack>
  )
}
