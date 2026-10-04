import { useMemo, useState } from 'react'
import { Alert, Box, Drawer, IconButton, Typography } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import { useReducedMotion } from 'framer-motion'
import CloseIcon from '@mui/icons-material/Close'
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MetaDePagina from '../../components/MetaDePagina'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import Boton from '../../components/Boton'
import CifrasQueRuedan from '../../components/CifrasQueRuedan'
import EnCarga, { estadoDeConsulta } from '../../components/esqueleto/EnCarga'
import Hueso from '../../components/esqueleto/Hueso'
import { catalogo, comprar, type TallaDeProducto } from '../../lib/api/tienda'
import { irAlBanco } from '../../lib/api/procesion'
import { site } from '../../config/site'
import { deLaCorporacion } from '../../domain/articulos'
import TarjetaDeProducto from './TarjetaDeProducto'
import PiezaDestacada from './PiezaDestacada'
import FichaDeProducto from './FichaDeProducto'
import BarraDeFiltros, { FiltrosActivos } from './BarraDeFiltros'
import { SIN_FILTROS, filtrar, hayFiltros, ordenar, tallasDeLaTienda, type Filtros, type Orden } from './filtros'
import CestaDeLaTienda, { type Comprador } from './CestaDeLaTienda'
import CestaFlotante from './CestaFlotante'
import { MAX_POR_LINEA, claveDe, euros, guardarCesta, leerCesta, lineasDeLaCesta, quedanDe, topeDe, type Cesta } from './cesta'

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)

/** La rejilla: dos columnas en el móvil, tres en la tableta y cuatro en el ordenador. */
const REJILLA = { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }

/**
 * La entrada escalonada de la rejilla (el Animated Content de React Bits):
 * cada ficha sube y aparece 70 ms después de la anterior. A partir de la
 * docena entran todas a la vez, para no hacer esperar en un catálogo largo.
 */
const entrar = keyframes`
  from { opacity: 0; transform: translateY(22px); }
  to { opacity: 1; transform: none; }
`
const ENTRADA = {
  '& > li': { animation: `${entrar} .6s cubic-bezier(.2, .7, .2, 1) both` },
  ...Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`& > li:nth-of-type(${i + 1})`, { animationDelay: `${i * 70}ms` }])),
  '& > li:nth-of-type(n+13)': { animationDelay: '840ms' },
}

/** La rejilla mientras llega el catálogo, con su forma: la destacada y las demás. */
function Esqueleto() {
  return (
    <Box sx={{ display: 'grid', columnGap: { xs: 1.5, sm: 3 }, rowGap: { xs: 3, sm: 4 }, gridTemplateColumns: REJILLA }}>
      <Hueso sx={{ gridColumn: 'span 2', gridRow: { sm: 'span 2' }, minHeight: { xs: 300, sm: 380 } }} />
      {Array.from({ length: 4 }, (_, i) => (
        <Box key={i}>
          <Hueso sx={{ aspectRatio: '1 / 1' }} />
          <Hueso sx={{ mt: 1.5, height: 16, width: '75%' }} />
        </Box>
      ))}
    </Box>
  )
}

/** Lo que conviene saber antes de comprar, al pie de la rejilla. */
function Garantias({ conBizum }: { conBizum: boolean }) {
  const filas = [
    { Icono: CreditCardOutlinedIcon, texto: conBizum ? 'Tarjeta o Bizum' : 'Pago con tarjeta' },
    { Icono: StorefrontOutlinedIcon, texto: 'Se recoge en Secretaría' },
    { Icono: LockOutlinedIcon, texto: 'Compra segura' },
  ]
  return (
    <Box component="ul" sx={{ m: 0, mt: { xs: 5, md: 6 }, p: 0, pt: 3, listStyle: 'none', display: 'flex', flexWrap: 'wrap', columnGap: 6, rowGap: 1.5, borderTop: '1px solid rgba(204, 196, 201, 0.12)' }}>
      {filas.map(({ Icono, texto }) => (
        <Box component="li" key={texto} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontSize: 14, color: '#cbc5c8' }}>
          <Icono aria-hidden sx={{ fontSize: 20, color: '#cdae72' }} />{texto}
        </Box>
      ))}
    </Box>
  )
}

