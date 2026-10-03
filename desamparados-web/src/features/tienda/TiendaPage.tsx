import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import MetaDePagina from '../../components/MetaDePagina'
import CabeceraDePagina from '../../components/CabeceraDePagina'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import Boton from '../../components/Boton'
import EnCarga, { estadoDeConsulta } from '../../components/esqueleto/EnCarga'
import Hueso from '../../components/esqueleto/Hueso'
import { catalogo, comprar, type TallaDeProducto } from '../../lib/api/tienda'
import { irAlBanco } from '../../lib/api/procesion'
import { site } from '../../config/site'
import { deLaCorporacion } from '../../domain/articulos'
import { PAPEL } from '../inicio/estilos'
import TarjetaDeProducto from './TarjetaDeProducto'
import FichaDeProducto from './FichaDeProducto'
import CestaDeLaTienda, { type Comprador } from './CestaDeLaTienda'
import { MAX_POR_LINEA, claveDe, euros, guardarCesta, leerCesta, lineasDeLaCesta, quedanDe, topeDe, type Cesta } from './cesta'

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)

/** La rejilla y la cesta mientras llega el catálogo, con su forma. */
function Esqueleto() {
  return (
    <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 340px' } }}>
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' } }}>
        {Array.from({ length: 6 }, (_, i) => (
          <Box key={i}>
            <Hueso sx={{ aspectRatio: '1 / 1' }} />
            <Hueso sx={{ mt: 2, height: 18, width: '70%' }} />
            <Hueso sx={{ mt: 1, height: 14, width: '90%' }} />
            <Hueso sx={{ mt: 2, height: 36, width: '45%' }} />
          </Box>
        ))}
      </Box>
      <Hueso sx={{ display: { xs: 'none', md: 'block' }, height: 260 }} />
    </Box>
  )
}

/**
 * La tienda del Grupo: los recuerdos a la venta en una rejilla, con la cesta
 * al lado, y la ficha de cada uno en /tienda/producto/:id (fotos en grande,
 * tallas, cuántas). Se compra sin cuenta y se recoge en Secretaría.
 *
 * La rejilla y la ficha son la misma página: comparten el catálogo y la
 * cesta, que sigue a la vista mientras se mira un producto.
 */
export default function TiendaPage() {
  const { id } = useParams()
  const navegar = useNavigate()
  const consulta = useQuery({ queryKey: ['tienda', 'catalogo'], queryFn: catalogo })
  const [cesta, setCesta] = useState<Cesta>(leerCesta)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const refCesta = useRef<HTMLElement>(null)
  // La barra del móvil sobra cuando la cesta ya está a la vista: la taparía.
  const [cestaALaVista, setCestaALaVista] = useState(false)
  const hayCesta = Boolean(consulta.data?.pagoDisponible)
  useEffect(() => {
    const cesta = refCesta.current
    if (!cesta || typeof IntersectionObserver === 'undefined') return
    const observador = new IntersectionObserver(([e]) => setCestaALaVista(e.isIntersecting))
    observador.observe(cesta)
    return () => observador.disconnect()
  }, [hayCesta])

  const datos = consulta.data
  const productos = datos?.productos ?? []
  const pagoDisponible = datos?.pagoDisponible ?? false
  const lineas = lineasDeLaCesta(cesta, productos)
  const producto = id ? productos.find((p) => String(p.id) === id) : undefined
  const total = lineas.reduce((s, l) => s + l.producto.precio * l.cantidad, 0)
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0)

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
  return <>
    <MetaDePagina
      titulo={titulo}
      descripcion={producto
        ? `${producto.nombre}, ${euros(producto.precio)}. ${producto.descripcion}`.slice(0, 160)
        : `Recuerdos ${deLaCorporacion()} ${site.titular}. Se compran en línea y se recogen en Secretaría.`}
    />
    {/* En la ficha, sin cabecera: lo primero que se ve es el producto. */}
    {!id && <CabeceraDePagina title="Tienda" subtitle={`Recuerdos ${deLaCorporacion()}. Se pagan aquí y se recogen en Secretaría.`} />}
    <ContenedorDePagina>
      <Box sx={{ pt: id ? { xs: 10, md: 14 } : { xs: 4, md: 6 }, pb: { xs: lineas.length > 0 && pagoDisponible ? 14 : 6, md: 8 } }}>
        {!datos ? (
          <EnCarga estado={estadoDeConsulta(consulta)} que="la tienda" esqueleto={<Esqueleto />} alReintentar={() => void consulta.refetch()} />
        ) : <>
          {productos.length === 0 && <Alert severity="info">Ahora mismo no hay nada a la venta. Vuelve pronto.</Alert>}
          {!pagoDisponible && productos.length > 0 && (
            <Alert severity="info" sx={{ mb: 3 }}>Todavía no se puede pagar en línea: estos recuerdos se compran en Secretaría.</Alert>
          )}

          {productos.length > 0 && (
            <Box sx={{ display: 'grid', gap: 5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: pagoDisponible ? 'minmax(0, 1fr) 340px' : 'minmax(0, 1fr)' }, alignItems: 'start' }}>
              <Box sx={{ minWidth: 0 }}>
                {id ? (producto
                  ? <FichaDeProducto key={producto.id} producto={producto} pagoDisponible={pagoDisponible} cesta={cesta} onAnadir={(t, n) => anadir(producto.id, t, n)} />
                  : <Box>
                    <Alert severity="info" sx={{ mb: 2 }}>Ese producto ya no está a la venta.</Alert>
                    <Boton component={Link} to="/tienda" appVariant="claro">Ver toda la tienda</Boton>
                  </Box>)
                  : (
                    <Box component="ul" aria-label="Productos" sx={{
                      m: 0, p: 0, listStyle: 'none', display: 'grid', columnGap: { xs: 2, sm: 3 }, rowGap: { xs: 4, sm: 5 },
                      gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: pagoDisponible ? 'repeat(3, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))' },
                    }}>
                      {productos.map((p) => (
                        <TarjetaDeProducto key={p.id} producto={p} pagoDisponible={pagoDisponible} cesta={cesta} onAnadir={(t) => anadir(p.id, t)} />
                      ))}
                    </Box>
                  )}
              </Box>
              {pagoDisponible && (
                <CestaDeLaTienda ref={refCesta} lineas={lineas} metodos={datos.metodos} enviando={enviando} error={error} onCambiar={poner} onPagar={(c) => void pagar(c)} />
              )}
            </Box>
          )}
        </>}
      </Box>
    </ContenedorDePagina>

    {/* En el móvil la cesta queda debajo de todo: esta barra dice qué llevas y lleva a ella. */}
    {pagoDisponible && lineas.length > 0 && !cestaALaVista && (
      <Box sx={{
        display: { xs: 'flex', md: 'none' }, position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 10, alignItems: 'center', gap: 1.5,
        minHeight: 64, pl: 2, pr: 1.25, borderRadius: '10px', bgcolor: PAPEL, color: '#161214', boxShadow: '0 10px 28px rgba(0, 0, 0, 0.45)',
      }}>
        <Box sx={{ flexGrow: 1, lineHeight: 1.2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: 'inherit' }}>{euros(total)}</Typography>
          <Typography sx={{ fontSize: 13, color: 'inherit' }}>{unidades} {unidades === 1 ? 'artículo' : 'artículos'} en la cesta</Typography>
        </Box>
        <Boton size="small" onClick={() => refCesta.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Ver la cesta</Boton>
      </Box>
    )}
  </>
}
