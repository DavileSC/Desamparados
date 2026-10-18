/**
 * La cronología de la historia: un hito por periodo, con su relato, su foto y
 * el tono con el que se pinta.
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
import type { BloqueCronologia, HitoHistoria, TonoHito } from '../../../../lib/api/contenido'

const TONOS: { valor: TonoHito; nombre: string }[] = [
  { valor: 'ninguno', nombre: 'Ninguno' },
  { valor: 'granate', nombre: 'Granate: un momento señalado' },
  { valor: 'oro', nombre: 'Dorado: el momento actual' },
]

/** Un hito recién añadido, en blanco y sin color. */
const HITO_NUEVO: HitoHistoria = { periodo: '', etiqueta: '', titulo: '', relato: '', foto: { url: '', alt: '', pie: '' }, tono: 'ninguno' }

/**
 * Los hitos de una cronología: lo que antes era la pantalla «Historia» del
 * grupo «Contenido», ahora como formulario de bloque.
 *
 * Las filas llevan clave estable por lo mismo que las de la galería: cada una
 * tiene un `CampoImagen`, que guarda estado mientras sube, y al reordenar la
 * foto en vuelo acabaría en el hito que hubiera pasado a ocupar esa posición.
 */
export function FormularioCronologia({ bloque, onCambio }: Props<BloqueCronologia>) {
  const [claves, setClaves] = useState<number[]>(() => bloque.hitos.map(siguienteClave))

  const cambiar = (indice: number, cambios: Partial<HitoHistoria>) =>
    onCambio({ hitos: bloque.hitos.map((h, i) => (i === indice ? { ...h, ...cambios } : h)) })
  const cambiarFoto = (indice: number, cambios: Partial<HitoHistoria['foto']>) =>
    cambiar(indice, { foto: { ...bloque.hitos[indice].foto, ...cambios } })

  const anadir = () => {
    setClaves((actuales) => [...actuales, siguienteClave()])
    onCambio({ hitos: [...bloque.hitos, structuredClone(HITO_NUEVO)] })
  }
  const quitar = (indice: number) => {
    setClaves((actuales) => actuales.filter((_, i) => i !== indice))
    onCambio({ hitos: bloque.hitos.filter((_, i) => i !== indice) })
  }
  const mover = (indice: number, salto: -1 | 1) => {
    const destino = indice + salto
    if (destino < 0 || destino >= bloque.hitos.length) return
    setClaves((actuales) => intercambiar(actuales, indice, destino))
    onCambio({ hitos: intercambiar(bloque.hitos, indice, destino) })
  }

  // Los dos límites son los del esquema del servidor, que lee el mismo JSON.
  const sobranParaQuitar = bloque.hitos.length > 1
  const cabenMas = bloque.hitos.length < topes.hitosPorCronologia

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Cada hito es un momento, en el orden en que se leen. En la página de Historia, el índice
        de la cabecera se hace solo con el periodo y la etiqueta de los hitos de la primera cronología.
      </Typography>

      {bloque.hitos.map((hito, indice) => {
        const n = indice + 1
        return (
          <Stack key={claves[indice] ?? indice} spacing={2} sx={{ p: { xs: 1.5, sm: 2 }, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>Hito {n}</Typography>
              <Tooltip title="Subir"><span>
                <IconButton size="small" aria-label={`Subir el hito ${n}`}
                  disabled={indice === 0} onClick={() => mover(indice, -1)}>
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
              <Tooltip title="Bajar"><span>
                <IconButton size="small" aria-label={`Bajar el hito ${n}`}
                  disabled={indice === bloque.hitos.length - 1} onClick={() => mover(indice, 1)}>
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
              <Tooltip title={sobranParaQuitar ? 'Quitar' : 'La cronología necesita al menos un hito'}><span>
                <IconButton size="small" color="error" aria-label={`Quitar el hito ${n}`}
                  disabled={!sobranParaQuitar} onClick={() => quitar(indice)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
            </Stack>

            {/* Los tres campos cortos en una fila: con la columna de edición
                ancha caben, y el relato queda solo con todo el ancho. */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'flex-start' } }}>
              <TextField
                label={`Periodo del hito ${n}`}
                value={hito.periodo}
                onChange={(e) => cambiar(indice, { periodo: e.target.value })}
                helperText="En grande, en serif: «Años 50», «1954» o «Hoy»."
                slotProps={{ htmlInput: { maxLength: topes.etiqueta } }}
                size="small"
                sx={{ width: { xs: '100%', md: 220 }, flexShrink: 0 }}
              />
              <TextField
                label={`Etiqueta del hito ${n}`}
                value={hito.etiqueta}
                onChange={(e) => cambiar(indice, { etiqueta: e.target.value })}
                helperText="Bajo el periodo y en el índice de la cabecera."
                slotProps={{ htmlInput: { maxLength: topes.etiqueta } }}
                size="small"
                fullWidth
              />
              <TextField
                select
                label={`Color del hito ${n}`}
                value={hito.tono}
                onChange={(e) => cambiar(indice, { tono: e.target.value as TonoHito })}
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
              value={hito.titulo}
              onChange={(e) => cambiar(indice, { titulo: e.target.value })}
              helperText="Encabezado del hito, junto a su texto."
              slotProps={{ htmlInput: { maxLength: topes.titulo } }}
              size="small"
              fullWidth
            />
            <TextField
              label={`Relato del hito ${n}`}
              value={hito.relato}
              onChange={(e) => cambiar(indice, { relato: e.target.value })}
              helperText="El texto del hito. Una línea en blanco separa un párrafo del siguiente."
              slotProps={{ htmlInput: { maxLength: topes.relato } }}
              multiline
              minRows={4}
              size="small"
              fullWidth
            />
            <CampoImagen
              etiqueta={`Foto del hito ${n}`}
              ayuda="JPG, PNG o WebP apaisado, de hasta 5 MB. Sale dentro del hito, debajo de su texto."
              apaisada
              valor={hito.foto.url}
              onCambio={(url) => cambiarFoto(indice, { url })}
            />
            {hito.foto.url !== '' && (
              <>
                <TextField
                  label={`Qué se ve en la foto del hito ${n}`}
                  value={hito.foto.alt}
                  onChange={(e) => cambiarFoto(indice, { alt: e.target.value })}
                  helperText="La foto, en una frase. Es lo que oye quien usa un lector de pantalla."
                  slotProps={{ htmlInput: { maxLength: topes.descripcion } }}
                  size="small"
                  fullWidth
                />
                <TextField
                  label={`Pie de la foto del hito ${n}`}
                  value={hito.foto.pie}
                  onChange={(e) => cambiarFoto(indice, { pie: e.target.value })}
                  helperText="Línea pequeña bajo la foto. Puede quedar vacía."
                  slotProps={{ htmlInput: { maxLength: topes.etiqueta } }}
                  size="small"
                  fullWidth
                />
              </>
            )}
          </Stack>
        )
      })}

      <Button startIcon={<AddIcon />} onClick={anadir} disabled={!cabenMas} sx={{ alignSelf: 'flex-start' }}>
        Añadir hito
      </Button>
      {!cabenMas && (
        <Typography variant="caption" color="text.secondary">
          Son ya {topes.hitosPorCronologia} hitos, el máximo de una cronología.
        </Typography>
      )}
    </Stack>
  )
}
