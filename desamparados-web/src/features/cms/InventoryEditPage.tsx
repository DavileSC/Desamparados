import { useEffect, useState } from 'react'
import { Alert, CircularProgress, MenuItem, Select, Stack, TextField } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PantallaEdicion from './PantallaEdicion'
import { getEnser, getPrenda, updateEnser, updatePrenda } from '../../lib/api/inventory'

type FormEnser = { nombre: string; referencia: string; categoria: string; ubicacion: string; cantidadOptimo: string; cantidadBueno: string; cantidadReparar: string }
type FormPrenda = { numero: string; tipo: string; talla: string; estado: string; observaciones: string }

const tipos = ['TUNICA', 'CAPIROTE', 'FARAONA', 'CAPA', 'OTRO']
const estados = ['DISPONIBLE', 'PRESTADA', 'TALLER', 'BAJA']

/**
 * Enseres y ropero comparten pantalla porque comparten listado: el inventario
 * es una sola sección con dos pestañas. Cuál de las dos se edita viene en la
 * query (`?tipo=prenda`), que es lo que sabe el listado al pulsar Editar.
 */
export default function InventoryEditPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const esPrenda = params.get('tipo') === 'prenda'
  const navegar = useNavigate()
  const [nombre, setNombre] = useState('')
  const [form, setForm] = useState<FormEnser | FormPrenda | null>(null)
  const [inicial, setInicial] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const cargar = esPrenda
      ? getPrenda(Number(id)).then((p) => {
          setNombre(`Prenda ${p.numero}`)
          return { numero: p.numero, tipo: p.tipo, talla: p.talla ?? '', estado: p.estado, observaciones: p.observaciones ?? '' } as FormPrenda
        })
      : getEnser(Number(id)).then((e) => {
          setNombre(e.nombre)
          return {
            nombre: e.nombre, referencia: e.referencia ?? '', categoria: e.categoria ?? '', ubicacion: e.ubicacion ?? '',
            cantidadOptimo: String(e.cantidadOptimo), cantidadBueno: String(e.cantidadBueno), cantidadReparar: String(e.cantidadReparar),
          } as FormEnser
        })

    cargar
      .then((datos) => { setForm(datos); setInicial(JSON.stringify(datos)) })
      .catch(() => setError(esPrenda ? 'No se ha podido cargar la prenda.' : 'No se ha podido cargar el enser.'))
  }, [id, esPrenda])

  const campo = (clave: string, valor: string) => setForm((actual) => (actual ? { ...actual, [clave]: valor } : actual))

  const guardar = async () => {
    if (!form) return
    setGuardando(true)
    try {
      if (esPrenda) await updatePrenda(Number(id), form)
      else {
        const e = form as FormEnser
        await updateEnser(Number(id), {
          ...e,
          cantidadOptimo: Number(e.cantidadOptimo),
          cantidadBueno: Number(e.cantidadBueno),
          cantidadReparar: Number(e.cantidadReparar),
        })
      }
      navegar('/cms/inventario')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar el elemento.')
      setGuardando(false)
    }
  }

  if (error && !form) return <Alert severity="error">{error}</Alert>
  if (!form) return <CircularProgress aria-label="Cargando el elemento" />

  const prenda = form as FormPrenda
  const enser = form as FormEnser

  return (
    <>
      <Helmet><title>Editar inventario | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      <PantallaEdicion
        titulo={esPrenda ? 'Editar prenda' : 'Editar enser'}
        nombre={nombre}
        sucio={JSON.stringify(form) !== inicial}
        guardando={guardando}
        volverA="/cms/inventario"
        onGuardar={guardar}
      >
        {esPrenda ? (
          <Stack spacing={2}>
            <TextField label="Número" value={prenda.numero} onChange={(e) => campo('numero', e.target.value)} fullWidth />
            <Select value={prenda.tipo} onChange={(e) => campo('tipo', e.target.value)} aria-label="Tipo de prenda">
              {tipos.map((tipo) => <MenuItem key={tipo} value={tipo}>{tipo}</MenuItem>)}
            </Select>
            <TextField label="Talla" value={prenda.talla} onChange={(e) => campo('talla', e.target.value)} fullWidth />
            <Select value={prenda.estado} onChange={(e) => campo('estado', e.target.value)} aria-label="Estado">
              {estados.map((estado) => <MenuItem key={estado} value={estado}>{estado}</MenuItem>)}
            </Select>
            <TextField label="Observaciones" value={prenda.observaciones} onChange={(e) => campo('observaciones', e.target.value)} fullWidth multiline />
          </Stack>
        ) : (
          <Stack spacing={2}>
            <TextField label="Nombre" value={enser.nombre} onChange={(e) => campo('nombre', e.target.value)} fullWidth />
            <TextField label="Referencia" value={enser.referencia} onChange={(e) => campo('referencia', e.target.value)} fullWidth />
            <TextField label="Categoría" value={enser.categoria} onChange={(e) => campo('categoria', e.target.value)} fullWidth />
            <TextField label="Ubicación" value={enser.ubicacion} onChange={(e) => campo('ubicacion', e.target.value)} fullWidth />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="En estado óptimo" type="number" value={enser.cantidadOptimo} onChange={(e) => campo('cantidadOptimo', e.target.value)} fullWidth />
              <TextField label="En buen estado" type="number" value={enser.cantidadBueno} onChange={(e) => campo('cantidadBueno', e.target.value)} fullWidth />
              <TextField label="Para reparar" type="number" value={enser.cantidadReparar} onChange={(e) => campo('cantidadReparar', e.target.value)} fullWidth />
            </Stack>
          </Stack>
        )}
      </PantallaEdicion>
    </>
  )
}
