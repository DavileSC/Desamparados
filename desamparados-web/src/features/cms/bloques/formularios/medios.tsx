/**
 * Los bloques con fotos o vídeos: la foto suelta y la galería, con su
 * reordenación y su subida en tandas.
 */
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined'
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined'
import topes from '../../../../../../shared/topes-contenido.json'
import CampoImagen from '../../CampoImagen'
import CampoTexto from '../../contenido/CampoTexto'
import CamposDeMedio from '../../contenido/CamposDeMedio'
import SubidaDeFotos from '../../contenido/SubidaDeFotos'
import { FOTO_NUEVA, VIDEO_NUEVO } from '../../contenido/medios'
import { intercambiar, siguienteClave, type Props } from './comunes'
import type { BloqueFoto, BloqueGaleria, MedioGaleria } from '../../../../lib/api/contenido'

export function FormularioFoto({ bloque, onCambio }: Props<BloqueFoto>) {
  return (
    <Stack spacing={2}>
      <CampoImagen
        valor={bloque.url}
        onCambio={(url) => onCambio({ url })}
        etiqueta="Foto"
        ayuda="JPG, PNG o WebP apaisado, de hasta 5 MB."
        apaisada
      />
      <CampoTexto
        etiqueta="Descripción"
        valor={bloque.alt}
        onCambio={(alt) => onCambio({ alt })}
        ayuda="Lo que se ve, en una frase. Es lo que oye quien usa un lector de pantalla."
        maxLength={topes.descripcion}
      />
      <CampoTexto
        etiqueta="Pie (opcional)"
        valor={bloque.pie}
        onCambio={(pie) => onCambio({ pie })}
        ayuda="Frase corta bajo la foto. Se puede dejar vacía."
        maxLength={topes.etiqueta}
      />
    </Stack>
  )
}

export function FormularioGaleria({ bloque, onCambio }: Props<BloqueGaleria>) {
  const [claves, setClaves] = useState<number[]>(() => bloque.medios.map(siguienteClave))

  const anadir = (medio: MedioGaleria) => {
    setClaves((actuales) => [...actuales, siguienteClave()])
    onCambio({ medios: [...bloque.medios, { ...medio }] })
  }

  // Las fotos terminan de subir segundos después de elegirlas, y mientras tanto
  // se puede seguir escribiendo: se añaden sobre la galería de ESE momento, no
  // sobre la de cuando se eligieron, o se perdería lo escrito entretanto.
  // El ref se pone al día en un efecto, después de pintar, y no durante el
  // render: escribirlo mientras se pinta es lo que React desaconseja, porque
  // un render que se descarte dejaría el ref apuntando a algo que nunca llegó
  // a verse. Sin lista de dependencias corre en cada vuelta, así que para
  // cuando termina una subida ya tiene lo último.
  const alDia = useRef({ bloque, onCambio })
  useEffect(() => { alDia.current = { bloque, onCambio } })

  // También los cambios de un medio: un vídeo tarda en subir, y al terminar se
  // aplica sobre la galería de ese momento, con lo escrito mientras tanto.
  const cambiar = (indice: number, cambios: Partial<MedioGaleria>) => {
    const { bloque: actual, onCambio: cambiarActual } = alDia.current
    cambiarActual({ medios: actual.medios.map((m, i) => (i === indice ? { ...m, ...cambios } : m)) })
  }
  const anadirSubidas = (rutas: string[]) => {
    const { bloque: actual, onCambio: cambiarActual } = alDia.current
    setClaves((actuales) => [...actuales, ...rutas.map(() => siguienteClave())])
    cambiarActual({ medios: [...actual.medios, ...rutas.map((url) => ({ ...FOTO_NUEVA, url }))] })
  }

  const quitar = (indice: number) => {
    setClaves((actuales) => actuales.filter((_, i) => i !== indice))
    onCambio({ medios: bloque.medios.filter((_, i) => i !== indice) })
  }

  const mover = (indice: number, salto: -1 | 1) => {
    const destino = indice + salto
    if (destino < 0 || destino >= bloque.medios.length) return
    setClaves((actuales) => intercambiar(actuales, indice, destino))
    onCambio({ medios: intercambiar(bloque.medios, indice, destino) })
  }

  // El límite es el del esquema del servidor, que lee el mismo JSON.
  const cabenMas = bloque.medios.length < topes.mediosPorGaleria

  return (
    <Stack spacing={2}>
      {bloque.medios.length === 0 && (
        <Alert severity="info">
          Una galería vacía no se puede guardar. Añade una foto o un vídeo, o quita el bloque entero.
        </Alert>
      )}

      {bloque.medios.map((medio, indice) => (
        <Stack key={claves[indice] ?? indice} spacing={1.5}
          sx={{ p: { xs: 1.5, sm: 2 }, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Chip size="small" icon={medio.tipo === 'video' ? <MovieOutlinedIcon /> : <AddPhotoAlternateOutlinedIcon />}
              label={medio.tipo === 'video' ? 'Vídeo' : 'Foto'} />
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
              Posición {indice + 1} de {bloque.medios.length}
            </Typography>
            <Tooltip title="Subir"><span>
              <IconButton size="small" aria-label={`Subir el medio ${indice + 1}`}
                disabled={indice === 0} onClick={() => mover(indice, -1)}>
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
            </span></Tooltip>
            <Tooltip title="Bajar"><span>
              <IconButton size="small" aria-label={`Bajar el medio ${indice + 1}`}
                disabled={indice === bloque.medios.length - 1} onClick={() => mover(indice, 1)}>
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
            </span></Tooltip>
            <Tooltip title="Quitar">
              <IconButton size="small" color="error" aria-label={`Quitar el medio ${indice + 1}`}
                onClick={() => quitar(indice)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <CamposDeMedio
            medio={medio}
            onCambio={(cambios) => cambiar(indice, cambios)}
            etiquetaDireccion={`Dirección del vídeo ${indice + 1}`}
          />
        </Stack>
      ))}

      {/* Las fotos se suben de una en una o muchas a la vez; los vídeos se
          añaden aparte, y dentro se elige si son de YouTube o un clip subido. */}
      <SubidaDeFotos
        hueco={topes.mediosPorGaleria - bloque.medios.length}
        onSubidas={anadirSubidas}
        otrasAcciones={(
          <Button startIcon={<MovieOutlinedIcon />} onClick={() => anadir(VIDEO_NUEVO)} disabled={!cabenMas}>
            Añadir vídeo
          </Button>
        )}
      />
      {!cabenMas && (
        <Typography variant="caption" color="text.secondary">
          Son ya {topes.mediosPorGaleria} medios, el máximo de una galería.
        </Typography>
      )}
    </Stack>
  )
}
