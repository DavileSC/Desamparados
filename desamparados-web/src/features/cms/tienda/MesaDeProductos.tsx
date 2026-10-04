import { useEffect, useRef, useState } from 'react'
import { Alert, Box, ButtonBase, Paper, TextField, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import { borrarProducto, categoriasDelCms, crearProducto, guardarProducto, type Producto } from '../../../lib/api/tienda'
import { euros } from '../contabilidad/formato'
import FichaDeProductoCms from './FichaDeProductoCms'
import { VACIO, aDatos, aFormulario, existenciasEnTexto, type Formulario } from './formularioProducto'

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)

/** Lo que hay en la ficha: un producto (por su id), uno nuevo o nada. */
type Seleccion = { id: number } | { nuevo: true } | null

/**
 * Los productos de la tienda en mesa: la lista a la izquierda y la ficha del
 * elegido a la derecha, sin ventana. Cambiar de producto con cambios sin
 * guardar pregunta antes de tirarlos.
 */
export default function MesaDeProductos({ lista, pedirNuevo, onNuevoAtendido, onAviso, onError }: {
  lista: Producto[]
  /** Se ha pulsado «Nuevo producto» en la cabecera. */
  pedirNuevo: boolean
  onNuevoAtendido: () => void
  onAviso: (texto: string) => void
  onError: (texto: string) => void
}) {
  const cliente = useQueryClient()
  const categorias = useQuery({ queryKey: ['tienda', 'categorias'], queryFn: categoriasDelCms }).data ?? []
  const [seleccion, setSeleccion] = useState<Seleccion>(() => (lista[0] ? { id: lista[0].id } : null))
  const [form, setForm] = useState<{ actual: Formulario; original: Formulario } | null>(() => (lista[0] ? { actual: aFormulario(lista[0]), original: aFormulario(lista[0]) } : null))
  const [pendiente, setPendiente] = useState<Seleccion | undefined>(undefined)
  const [guardando, setGuardando] = useState(false)
  const [aBorrar, setABorrar] = useState<Producto | null>(null)
  const [buscar, setBuscar] = useState('')
  const refFicha = useRef<HTMLDivElement>(null)

  const sucio = Boolean(form && JSON.stringify(form.actual) !== JSON.stringify(form.original))
  const elegido = seleccion && 'id' in seleccion ? lista.find((p) => p.id === seleccion.id) ?? null : null

  const abrir = (s: Seleccion) => {
    setSeleccion(s)
    const base = s && 'id' in s ? lista.find((p) => p.id === s.id) : null
    const f = base ? aFormulario(base) : s ? VACIO : null
    setForm(f ? { actual: f, original: f } : null)
    // En el móvil la ficha queda debajo de la lista: se baja a ella.
    requestAnimationFrame(() => { if (window.matchMedia?.('(max-width: 899px)').matches) refFicha.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) })
  }
  const pedir = (s: Seleccion) => { if (sucio) setPendiente(s); else abrir(s) }

  useEffect(() => {
    if (!pedirNuevo) return
    onNuevoAtendido()
    pedir({ nuevo: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando llega la petición
  }, [pedirNuevo])

  const recargar = () => cliente.invalidateQueries({ queryKey: ['tienda'] })

  const guardar = async () => {
    if (!form || !seleccion) return
    setGuardando(true)
    try {
      const datos = aDatos(form.actual)
      const guardado = 'id' in seleccion ? await guardarProducto(seleccion.id, datos) : await crearProducto(datos)
      const f = aFormulario(guardado)
      setSeleccion({ id: guardado.id }); setForm({ actual: f, original: f })
      onAviso('Producto guardado.')
      await recargar()
    } catch (err: unknown) { onError(mensaje(err, 'No se ha podido guardar.')) }
    finally { setGuardando(false) }
  }

  const borrar = async () => {
    if (!aBorrar) return
    const p = aBorrar
    setABorrar(null)
    try {
      onAviso((await borrarProducto(p.id)).message)
      await recargar()
      abrir(null)
    } catch (err: unknown) { onError(mensaje(err, 'No se ha podido borrar.')) }
  }

  const termino = buscar.trim().toLowerCase()
  const visibles = termino ? lista.filter((p) => p.nombre.toLowerCase().includes(termino)) : lista

  return (
    <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '340px minmax(0, 1fr)' }, alignItems: 'start' }}>
      <Paper component="section" aria-label="Productos" sx={{ overflow: 'hidden' }}>
        <Box sx={{ p: 1.5 }}>
          <TextField size="small" fullWidth placeholder="Buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)}
            slotProps={{ htmlInput: { 'aria-label': 'Buscar un producto' }, input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> } }} />
        </Box>
        {lista.length === 0 && <Typography color="text.secondary" sx={{ px: 2, pb: 2 }}>Todavía no hay productos. Crea el primero con «Nuevo producto».</Typography>}
        {lista.length > 0 && visibles.length === 0 && <Typography color="text.secondary" sx={{ px: 2, pb: 2 }}>Ninguno se llama así.</Typography>}
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {visibles.map((p) => {
            const sel = elegido?.id === p.id
            const texto = existenciasEnTexto(p)
            return (
              <Box component="li" key={p.id} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                <ButtonBase onClick={() => pedir({ id: p.id })} aria-current={sel ? 'true' : undefined}
                  sx={{
                    width: '100%', display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr) auto', gap: 1.5, alignItems: 'center', px: 1.75, py: 1.25,
                    textAlign: 'left', fontFamily: 'inherit', opacity: p.activo ? 1 : 0.55,
                    bgcolor: sel ? 'action.selected' : 'transparent', boxShadow: sel ? (t) => `inset 3px 0 0 ${t.palette.primary.main}` : 'none',
                    '&:hover': { bgcolor: sel ? 'action.selected' : 'action.hover' },
                  }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: 0.5, overflow: 'hidden', bgcolor: '#f7f3ec' }}>
                    {p.foto && <Box component="img" src={p.foto} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'multiply' }} />}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14.5 }} noWrap>{p.nombre}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {euros(p.precio)}{p.tallas.length > 0 ? ` · ${p.tallas.length} tallas` : ''}{p.activo ? '' : ' · retirado'}
                    </Typography>
                  </Box>
                  <Typography component="span" sx={{
                    fontSize: 12, fontWeight: 600, px: 1, py: 0.25, borderRadius: 3, whiteSpace: 'nowrap',
                    bgcolor: texto === 'agotado' ? 'rgba(227, 73, 72, 0.12)' : 'action.hover',
                    color: texto === 'agotado' ? 'error.main' : 'text.secondary',
                  }}>
                    {texto.charAt(0).toUpperCase() + texto.slice(1)}
                  </Typography>
                </ButtonBase>
              </Box>
            )
          })}
        </Box>
      </Paper>

      <Box ref={refFicha} sx={{ scrollMarginTop: 80, minWidth: 0 }}>
        {form && seleccion
          ? <FichaDeProductoCms
            form={form.actual}
            categorias={categorias}
            nuevo={'nuevo' in seleccion}
            sucio={sucio}
            guardando={guardando}
            onCambiar={(actual) => setForm({ ...form, actual })}
            onGuardar={() => void guardar()}
            onDescartar={() => ('nuevo' in seleccion ? abrir(lista[0] ? { id: lista[0].id } : null) : setForm({ ...form, actual: form.original }))}
            onBorrar={() => elegido && setABorrar(elegido)}
          />
          : lista.length > 0 && <Alert severity="info">Elige un producto de la lista para ver su ficha.</Alert>}
      </Box>

      <DialogoConfirmacion
        abierto={pendiente !== undefined}
        titulo="¿Descartar los cambios?"
        mensaje="La ficha tiene cambios sin guardar. Si sigues, se pierden."
        textoConfirmar="Descartar"
        peligro
        onConfirmar={() => { const s = pendiente ?? null; setPendiente(undefined); abrir(s) }}
        onCancelar={() => setPendiente(undefined)}
      />
      <DialogoConfirmacion
        abierto={aBorrar !== null}
        titulo="¿Borrar el producto?"
        mensaje={aBorrar ? `«${aBorrar.nombre}» deja de estar en la tienda. Si ya tiene pedidos, se retira de la venta en vez de borrarse.` : ''}
        textoConfirmar="Borrar"
        peligro
        onConfirmar={() => void borrar()}
        onCancelar={() => setABorrar(null)}
      />
    </Box>
  )
}
