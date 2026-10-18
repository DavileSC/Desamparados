/**
 * El formulario del bloque de donativo: el texto de arriba, los importes que
 * se ofrecen y, si se quiere, los destinos entre los que elige el donante. El
 * formulario del donante y el pago son de código.
 */
import { useState } from 'react'
import { Button, IconButton, Stack, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import topes from '../../../../../../shared/topes-contenido.json'
import CampoTexto from '../../contenido/CampoTexto'
import type { Props } from './comunes'
import type { BloqueDonativo } from '../../../../lib/api/contenido'

/** «5, 10, 20» → [5, 10, 20]; null si algo no es un importe entero dentro de los límites o se repite. */
export function leerImportes(texto: string): number[] | null {
  const partes = texto.split(/[,;\s]+/).filter(Boolean)
  if (partes.length === 0 || partes.length > topes.importesPorDonativo) return null
  const importes = partes.map((p) => (/^\d+$/.test(p) ? Number(p) : NaN))
  if (importes.some((n) => !Number.isInteger(n) || n < topes.donativoMinimoEuros || n > topes.donativoMaximoEuros)) return null
  return new Set(importes).size === importes.length ? importes : null
}

export function FormularioDonativo({ bloque, onCambio }: Props<BloqueDonativo>) {
  // Lo escrito se guarda aparte: «5, 1» a medio teclear no es aún una lista válida.
  const [importes, setImportes] = useState(bloque.importes.join(', '))
  const leidos = leerImportes(importes)
  // Al deshacer, los importes cambian sin escribir aquí: si lo escrito ya no
  // dice lo mismo que lo guardado, manda lo guardado.
  const [vistos, setVistos] = useState(bloque.importes)
  if (vistos !== bloque.importes) {
    setVistos(bloque.importes)
    if (leidos?.join() !== bloque.importes.join()) setImportes(bloque.importes.join(', '))
  }

  const cambiarDestino = (i: number, valor: string) => onCambio({ destinos: bloque.destinos.map((d, j) => (j === i ? valor : d)) })

  return (
    <Stack spacing={2.5}>
      <Typography variant="body2" color="text.secondary">
        El donante elige el importe (o escribe otro) y paga en la página del banco, con tarjeta o Bizum,
        sin cuenta en la web. El donativo entra solo en la contabilidad. El nombre y el correo son
        opcionales: si deja el correo, le llegan las gracias.
      </Typography>
      <CampoTexto
        etiqueta="Texto"
        valor={bloque.texto}
        onCambio={(texto) => onCambio({ texto })}
        ayuda="Unas líneas sobre a qué se destina lo que se da. Se puede dejar vacío."
        maxLength={topes.parrafo}
        multilinea
      />
      <TextField
        label="Importes sugeridos (€)"
        value={importes}
        onChange={(e) => {
          setImportes(e.target.value)
          const lista = leerImportes(e.target.value)
          if (lista) onCambio({ importes: lista })
        }}
        error={leidos === null}
        helperText={leidos === null
          ? `Escribe de 1 a ${topes.importesPorDonativo} importes en euros enteros, entre ${topes.donativoMinimoEuros} y ${topes.donativoMaximoEuros}, separados por comas y sin repetir.`
          : 'Separados por comas, como «5, 10, 20, 50». El segundo sale marcado. Siempre se puede escribir otro.'}
        size="small"
        fullWidth
      />
      <Stack spacing={1.25}>
        <Typography variant="subtitle2">Destinos</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: '0 !important' }}>
          Si hay destinos, el donante elige uno («Caridad», «Cultos»…) y sale en la contabilidad. Sin
          destinos, no se le pregunta.
        </Typography>
        {bloque.destinos.map((d, i) => (
          <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <TextField
              label={`Destino ${i + 1}`} value={d} onChange={(e) => cambiarDestino(i, e.target.value)} size="small" fullWidth
              error={d.trim() === ''} slotProps={{ htmlInput: { maxLength: topes.etiqueta } }}
            />
            <IconButton aria-label={`Quitar el destino ${i + 1}`} onClick={() => onCambio({ destinos: bloque.destinos.filter((_, j) => j !== i) })}>
              <DeleteOutlineIcon />
            </IconButton>
          </Stack>
        ))}
        {bloque.destinos.length < topes.destinosPorDonativo && (
          <Button startIcon={<AddIcon />} onClick={() => onCambio({ destinos: [...bloque.destinos, ''] })} sx={{ alignSelf: 'flex-start' }}>
            Añadir destino
          </Button>
        )}
      </Stack>
    </Stack>
  )
}
