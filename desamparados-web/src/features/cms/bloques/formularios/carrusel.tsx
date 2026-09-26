/**
 * Carrusel de piezas: cada pieza con su foto, su familia, su nombre, su
 * historia y los datos de su cartela.
 */
import { useState } from 'react'
import { Button, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import CloseIcon from '@mui/icons-material/Close'
import topes from '../../../../../../shared/topes-contenido.json'
import CampoImagen from '../../CampoImagen'
import { intercambiar, siguienteClave, type Props } from './comunes'
import type { BloqueCarrusel, DatoDePieza, PiezaDeCarrusel } from '../../../../lib/api/contenido'

const PIEZA_NUEVA: PiezaDeCarrusel = { familia: '', titulo: '', texto: '', foto: { url: '', alt: '', pie: '' }, datos: [] }

/**
 * Las piezas llevan clave estable por lo mismo que las partes de la foto fija:
 * cada una tiene un `CampoImagen`, que guarda estado mientras sube, y al
 * reordenar la foto en vuelo acabaría en la pieza que hubiera pasado a ocupar
 * esa posición.
 */
export function FormularioCarrusel({ bloque, onCambio }: Props<BloqueCarrusel>) {
  const [claves, setClaves] = useState<number[]>(() => bloque.piezas.map(siguienteClave))

  const cambiar = (indice: number, cambios: Partial<PiezaDeCarrusel>) =>
    onCambio({ piezas: bloque.piezas.map((p, i) => (i === indice ? { ...p, ...cambios } : p)) })
  const cambiarFoto = (indice: number, cambios: Partial<PiezaDeCarrusel['foto']>) =>
    cambiar(indice, { foto: { ...bloque.piezas[indice].foto, ...cambios } })
  const cambiarDato = (indice: number, d: number, cambios: Partial<DatoDePieza>) =>
    cambiar(indice, { datos: bloque.piezas[indice].datos.map((dato, j) => (j === d ? { ...dato, ...cambios } : dato)) })

  const anadir = () => {
    setClaves((actuales) => [...actuales, siguienteClave()])
    onCambio({ piezas: [...bloque.piezas, structuredClone(PIEZA_NUEVA)] })
  }
  const quitar = (indice: number) => {
    setClaves((actuales) => actuales.filter((_, i) => i !== indice))
    onCambio({ piezas: bloque.piezas.filter((_, i) => i !== indice) })
  }
  const mover = (indice: number, salto: -1 | 1) => {
    const destino = indice + salto
    if (destino < 0 || destino >= bloque.piezas.length) return
    setClaves((actuales) => intercambiar(actuales, indice, destino))
    onCambio({ piezas: intercambiar(bloque.piezas, indice, destino) })
  }

  // Los límites son los del esquema del servidor, que lee el mismo JSON.
  const sobranParaQuitar = bloque.piezas.length > 1
  const cabenMas = bloque.piezas.length < topes.piezasPorCarrusel

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Se ve una pieza cada vez: la foto grande y, al lado, su nombre, su historia y su cartela.
        Se pasa con dos flechas. Van en el orden de esta lista.
      </Typography>

      {bloque.piezas.map((pieza, indice) => {
        const n = indice + 1
        return (
          <Stack key={claves[indice] ?? indice} spacing={2} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>{pieza.titulo.trim() || `Pieza ${n}`}</Typography>
              <Tooltip title="Subir"><span>
                <IconButton size="small" aria-label={`Subir la pieza ${n}`} disabled={indice === 0} onClick={() => mover(indice, -1)}>
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
              <Tooltip title="Bajar"><span>
                <IconButton size="small" aria-label={`Bajar la pieza ${n}`} disabled={indice === bloque.piezas.length - 1} onClick={() => mover(indice, 1)}>
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
              <Tooltip title={sobranParaQuitar ? 'Quitar' : 'El carrusel necesita al menos una pieza'}><span>
                <IconButton size="small" color="error" aria-label={`Quitar la pieza ${n}`} disabled={!sobranParaQuitar} onClick={() => quitar(indice)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
            </Stack>
            <CampoImagen
              etiqueta={`Foto de la pieza ${n}`}
              ayuda="JPG, PNG o WebP de hasta 5 MB. Se recorta para llenar su hueco: mejor con la pieza en el centro y sobre fondo liso."
              valor={pieza.foto.url}
              onCambio={(url) => cambiarFoto(indice, { url })}
            />
            {pieza.foto.url !== '' && (
              <>
                <TextField
                  label={`Qué se ve en la foto de la pieza ${n}`} value={pieza.foto.alt}
                  onChange={(e) => cambiarFoto(indice, { alt: e.target.value })}
                  helperText="La foto, en una frase. Es lo que oye quien usa un lector de pantalla."
                  slotProps={{ htmlInput: { maxLength: topes.descripcion } }}
                  size="small" fullWidth
                />
                <TextField
                  label={`Pie de la foto de la pieza ${n}`} value={pieza.foto.pie}
                  onChange={(e) => cambiarFoto(indice, { pie: e.target.value })}
                  helperText="Línea pequeña sobre la foto, para el autor de la foto. Puede quedar vacía."
                  slotProps={{ htmlInput: { maxLength: topes.etiqueta } }}
                  size="small" fullWidth
                />
              </>
            )}
            <TextField
              label="Familia" value={pieza.familia}
              onChange={(e) => cambiar(indice, { familia: e.target.value })}
              helperText="Como «Insignias», «Orfebrería» o «Bordado». Sale en dorado sobre el nombre. Puede quedar vacía."
              slotProps={{ htmlInput: { maxLength: topes.etiqueta } }}
              size="small" fullWidth
            />
            <TextField
              label={`Nombre de la pieza ${n}`} value={pieza.titulo}
              onChange={(e) => cambiar(indice, { titulo: e.target.value })}
              slotProps={{ htmlInput: { maxLength: topes.titulo } }}
              size="small" fullWidth required
            />
            <TextField
              label="Su historia" value={pieza.texto}
              onChange={(e) => cambiar(indice, { texto: e.target.value })}
              helperText="Dos o tres líneas: qué es, de qué está hecha, qué tiene de particular."
              slotProps={{ htmlInput: { maxLength: topes.textoTarjeta } }}
              multiline minRows={3} size="small" fullWidth
            />

            <Typography variant="caption" color="text.secondary">
              Cartela: datos como «Autor», «Año» o «Materiales», con su valor.
            </Typography>
            {pieza.datos.map((dato, d) => (
              <Stack key={d} direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <TextField
                  label="Dato" value={dato.etiqueta}
                  onChange={(e) => cambiarDato(indice, d, { etiqueta: e.target.value })}
                  slotProps={{ htmlInput: { maxLength: topes.etiqueta } }}
                  size="small" sx={{ flex: 1 }}
                />
                <TextField
                  label="Valor" value={dato.valor}
                  onChange={(e) => cambiarDato(indice, d, { valor: e.target.value })}
                  slotProps={{ htmlInput: { maxLength: topes.titulo } }}
                  size="small" sx={{ flex: 2 }}
                />
                <Tooltip title="Quitar el dato">
                  <IconButton size="small" aria-label={`Quitar el dato ${d + 1} de la pieza ${n}`} sx={{ mt: 0.5 }}
                    onClick={() => cambiar(indice, { datos: pieza.datos.filter((_, j) => j !== d) })}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}
            {pieza.datos.length < topes.datosPorPieza && (
              <Button size="small" startIcon={<AddIcon />} sx={{ alignSelf: 'flex-start' }}
                onClick={() => cambiar(indice, { datos: [...pieza.datos, { etiqueta: '', valor: '' }] })}>
                Añadir dato
              </Button>
            )}
          </Stack>
        )
      })}

      <Button startIcon={<AddIcon />} onClick={anadir} disabled={!cabenMas} sx={{ alignSelf: 'flex-start' }}>
        Añadir pieza
      </Button>
      {!cabenMas && (
        <Typography variant="caption" color="text.secondary">
          Son ya {topes.piezasPorCarrusel} piezas, el máximo del carrusel.
        </Typography>
      )}
    </Stack>
  )
}
