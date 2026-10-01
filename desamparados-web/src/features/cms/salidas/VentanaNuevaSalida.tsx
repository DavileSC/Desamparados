import { useState } from 'react'
import { FormControlLabel, Radio, RadioGroup, Stack, TextField, Typography } from '@mui/material'
import VentanaFormulario from '../VentanaFormulario'
import { crearSalida, type Salida } from '../../../lib/api/salidas'
import { slugDe } from './slug'

interface Props {
  abierta: boolean
  /** Para proponer el orden: la nueva va detrás de las que ya hay. */
  salidas: Salida[]
  onCreada: (salida: Salida) => void
  onCerrar: () => void
}

interface Form {
  nombre: string
  slug: string
  /** Deja de proponerse sola en cuanto se toca a mano. */
  slugTocado: boolean
  fecha: 'PASCUA' | 'MANUAL'
  diasDesdePascua: string
  cobro: 'CUOTA' | 'DONATIVO'
  primerPuesto: string
}

const VACIO: Form = { nombre: '', slug: '', slugTocado: false, fecha: 'PASCUA', diasDesdePascua: '', cobro: 'CUOTA', primerPuesto: '' }

/**
 * Alta de una salida: solo lo imprescindible para crearla (nombre, slug,
 * cuándo es, cómo se cobra y un primer puesto). El resto —ropa, más puestos,
 * indicaciones— se rellena ya en su pantalla propia, a la que se navega en
 * cuanto se crea. El primer puesto se pide aquí porque una salida sin puestos
 * no tendría nada que elegir al pedir la papeleta, y la API no la admite.
 */
export default function VentanaNuevaSalida({ abierta, salidas, onCreada, onCerrar }: Props) {
  const [form, setForm] = useState<Form>(VACIO)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cambiarNombre = (nombre: string) =>
    setForm((f) => ({ ...f, nombre, slug: f.slugTocado ? f.slug : slugDe(nombre) }))

  const cambiarSlug = (valor: string) =>
    // Lo que admite la API: minúsculas, números y guiones. Se deja escribir
    // libre y solo se cierra del todo (sin guiones sueltos) al guardar.
    setForm((f) => ({ ...f, slug: valor.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''), slugTocado: true }))

  const diasValidos = form.fecha === 'MANUAL' || /^-?\d+$/.test(form.diasDesdePascua.trim())
  const valido = form.nombre.trim() !== '' && form.slug.trim() !== '' && form.primerPuesto.trim() !== '' && diasValidos

  const cerrar = () => { onCerrar(); setForm(VACIO); setError(null) }

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      const salida = await crearSalida({
        nombre: form.nombre.trim(),
        slug: slugDe(form.slug),
        orden: salidas.length,
        activa: true,
        conRopa: false,
        cobro: form.cobro,
        importeCuota: 0,
        fecha: form.fecha,
        diasDesdePascua: form.fecha === 'PASCUA' ? Number(form.diasDesdePascua.trim()) : null,
        horaSalida: null,
        lugar: null,
        // Sin ropa de entrada, como la salida: la ropa de cada puesto se dice en su pantalla.
        puestos: [{ nombre: form.primerPuesto.trim(), tunica: false, tocado: null, alturaHombro: false }],
        indicaciones: null,
      })
      setForm(VACIO)
      onCreada(salida)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido crear la salida.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <VentanaFormulario
      abierto={abierta}
      titulo="Nueva salida"
      textoGuardar="Crear"
      sucio={form.nombre.trim() !== ''}
      guardando={guardando}
      puedeGuardar={valido}
      error={error}
      onGuardar={guardar}
      onCerrar={cerrar}
    >
      <TextField label="Nombre" value={form.nombre} onChange={(e) => cambiarNombre(e.target.value)} autoFocus fullWidth />
      <TextField
        label="Slug"
        value={form.slug}
        onChange={(e) => cambiarSlug(e.target.value)}
        helperText="La dirección corta con la que la API identifica la salida."
        fullWidth
      />
      <Stack spacing={0.5}>
        <Typography variant="subtitle2">Fecha</Typography>
        <RadioGroup row value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value as Form['fecha'] }))}>
          <FormControlLabel value="PASCUA" control={<Radio />} label="Por la Pascua" />
          <FormControlLabel value="MANUAL" control={<Radio />} label="A mano" />
        </RadioGroup>
        {form.fecha === 'PASCUA' && (
          <TextField
            label="Días desde el Domingo de Resurrección"
            type="number"
            value={form.diasDesdePascua}
            onChange={(e) => setForm((f) => ({ ...f, diasDesdePascua: e.target.value }))}
            helperText="−8 es el Sábado de Pasión."
            slotProps={{ htmlInput: { step: 1 } }}
            fullWidth
          />
        )}
      </Stack>
      <Stack spacing={0.5}>
        <Typography variant="subtitle2">Cobro</Typography>
        <RadioGroup row value={form.cobro} onChange={(e) => setForm((f) => ({ ...f, cobro: e.target.value as Form['cobro'] }))}>
          <FormControlLabel value="CUOTA" control={<Radio />} label="Cuota" />
          <FormControlLabel value="DONATIVO" control={<Radio />} label="Donativo" />
        </RadioGroup>
      </Stack>
      <TextField
        label="Primer puesto"
        value={form.primerPuesto}
        onChange={(e) => setForm((f) => ({ ...f, primerPuesto: e.target.value }))}
        helperText="Luego puedes añadir más y decir qué ropa lleva cada uno."
        required
        fullWidth
      />
    </VentanaFormulario>
  )
}
