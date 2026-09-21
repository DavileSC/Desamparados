import { useEffect, useState } from 'react'
import { Alert, CircularProgress, MenuItem, Select, Stack, TextField } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PantallaEdicion from './PantallaEdicion'
import { useVolverAlListado } from '../../hooks/useVolverAlListado'
import { traerEnser, traerPrenda, actualizarEnser, actualizarPrenda, type Prenda } from '../../lib/api/inventario'
import { AVISO_CANTIDADES, ESTADOS_ELEGIBLES, ETIQUETA_ESTADO, esCantidadValida } from './ropero'

type FormEnser = { nombre: string; referencia: string; categoria: string; ubicacion: string; cantidadOptimo: string; cantidadBueno: string; cantidadReparar: string }
type FormPrenda = { numero: string; tipo: string; talla: string; estado: string; observaciones: string }

const tipos = ['TUNICA', 'CAPIROTE', 'FARAONA', 'CAPA', 'OTRO']

/**
 * Enseres y ropero comparten pantalla porque comparten listado: el inventario
 * es una sola sección con dos pestañas. Cuál de las dos se edita viene en la
 * query (`?tipo=prenda`), que es lo que sabe el listado al pulsar Editar.
 */
export default function InventarioEditPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const esPrenda = params.get('tipo') === 'prenda'
  const navegar = useNavigate()
  // El listado del que se vino, con su página y sus filtros: el enlace de editar
  // los trae en el state. Sin state (URL tecleada) se cae en la ruta pelada.
  const volverAlListado = useVolverAlListado('/cms/inventario')
  const [nombre, setNombre] = useState('')
  const [form, setForm] = useState<FormEnser | FormPrenda | null>(null)
  const [inicial, setInicial] = useState<string>('')
  // El estado con el que llegó la prenda: si está prestada, aquí no se cambia.
  const [estadoInicial, setEstadoInicial] = useState<Prenda['estado'] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const cargar = esPrenda
      ? traerPrenda(Number(id)).then((p) => {
          setNombre(`Prenda ${p.numero}`)
          setEstadoInicial(p.estado)
          return { numero: p.numero, tipo: p.tipo, talla: p.talla ?? '', estado: p.estado, observaciones: p.observaciones ?? '' } as FormPrenda
        })
      : traerEnser(Number(id)).then((e) => {
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
    if (!esPrenda) {
      const e = form as FormEnser
      if (![e.cantidadOptimo, e.cantidadBueno, e.cantidadReparar].every(esCantidadValida)) {
        setError(AVISO_CANTIDADES)
        return
      }
    }
    setGuardando(true)
    try {
      if (esPrenda) await actualizarPrenda(Number(id), form)
      else {
        const e = form as FormEnser
        await actualizarEnser(Number(id), {
          ...e,
          cantidadOptimo: Number(e.cantidadOptimo),
          cantidadBueno: Number(e.cantidadBueno),
          cantidadReparar: Number(e.cantidadReparar),
        })
      }
      navegar(volverAlListado)
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
        volverA={volverAlListado}
        onGuardar={guardar}
      >
        {esPrenda ? (
          <Stack spacing={2}>
            <TextField label="Número" value={prenda.numero} onChange={(e) => campo('numero', e.target.value)} fullWidth />
            <Select value={prenda.tipo} onChange={(e) => campo('tipo', e.target.value)} aria-label="Tipo de prenda">
              {tipos.map((tipo) => <MenuItem key={tipo} value={tipo}>{tipo}</MenuItem>)}
            </Select>
            <TextField label="Talla" value={prenda.talla} onChange={(e) => campo('talla', e.target.value)} fullWidth />
            {/* PRESTADA la ponen «Prestar» y «Devolver», que guardan también quién
                la tiene: aquí ni se elige ni se quita. */}
            {estadoInicial === 'PRESTADA' ? (
              <TextField
                label="Estado"
                value={ETIQUETA_ESTADO.PRESTADA}
                helperText="Para cambiarlo, registra la devolución con «Devolver» en el listado del ropero."
                disabled
                fullWidth
              />
            ) : (
              <TextField select label="Estado" value={prenda.estado} onChange={(e) => campo('estado', e.target.value)} fullWidth>
                {ESTADOS_ELEGIBLES.map((estado) => <MenuItem key={estado} value={estado}>{ETIQUETA_ESTADO[estado]}</MenuItem>)}
              </TextField>
            )}
            <TextField label="Observaciones" value={prenda.observaciones} onChange={(e) => campo('observaciones', e.target.value)} fullWidth multiline />
          </Stack>
        ) : (
          <Stack spacing={2}>
            <TextField label="Nombre" value={enser.nombre} onChange={(e) => campo('nombre', e.target.value)} fullWidth />
            <TextField label="Referencia" value={enser.referencia} onChange={(e) => campo('referencia', e.target.value)} fullWidth />
            <TextField label="Categoría" value={enser.categoria} onChange={(e) => campo('categoria', e.target.value)} fullWidth />
            <TextField label="Ubicación" value={enser.ubicacion} onChange={(e) => campo('ubicacion', e.target.value)} fullWidth />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              {([['cantidadOptimo', 'En estado óptimo'], ['cantidadBueno', 'En buen estado'], ['cantidadReparar', 'Para reparar']] as const).map(([clave, etiqueta]) => (
                <TextField
                  key={clave}
                  label={etiqueta}
                  type="number"
                  slotProps={{ htmlInput: { min: 0, step: 1, inputMode: 'numeric' } }}
                  value={enser[clave]}
                  onChange={(e) => campo(clave, e.target.value)}
                  error={!esCantidadValida(enser[clave])}
                  helperText={esCantidadValida(enser[clave]) ? undefined : 'Solo números enteros'}
                  fullWidth
                />
              ))}
            </Stack>
          </Stack>
        )}
      </PantallaEdicion>
    </>
  )
}