/**
 * La tienda del Grupo («Mostrador»): los recuerdos en una rejilla con la pieza
 * destacada en grande, una barra de filtros (categoría, precio, talla, lo
 * agotado) con «Ordenar por», y un «+» en cada
 * foto para añadir sin entrar. La cesta flota abajo en cuanto lleva algo y se
 * abre en un cajón. La ficha de cada producto está en /tienda/producto/:id
 * (fotos en grande, tallas, cuántas). Se compra sin cuenta y se recoge en
 * Secretaría.
 *
 * La rejilla y la ficha son la misma página: comparten el catálogo y la
 * cesta, que sigue a mano mientras se mira un producto.
 */
export default function TiendaPage() {
  const { id } = useParams()
  const navegar = useNavigate()
  const consulta = useQuery({ queryKey: ['tienda', 'catalogo'], queryFn: catalogo })
  const [cesta, setCesta] = useState<Cesta>(leerCesta)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [cestaAbierta, setCestaAbierta] = useState(false)
  // Los filtros viven en la página, no en la dirección: cambiarlos es al momento.
  const [filtrosPedidos, setFiltros] = useState<Filtros>(SIN_FILTROS)
  const [orden, setOrden] = useState<Orden>('destacados')
  const quieto = useReducedMotion() ?? false

  const datos = consulta.data
  const productos = useMemo(() => datos?.productos ?? [], [datos])
  const categorias = useMemo(() => datos?.categorias ?? [], [datos])
  const pagoDisponible = datos?.pagoDisponible ?? false
  const lineas = lineasDeLaCesta(cesta, productos)
  const producto = id ? productos.find((p) => String(p.id) === id) : undefined
  const total = lineas.reduce((s, l) => s + l.producto.precio * l.cantidad, 0)
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0)

  // Una categoría que ya no está (se vació mientras tanto) vuelve a «Todo».
  const filtros: Filtros = filtrosPedidos.categoria !== null && !categorias.some((c) => c.id === filtrosPedidos.categoria)
    ? { ...filtrosPedidos, categoria: null } : filtrosPedidos
  const tallas = useMemo(() => tallasDeLaTienda(productos), [productos])
  const visibles = ordenar(filtrar(productos, filtros), orden)
  // La destacada, en grande, solo en la tienda entera y en su orden: con un
  // filtro o con otro orden, va en la rejilla como las demás.
  const destacado = !hayFiltros(filtros) && orden === 'destacados' ? visibles.find((p) => p.destacado) : undefined
  const enRejilla = visibles.filter((p) => p !== destacado)
  const nombreCategoria = categorias.find((c) => c.id === filtros.categoria)?.nombre

  const poner = (clave: string, cantidad: number) => {
    const siguiente = { ...cesta }
    if (cantidad <= 0) delete siguiente[clave]
    else siguiente[clave] = Math.min(MAX_POR_LINEA, cantidad)
    setCesta(siguiente)
    guardarCesta(siguiente)
  }
  const anadir = (productoId: number, talla: TallaDeProducto | null, cuantas = 1) => {
    const p = productos.find((x) => x.id === productoId)
    if (!p) return
    const clave = claveDe(productoId, talla?.id)
    poner(clave, Math.min(topeDe(quedanDe(p, talla)), (cesta[clave] ?? 0) + cuantas))
  }

  const pagar = async (comprador: Comprador) => {
    setEnviando(true); setError(null)
    try {
      const r = await comprar({
        ...comprador,
        lineas: lineas.map((l) => ({ productoId: l.producto.id, ...(l.talla ? { tallaId: l.talla.id } : {}), cantidad: l.cantidad })),
      })
      guardarCesta({}); setCesta({})
      if (r.tipo === 'banco') irAlBanco(r)
      else navegar(`/tienda/pedido/${r.token}`)
    } catch (err: unknown) {
      setError(mensaje(err, 'No se ha podido hacer el pedido.'))
      setEnviando(false)
    }
  }

  const titulo = producto ? producto.nombre : 'Tienda'
  const hayCesta = pagoDisponible && lineas.length > 0
  return <>
    <MetaDePagina
      titulo={titulo}
      descripcion={producto
        ? `${producto.nombre}, ${euros(producto.precio)}. ${producto.descripcion}`.slice(0, 160)
        : `Recuerdos ${deLaCorporacion()} ${site.titular}. Se compran en línea y se recogen en Secretaría.`}
    />
    <ContenedorDePagina>
      {/* Arriba, el hueco de la barra de navegación, que en escritorio va fija
          encima; abajo, el de la cesta que flota, para que no tape lo último. */}
      <Box sx={{ pt: { xs: 10, md: 14 }, pb: hayCesta ? 13 : { xs: 6, md: 8 } }}>
        {!id && (
          <Box sx={{ mb: { xs: 1.5, md: 3.5 } }}>
            <Typography component="p" sx={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#cdae72', fontWeight: 600 }}>
              Recuerdos {deLaCorporacion()}
            </Typography>
            <Typography component="h1" sx={{ mt: 1.25, fontSize: { xs: 38, md: 56 }, fontWeight: 200, lineHeight: 1, letterSpacing: '-0.02em' }}>
              {nombreCategoria ?? 'Tienda'}
              {datos && productos.length > 0 && (
                <CifrasQueRuedan texto={`(${visibles.length})`} sx={{ ml: 1.5, fontSize: { xs: 20, md: 26 }, fontWeight: 300, color: '#8f8a8d' }} />
              )}
            </Typography>
          </Box>
        )}

        {!datos ? (
          <EnCarga estado={estadoDeConsulta(consulta)} que="la tienda" esqueleto={<Esqueleto />} alReintentar={() => void consulta.refetch()} />
        ) : <>
          {productos.length === 0 && <Alert severity="info">Ahora mismo no hay nada a la venta. Vuelve pronto.</Alert>}
          {!pagoDisponible && productos.length > 0 && (
            <Alert severity="info" sx={{ mb: 3 }}>Todavía no se puede pagar en línea: estos recuerdos se compran en Secretaría.</Alert>
          )}

          {id ? (producto
            ? <FichaDeProducto key={producto.id} producto={producto} pagoDisponible={pagoDisponible} cesta={cesta} onAnadir={(t, n) => anadir(producto.id, t, n)} />
            : <Box>
              <Alert severity="info" sx={{ mb: 2 }}>Ese producto ya no está a la venta.</Alert>
              <Boton component={Link} to="/tienda" appVariant="claro">Ver toda la tienda</Boton>
            </Box>)
            : productos.length > 0 && <>
              <Box sx={{ mb: { xs: 2, md: 3.5 } }}>
                <BarraDeFiltros categorias={categorias} productos={productos} tallas={tallas} filtros={filtros} onFiltros={setFiltros}
                  orden={orden} onOrden={setOrden} resultado={visibles.length} />
                <FiltrosActivos categorias={categorias} filtros={filtros} onFiltros={setFiltros} />
              </Box>
              {visibles.length === 0 && (
                <Box sx={{ py: 7, px: 3, textAlign: 'center', color: '#8f8a8d', border: '1px dashed rgba(204, 196, 201, 0.2)' }}>
                  <Typography sx={{ color: 'inherit', mb: 2 }}>No hay nada con esos filtros.</Typography>
                  <Boton appVariant="claro" onClick={() => setFiltros(SIN_FILTROS)}>Quitar filtros</Boton>
                </Box>
              )}
              {/* Con otro filtro u otro orden la rejilla se monta de nuevo: así la
                  entrada escalonada vuelve a empezar. */}
              <Box component="ul" key={JSON.stringify([filtros, orden])} aria-label="Productos" sx={{
                ...(quieto ? {} : ENTRADA),
                m: 0, p: 0, listStyle: 'none', display: 'grid', columnGap: { xs: 1.5, sm: 3 }, rowGap: { xs: 3, sm: 4 }, gridTemplateColumns: REJILLA,
              }}>
                {destacado && <PiezaDestacada producto={destacado} pagoDisponible={pagoDisponible} cesta={cesta} onAnadir={() => anadir(destacado.id, null)} />}
                {enRejilla.map((p) => (
                  <TarjetaDeProducto key={p.id} producto={p} pagoDisponible={pagoDisponible} cesta={cesta} onAnadir={() => anadir(p.id, null)} />
                ))}
              </Box>
              {pagoDisponible && <Garantias conBizum={datos.metodos.includes('BIZUM')} />}
            </>}
        </>}
      </Box>
    </ContenedorDePagina>

    {hayCesta && !cestaAbierta && <CestaFlotante unidades={unidades} total={total} onAbrir={() => setCestaAbierta(true)} />}
    {pagoDisponible && (
      <Drawer anchor="right" open={cestaAbierta} onClose={() => setCestaAbierta(false)}
        slotProps={{ paper: { sx: { width: { xs: '100%', sm: 440 }, bgcolor: 'background.paper', backgroundImage: 'none' } } }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
          <IconButton aria-label="Cerrar la cesta" onClick={() => setCestaAbierta(false)}><CloseIcon /></IconButton>
        </Box>
        <CestaDeLaTienda lineas={lineas} metodos={datos?.metodos ?? ['TARJETA']} enviando={enviando} error={error} onCambiar={poner} onPagar={(c) => void pagar(c)} />
      </Drawer>
    )}
  </>
}
