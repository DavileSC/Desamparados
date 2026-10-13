import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../../test/test-utils'
import TiendaPage from '../TiendaPage'
import PedidoTiendaPage from '../PedidoTiendaPage'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const CAMISETA = {
  id: 3, nombre: 'Camiseta', descripcion: 'Negra, con el escudo', precio: 12, foto: '/uploads/camiseta.webp', fotos: [], existencias: null, activo: true, orden: 2,
  categoriaId: 12, destacado: false, creadoEl: '2026-10-03T10:00:00.000Z',
  tallas: [{ id: 30, nombre: 'S', existencias: 3 }, { id: 31, nombre: 'L', existencias: 9 }, { id: 32, nombre: 'XXL', existencias: 0 }],
}
const CATALOGO = {
  pagoDisponible: true, metodos: ['TARJETA', 'BIZUM'],
  productos: [
    { id: 1, nombre: 'Medalla', descripcion: 'De plata', precio: 15, foto: null, fotos: [], existencias: 2, activo: true, orden: 0, tallas: [], categoriaId: 10, destacado: false, creadoEl: '2026-10-01T10:00:00.000Z' },
    { id: 2, nombre: 'Estampa', descripcion: '', precio: 1.5, foto: null, fotos: [], existencias: 0, activo: true, orden: 1, tallas: [], categoriaId: 11, destacado: false, creadoEl: '2026-10-02T10:00:00.000Z' },
    CAMISETA,
  ],
  categorias: [{ id: 10, nombre: 'Medallas' }, { id: 11, nombre: 'Estampas' }, { id: 12, nombre: 'Ropa' }, { id: 13, nombre: 'Velas' }, { id: 14, nombre: 'Libros' }],
}

/** La tienda con sus rutas: la rejilla, la ficha y la vuelta del pedido. */
const montar = (ruta: string) => renderWithProviders(
  <Routes>
    <Route path="/tienda" element={<TiendaPage />} />
    <Route path="/tienda/producto/:id" element={<TiendaPage />} />
    <Route path="/tienda/pedido/:token" element={<p>Pantalla del pedido</p>} />
  </Routes>,
  { ruta },
)

/** El servidor: el catálogo, y los pedidos se dan por pagados en el acto. */
function servidor(catalogo: unknown = CATALOGO) {
  const fetch = vi.fn().mockImplementation((_url: string, init: RequestInit = {}) => Promise.resolve(
    init.method === 'POST' ? json({ tipo: 'hecho', token: 'a'.repeat(32) }, 201) : json(catalogo),
  ))
  vi.stubGlobal('fetch', fetch)
  return () => {
    const envio = fetch.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
    return envio ? JSON.parse(String((envio[1] as RequestInit).body)) as Record<string, unknown> : null
  }
}

async function pagarComo(user: ReturnType<typeof userEvent.setup>, total: RegExp) {
  await user.click(screen.getByRole('button', { name: 'Seguir con el pago' }))
  const pagar = screen.getByRole('button', { name: total })
  // Sin datos, «Pagar» no se queda en gris callado: dice qué falta y lleva al primero.
  await user.click(pagar)
  expect(screen.getByText('Escribe tu nombre.')).toBeInTheDocument()
  expect(screen.getByText('Escribe tu correo.')).toBeInTheDocument()
  expect(screen.getByText('Escribe tu teléfono.')).toBeInTheDocument()
  expect(screen.getByLabelText('Nombre y apellidos')).toHaveFocus()
  await user.type(screen.getByLabelText('Nombre y apellidos'), 'Ana Ruiz')
  await user.type(screen.getByLabelText('Correo'), 'ana@ejemplo')
  await user.click(pagar)
  expect(screen.getByText(/Revisa el correo/)).toBeInTheDocument()
  expect(screen.getByLabelText('Correo')).toHaveFocus()
  await user.type(screen.getByLabelText('Correo'), '.es')
  // Con el prefijo y espacios también vale: se manda con nueve cifras.
  await user.type(screen.getByLabelText('Teléfono'), '+34 600 11 12 22')
  await user.click(pagar)
}

