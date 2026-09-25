/**
 * Foto fija y texto que pasa: unas partes de texto, cada una con la foto que
 * se ve mientras se lee.
 */
import { useState } from 'react'
import { Button, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import topes from '../../../../../../shared/topes-contenido.json'
import CampoImagen from '../../CampoImagen'
import { intercambiar, siguienteClave, type Props } from './comunes'
import type { BloqueFotoFija, PasoFotoFija } from '../../../../lib/api/contenido'

const PASO_NUEVO: PasoFotoFija = { titulo: '', texto: '', foto: { url: '', alt: '', pie: '' } }

/**
 * Las filas llevan clave estable por lo mismo que las de la cronología: cada
 * una tiene un `CampoImagen`, que guarda estado mientras sube, y al reordenar
 * la foto en vuelo acabaría en la parte que hubiera pasado a ocupar esa posición.
 */
export function FormularioFotoFija({ bloque, onCambio }: Props<BloqueFotoFija>) {
  const [claves, setClaves] = useState<number[]>(() => bloque.pasos.map(siguienteClave))

  const cambiar = (indice: number, cambios: Partial<PasoFotoFija>) =>
    onCambio({ pasos: bloque.pasos.map((p, i) => (i === indice ? { ...p, ...cambios } : p)) })
  const cambiarFoto = (indice: number, cambios: Partial<PasoFotoFija['foto']>) =>
    cambiar(indice, { foto: { ...bloque.pasos[indice].foto, ...cambios } })

  const anadir = () => {
    setClaves((actuales) => [...actuales, siguienteClave()])
    onCambio({ pasos: [...bloque.pasos, structuredClone(PASO_NUEVO)] })
  }
  const quitar = (indice: number) => {
    setClaves((actuales) => actuales.filter((_, i) => i !== indice))
    onCambio({ pasos: bloque.pasos.filter((_, i) => i !== indice) })
  }
  const mover = (indice: number, salto: -1 | 1) => {
    const destino = indice + salto
    if (destino < 0 || destino >= bloque.pasos.length) return
    setClaves((actuales) => intercambiar(actuales, indice, destino))
    onCambio({ pasos: intercambiar(bloque.pasos, indice, destino) })
  }

  // Los dos límites son los del esquema del servidor, que lee el mismo JSON.
  const sobranParaQuitar = bloque.pasos.length > 1
  const cabenMas = bloque.pasos.length < topes.pasosPorBloque

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Cada parte es un trozo de texto con su foto. Al leer, la foto se queda quieta a un lado
        y cambia a la de la parte que se está leyendo: una pieza, un detalle, un momento.
      </Typography>

      {bloque.pasos.map((paso, indice) => {
        const n = indice + 1
        return (
          <Stack key={claves[indice] ?? indice} spacing={2} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>Parte {n}</Typography>
              <Tooltip title="Subir"><span>
                <IconButton size="small" aria-label={`Subir la parte ${n}`} disabled={indice === 0} onClick={() => mover(indice, -1)}>
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
              <Tooltip title="Bajar"><span>
                <IconButton size="small" aria-label={`Bajar la parte ${n}`} disabled={indice === bloque.pasos.length - 1} onClick={() => mover(indice, 1)}>
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
              <Tooltip title={sobranParaQuitar ? 'Quitar' : 'El bloque necesita al menos una parte'}><span>
                <IconButton size="small" color="error" aria-label={`Quitar la parte ${n}`} disabled={!sobranParaQuitar} onClick={() => quitar(indice)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
            </Stack>
            <TextField
              label={`Título de la parte ${n}`} value={paso.titulo}
              onChange={(e) => cambiar(indice, { titulo: e.target.value })}
              helperText="Puede quedar vacío."
              slotProps={{ htmlInput: { maxLength: topes.titulo } }}
              size="small" fullWidth
            />
            <TextField
              label={`Texto de la parte ${n}`} value={paso.texto}
              onChange={(e) => cambiar(indice, { texto: e.target.value })}
              helperText="Una línea en blanco separa un párrafo del siguiente."
              slotProps={{ htmlInput: { maxLength: topes.relato } }}
              multiline minRows={4} size="small" fullWidth
            />
            <CampoImagen
              etiqueta={`Foto de la parte ${n}`}
              ayuda="JPG, PNG o WebP de hasta 5 MB. Se recorta para llenar su hueco: mejor con el motivo en el centro."
              valor={paso.foto.url}
              onCambio={(url) => cambiarFoto(indice, { url })}
            />
            {paso.foto.url !== '' && (
              <>
                <TextField
                  label={`Qué se ve en la foto de la parte ${n}`} value={paso.foto.alt}
                  onChange={(e) => cambiarFoto(indice, { alt: e.target.value })}
                  helperText="La foto, en una frase. Es lo que oye quien usa un lector de pantalla."
                  slotProps={{ htmlInput: { maxLength: topes.descripcion } }}
                  size="small" fullWidth
                />
                <TextField
                  label={`Pie de la foto de la parte ${n}`} value={paso.foto.pie}
                  onChange={(e) => cambiarFoto(indice, { pie: e.target.value })}
                  helperText="Línea pequeña sobre la foto. Puede quedar vacía."
                  slotProps={{ htmlInput: { maxLength: topes.etiqueta } }}
                  size="small" fullWidth
                />
              </>
            )}
          </Stack>
        )
      })}

      <Button startIcon={<AddIcon />} onClick={anadir} disabled={!cabenMas} sx={{ alignSelf: 'flex-start' }}>
        Añadir parte
      </Button>
      {!cabenMas && (
        <Typography variant="caption" color="text.secondary">
          Son ya {topes.pasosPorBloque} partes, el máximo del bloque.
        </Typography>
      )}
    </Stack>
  )
}