/**
 * Hasta que la hoja termina de cerrarse, el resto de la página sigue oculto a
 * los lectores de pantalla (y a `getByRole`): se espera a que se vaya.
 */
const hojaCerrada = () => waitFor(() => expect(document.querySelector('.MuiDrawer-root')).toBeNull())

beforeEach(() => { try { window.localStorage.clear() } catch { /* sin almacenamiento */ } })
afterEach(() => { vi.unstubAllGlobals() })

describe('TiendaPage', () => {
  it('llena la cesta sin pasar de lo que queda y paga con los datos del comprador', async () => {
    const user = userEvent.setup()
    const enviado = servidor()
    montar('/tienda')

    expect(await screen.findByRole('link', { name: 'Medalla' })).toBeInTheDocument()
    expect(screen.getAllByText('Agotado').length).toBeGreaterThan(0)
    // La agotada no tiene «+».
    expect(screen.queryByRole('button', { name: 'Añadir Estampa a la cesta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Ver la cesta/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Añadir Medalla a la cesta' }))
    expect(screen.getByRole('button', { name: 'Añadir otra unidad de Medalla (llevas 1)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Ver la cesta: 1 artículo, 15,00/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Ver la cesta/ }))
    const cesta = await screen.findByRole('complementary', { name: 'Tu cesta' })
    await user.click(within(cesta).getByRole('button', { name: 'Añadir una unidad de Medalla' }))
    expect(within(cesta).getByRole('button', { name: 'Añadir una unidad de Medalla' })).toBeDisabled()

    await pagarComo(user, /Pagar 30,00/)
    await waitFor(() => expect(enviado()).not.toBeNull())
    expect(enviado()).toEqual({ nombre: 'Ana Ruiz', email: 'ana@ejemplo.es', telefono: '600111222', metodo: 'TARJETA', lineas: [{ productoId: 1, cantidad: 2 }] })
    expect(await screen.findByText('Pantalla del pedido')).toBeInTheDocument()
  })

  it('un producto con tallas lleva a su ficha para elegirla', async () => {
    servidor()
    montar('/tienda')
    expect(await screen.findByRole('link', { name: 'Elegir la talla de Camiseta' })).toHaveAttribute('href', '/tienda/producto/3')
    expect(screen.getByRole('link', { name: 'Ver Camiseta' })).toHaveAttribute('href', '/tienda/producto/3')
  })

  it('la barra filtra por categoría y por precio, con el recuento en el título y las etiquetas para quitar', async () => {
    const user = userEvent.setup()
    servidor()
    montar('/tienda')
    const barra = await screen.findByRole('toolbar', { name: 'Filtrar y ordenar' })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tienda(3)')

    // Categoría: una sola; al elegirla, la hoja se cierra y el título la dice.
    await user.click(within(barra).getByRole('button', { name: 'Categoría' }))
    await user.click(within(await screen.findByRole('radiogroup', { name: 'Categoría' })).getByRole('radio', { name: /^Estampas/ }))
    await hojaCerrada()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Estampas(1)')
    expect(screen.queryByRole('link', { name: 'Medalla' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quitar Estampas' }))

    // Precio: varios tramos a la vez; la hoja se cierra con «Ver N productos».
    await user.click(within(barra).getByRole('button', { name: 'Precio' }))
    const precio = await screen.findByRole('group', { name: 'Precio' })
    await user.click(within(precio).getByRole('checkbox', { name: /^Hasta 5/ }))
    await user.click(within(precio).getByRole('checkbox', { name: /^Más de 30/ }))
    await user.click(screen.getByRole('button', { name: 'Ver 1 producto' }))
    await hojaCerrada()
    expect(screen.getByRole('link', { name: 'Estampa' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Medalla' })).not.toBeInTheDocument()
    expect(within(barra).getByRole('button', { name: 'Precio (2)' })).toBeInTheDocument()

    // Lo agotado, fuera, y con todo quitado vuelven todos.
    await user.click(within(barra).getByRole('switch', { name: 'Ocultar lo agotado' }))
    await user.click(screen.getByRole('button', { name: 'Quitar todo' }))
    expect(screen.getByRole('link', { name: 'Estampa' })).toBeInTheDocument()
    expect(within(barra).getByRole('switch', { name: 'Ocultar lo agotado' })).toHaveAttribute('aria-checked', 'false')
  })

  it('la talla solo deja lo que la tiene sin agotar, y sin productos con tallas no hay desplegable', async () => {
    const user = userEvent.setup()
    servidor()
    montar('/tienda')
    const barra = await screen.findByRole('toolbar', { name: 'Filtrar y ordenar' })
    await user.click(within(barra).getByRole('button', { name: 'Talla' }))
    const tallas = await screen.findByRole('group', { name: 'Talla' })
    expect(within(tallas).getAllByRole('button').map((b) => b.textContent)).toEqual(['S', 'L', 'XXL'])
    await user.click(within(tallas).getByRole('button', { name: 'XXL' }))
    await user.click(screen.getByRole('button', { name: 'Ver 0 productos' }))
    await hojaCerrada()
    expect(screen.getByText('No hay nada con esos filtros.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quitar filtros' }))
    expect(screen.getByRole('link', { name: 'Camiseta' })).toBeInTheDocument()
  })

  it('ordena por precio y por lo más reciente', async () => {
    const user = userEvent.setup()
    servidor()
    montar('/tienda')
    const barra = await screen.findByRole('toolbar', { name: 'Filtrar y ordenar' })
    const nombres = () => within(screen.getByRole('list', { name: 'Productos' })).getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(nombres()).toEqual(['Medalla', 'Estampa', 'Camiseta'])

    await user.click(within(barra).getByRole('button', { name: 'Ordenar por: Destacados' }))
    await user.click(within(await screen.findByRole('radiogroup', { name: 'Ordenar por' })).getByRole('radio', { name: 'Precio: de menor a mayor' }))
    await hojaCerrada()
    expect(nombres()).toEqual(['Estampa', 'Camiseta', 'Medalla'])

    await user.click(within(barra).getByRole('button', { name: 'Ordenar por: Precio: de menor a mayor' }))
    await user.click(within(await screen.findByRole('radiogroup', { name: 'Ordenar por' })).getByRole('radio', { name: 'Lo más reciente' }))
    await hojaCerrada()
    expect(nombres()).toEqual(['Camiseta', 'Estampa', 'Medalla'])
  })

  it('el producto destacado sale en grande solo en «Todo», y con un filtro vuelve a la rejilla', async () => {
    const user = userEvent.setup()
    servidor({ ...CATALOGO, productos: CATALOGO.productos.map((p) => (p.id === 1 ? { ...p, destacado: true } : p)) })
    montar('/tienda')
    expect(await screen.findByText('Destacado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Añadir · 15,00/ })).toBeInTheDocument()
    await user.click(within(screen.getByRole('toolbar', { name: 'Filtrar y ordenar' })).getByRole('button', { name: 'Categoría' }))
    await user.click(within(await screen.findByRole('radiogroup', { name: 'Categoría' })).getByRole('radio', { name: /^Medallas/ }))
    await hojaCerrada()
    expect(screen.queryByText('Destacado')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Añadir Medalla a la cesta' })).toBeInTheDocument()
  })

  it('en el destacado con tallas se elige la talla y se añade sin abrir la ficha', async () => {
    const user = userEvent.setup()
    const fotos = [{ url: '/uploads/camiseta-espalda.webp', pie: 'Espalda' }]
    servidor({ ...CATALOGO, productos: CATALOGO.productos.map((p) => (p.id === 3 ? { ...p, destacado: true, fotos } : p)) })
    montar('/tienda')
    // Sin talla elegida no se puede añadir: nadie ha pedido aún la S.
    expect(await screen.findByRole('button', { name: 'Elige una talla' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Talla XXL, agotada' })).toBeDisabled()

    // Las miniaturas cambian la foto grande.
    expect(screen.getByRole('button', { name: 'Ver la foto 1' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Ver la foto 2: Espalda' }))
    expect(screen.getByRole('button', { name: 'Ver la foto 2: Espalda' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Talla L' }))
    await user.click(screen.getByRole('button', { name: /^Añadir talla L · 12,00/ }))
    expect(screen.getByRole('button', { name: 'En la cesta · 1' })).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem('tienda-cesta') ?? '{}')).toEqual({ '3:31': 1 })
  })

  it('sin categorías no hay desplegable de categoría, pero sí el resto de la barra', async () => {
    servidor({ ...CATALOGO, categorias: [] })
    montar('/tienda')
    const barra = await screen.findByRole('toolbar', { name: 'Filtrar y ordenar' })
    expect(within(barra).queryByRole('button', { name: 'Categoría' })).not.toBeInTheDocument()
    expect(within(barra).getByRole('button', { name: 'Precio' })).toBeInTheDocument()
  })

  it('la ficha: se elige la talla (la agotada no), cuántas, y el pedido lleva la talla', async () => {
    const user = userEvent.setup()
    const enviado = servidor()
    montar('/tienda/producto/3')

    expect(await screen.findByRole('heading', { name: 'Camiseta', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Talla XXL, agotada' })).toBeDisabled()
    expect(screen.getByText(/Quedan 3 en la S\. La XXL, agotada\./)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Talla L' }))
    expect(screen.getByRole('button', { name: 'Talla L' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getAllByRole('button', { name: 'Añadir una unidad de Camiseta' })[0])
    await user.click(screen.getByRole('button', { name: /Añadir · 24,00/ }))

    await user.click(screen.getByRole('button', { name: /^Ver la cesta/ }))
    const cesta = await screen.findByRole('complementary', { name: 'Tu cesta' })
    expect(within(cesta).getByText(/Talla L/)).toBeInTheDocument()
    await pagarComo(user, /Pagar 24,00/)
    await waitFor(() => expect(enviado()).not.toBeNull())
    expect(enviado()?.lineas).toEqual([{ productoId: 3, tallaId: 31, cantidad: 2 }])
  })

  it('la ficha: la foto grande abre el visor con todas las fotos, y da la vuelta', async () => {
    const user = userEvent.setup()
    const medalla = { ...CATALOGO.productos[0], foto: '/uploads/medalla.webp', fotos: [{ url: '/uploads/reverso.webp', pie: 'El reverso' }, { url: '/uploads/caja.webp', pie: '' }] }
    servidor({ ...CATALOGO, productos: [medalla] })
    montar('/tienda/producto/1')

    await user.click(await screen.findByRole('button', { name: 'Ver la foto 2: El reverso' }))
    await user.click(screen.getByRole('button', { name: 'Ampliar la foto 2 de 3' }))
    const visor = await screen.findByRole('dialog')
    expect(await within(visor).findByText('El reverso')).toBeInTheDocument()
    // Pasada la última, vuelve a la primera (antes el visor se rompía).
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(within(screen.getByRole('dialog')).getByText('01')).toBeInTheDocument()
    await user.keyboard('{ArrowLeft}')
    expect(within(screen.getByRole('dialog')).getByText('03')).toBeInTheDocument()
  })

  it('la ficha: al cambiar de foto, la nueva se funde sobre la anterior, que luego se quita', async () => {
    const user = userEvent.setup()
    const medalla = { ...CATALOGO.productos[0], foto: '/uploads/medalla.webp', fotos: [{ url: '/uploads/reverso.webp', pie: 'El reverso' }] }
    servidor({ ...CATALOGO, productos: [medalla] })
    montar('/tienda/producto/1')
    await user.click(await screen.findByRole('button', { name: 'Ver la foto 2: El reverso' }))
    const grande = screen.getByRole('button', { name: 'Ampliar la foto 2 de 2' })
    expect(grande.querySelectorAll('img')).toHaveLength(2)
    expect(within(grande).getByRole('img', { name: 'El reverso' })).toBeInTheDocument()
    await waitFor(() => expect(grande.querySelectorAll('img')).toHaveLength(1))
  })

  it('un producto que ya no está dice que no está y lleva a la tienda', async () => {
    servidor()
    montar('/tienda/producto/99')
    expect(await screen.findByText('Ese producto ya no está a la venta.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver toda la tienda' })).toHaveAttribute('href', '/tienda')
  })

  it('una cesta guardada de antes pierde lo que ya no vale', async () => {
    // La medalla vale; la camiseta sin talla (de cuando no tenía tallas) y un producto borrado, no.
    window.localStorage.setItem('tienda-cesta', JSON.stringify({ 1: 1, 3: 2, 77: 1 }))
    const user = userEvent.setup()
    servidor()
    montar('/tienda')
    await user.click(await screen.findByRole('button', { name: /^Ver la cesta/ }))
    const cesta = await screen.findByRole('complementary', { name: 'Tu cesta' })
    expect(within(cesta).getByText('Medalla')).toBeInTheDocument()
    expect(within(cesta).queryByText('Camiseta')).not.toBeInTheDocument()
    expect(within(cesta).getAllByRole('listitem')).toHaveLength(1)
  })

  it('sin pasarela enseña el catálogo y dice que se compra en Secretaría', async () => {
    servidor({ ...CATALOGO, pagoDisponible: false })
    montar('/tienda')
    expect(await screen.findByText(/se compran en Secretaría/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Añadir/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Ver la cesta/ })).not.toBeInTheDocument()
  })
})

describe('PedidoTiendaPage', () => {
  it('pagado, dice que se recoja en Secretaría, con la talla de lo que la tiene', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({
      numero: 7, estado: 'PAGADO', total: 42, nombre: 'Ana',
      lineas: [{ nombre: 'Medalla', talla: null, precio: 15, cantidad: 2 }, { nombre: 'Camiseta', talla: 'L', precio: 12, cantidad: 1 }],
    })))
    renderWithProviders(<PedidoTiendaPage />, { ruta: '/tienda/pedido/abc' })
    expect(await screen.findByText(/Pedido pagado, Ana\. Recógelo en Secretaría/)).toBeInTheDocument()
    expect(screen.getByText('2 × Medalla')).toBeInTheDocument()
    expect(screen.getByText('1 × Camiseta (talla L)')).toBeInTheDocument()
  })

  it('si el banco dijo que no, lo dice y no espera', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ numero: 7, estado: 'PENDIENTE_PAGO', total: 30, nombre: 'Ana', lineas: [] })))
    renderWithProviders(<PedidoTiendaPage />, { ruta: '/tienda/pedido/abc?resultado=no' })
    expect(await screen.findByText(/El pago no se ha completado/)).toBeInTheDocument()
  })

  // Se agotó mientras pagaba: el banco cobró y el pedido no se pudo completar.
  // Antes decía «el banco aún no ha confirmado» y prometía un correo que no llegaba.
  it('cobrado con incidencia, dice que el pago llegó y que se devuelve el dinero, sin esperar', async () => {
    const simulado = vi.fn().mockImplementation(() => json({ numero: 7, estado: 'PENDIENTE_PAGO', pagoConIncidencia: true, total: 30, nombre: 'Ana', lineas: [] }))
    vi.stubGlobal('fetch', simulado)
    renderWithProviders(<PedidoTiendaPage />, { ruta: '/tienda/pedido/abc' })
    expect(await screen.findByText(/Pago recibido, pero no se ha podido completar: te devolvemos el dinero/)).toBeInTheDocument()
    expect(screen.queryByText(/Esperando la confirmación del banco/)).not.toBeInTheDocument()
    expect(simulado).toHaveBeenCalledTimes(1)
  })

  it('anulado, lo dice y explica qué pasa con el dinero', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => json({ numero: 7, estado: 'CANCELADO', pagoConIncidencia: false, total: 30, nombre: 'Ana', lineas: [] })))
    renderWithProviders(<PedidoTiendaPage />, { ruta: '/tienda/pedido/abc' })
    expect(await screen.findByText(/Este pedido está anulado/)).toBeInTheDocument()
    expect(screen.getByText(/si llegaste a pagarlo, te devolvemos el dinero/i)).toBeInTheDocument()
  })
})
