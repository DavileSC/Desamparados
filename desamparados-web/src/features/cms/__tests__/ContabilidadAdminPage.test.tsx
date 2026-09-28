import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import ContabilidadAdminPage from '../ContabilidadAdminPage'

afterEach(() => { vi.unstubAllGlobals() })

const RESUMEN = {
  totales: { ingresos: 12874, gastos: 6998, resultado: 5876, apuntesIngreso: 326, apuntesGasto: 54 },
  anterior: { desde: '2025-01-01', hasta: '2025-09-11', ingresos: 11495, gastos: 7422.5 },
  serie: { granularidad: 'mes', puntos: [{ clave: '2026-01', ingresos: 484, gastos: 883 }, { clave: '2026-02', ingresos: 1426, gastos: 772 }, { clave: '2026-03', ingresos: 4076, gastos: 931 }] },
  categorias: [
    { id: 1, nombre: 'Cuotas y papeletas', tipo: 'INGRESO', total: 10628, apuntes: 315 },
    { id: 6, nombre: 'Flores y exorno', tipo: 'GASTO', total: 2156, apuntes: 8 },
  ],
  porCobrar: { importe: 1254.5, recibos: 61, enElBanco: 300 },
}

// El primero viene de un recibo (se corrige desde el recibo); el segundo es manual.
const APUNTES = [
  { id: 1, tipo: 'INGRESO', concepto: 'Cuota anual', importe: '18', fecha: '2026-09-11T00:00:00.000Z', metodoPago: 'EFECTIVO', categoriaId: 1, reciboId: 5, categoria: { nombre: 'Cuotas y papeletas' }, hermano: { nombre: 'Juan', apellidos: 'El Cofrade' } },
  { id: 2, tipo: 'GASTO', concepto: 'Exorno floral', importe: '342', fecha: '2026-08-09T10:00:00.000Z', metodoPago: 'TRANSFERENCIA', categoriaId: 6, reciboId: null, categoria: { nombre: 'Flores y exorno' }, hermano: null },
]

const CATEGORIAS = [
  { id: 1, nombre: 'Cuotas y papeletas', tipo: 'INGRESO', activa: true, deRecibos: true },
  { id: 3, nombre: 'Donativos', tipo: 'INGRESO', activa: true, deRecibos: false },
  { id: 4, nombre: 'Rifas antiguas', tipo: 'INGRESO', activa: false, deRecibos: false },
  { id: 6, nombre: 'Flores y exorno', tipo: 'GASTO', activa: true, deRecibos: false },
]

// mockImplementation, no mockResolvedValue: la pantalla lanza varios fetch a la
// vez, cada uno con su forma, y una misma Response no se puede leer dos veces.
// Se responde por URL, nunca por el orden de las llamadas.
function servir(totalApuntes = APUNTES.length) {
  const simulado = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const ruta = String(url)
    const lectura = !init?.method || init.method === 'GET'
    const cuerpo = !lectura ? { message: 'ok' }
      : ruta.includes('libro-mayor')
      ? { data: APUNTES, meta: { total: totalApuntes, page: 1, limit: 20, totalPages: Math.max(1, Math.ceil(totalApuntes / 20)) } }
      : ruta.includes('resumen') ? RESUMEN
      : ruta.includes('categorias') ? CATEGORIAS
      : {}
    return Promise.resolve(new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  })
  vi.stubGlobal('fetch', simulado)
  return simulado
}

const ultima = (simulado: ReturnType<typeof servir>, trozo: string) =>
  String(simulado.mock.calls.map(([url]) => String(url)).filter((url) => url.includes(trozo)).at(-1))

/** La última escritura (POST, PUT, PATCH, DELETE) que ha hecho la pantalla. */
const escritura = (simulado: ReturnType<typeof servir>) => {
  const llamada = simulado.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET').at(-1)
  if (!llamada) return null
  const [url, init] = llamada as [string, RequestInit]
  return { url: String(url), metodo: init.method, cuerpo: init.body ? JSON.parse(String(init.body)) : null }
}

const hoy = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Elige una opción de un desplegable de MUI por su etiqueta. */
async function elegir(user: ReturnType<typeof userEvent.setup>, dentro: HTMLElement, etiqueta: RegExp, opcion: string | RegExp) {
  await user.click(within(dentro).getByRole('combobox', { name: etiqueta }))
  await user.click(await screen.findByRole('option', { name: opcion }))
}

describe('ContabilidadAdminPage', () => {
  it('dice cuántos movimientos hay en total', async () => {
    servir(1278)
    renderWithProviders(<ContabilidadAdminPage />)
    expect(await screen.findByText(/de 1278/i)).toBeInTheDocument()
  })

  it('las cifras salen del resumen y el resultado se lee como superávit, sin signos', async () => {
    servir()
    renderWithProviders(<ContabilidadAdminPage />)

    const cifras = await screen.findByRole('region', { name: /cifras del periodo/i })
    expect(within(cifras).getByText('12.874 €')).toBeInTheDocument()
    expect(within(cifras).getByText('6.998 €')).toBeInTheDocument()
    expect(within(cifras).getByText('5.876 €')).toBeInTheDocument()
    expect(within(cifras).getByText(/superávit/i)).toBeInTheDocument()
    expect(within(cifras).getByText(/11\.495 €/)).toBeInTheDocument()
  })

  it('cada importe va en su columna, ingreso o gasto, sin «+» ni «−»', async () => {
    servir()
    renderWithProviders(<ContabilidadAdminPage />)

    const fila = await screen.findByRole('row', { name: /exorno floral/i })
    const celdas = within(fila).getAllByRole('cell')
    // La última columna es la de acciones; antes van Ingreso y Gasto.
    expect(celdas.at(-2)).toHaveTextContent('342,00 €')
    expect(celdas.at(-3)).toHaveTextContent('')
    expect(fila).not.toHaveTextContent(/[+−-]\s?342/)
    const libro = screen.getByRole('table', { name: /libro de caja/i })
    expect(within(libro).getByRole('columnheader', { name: /^ingreso$/i })).toBeInTheDocument()
    expect(within(libro).getByRole('columnheader', { name: /^gasto$/i })).toBeInTheDocument()
  })

  it('por defecto pide el año en curso hasta hoy, al libro y al resumen', async () => {
    const simulado = servir()
    renderWithProviders(<ContabilidadAdminPage />)

    await waitFor(() => expect(ultima(simulado, 'libro-mayor')).toContain(`desde=${new Date().getFullYear()}-01-01`))
    expect(ultima(simulado, 'libro-mayor')).toContain(`hasta=${hoy()}`)
    expect(ultima(simulado, 'resumen')).toContain(`desde=${new Date().getFullYear()}-01-01`)
  })

  it('los filtros de la URL llegan al libro y al resumen', async () => {
    const simulado = servir()
    renderWithProviders(<ContabilidadAdminPage />, { ruta: '/cms/contabilidad?tipo=GASTO&periodo=todo&q=flores' })

    await waitFor(() => expect(ultima(simulado, 'libro-mayor')).toContain('tipo=GASTO'))
    for (const trozo of ['libro-mayor', 'resumen']) {
      expect(ultima(simulado, trozo)).toContain('tipo=GASTO')
      expect(ultima(simulado, trozo)).toContain('q=flores')
      expect(ultima(simulado, trozo)).not.toContain('desde=')
    }
  })

  it('con «Hasta» antes de «Desde» avisa y no pide nada (el servidor respondería 400)', async () => {
    const simulado = servir()
    renderWithProviders(<ContabilidadAdminPage />, { ruta: '/cms/contabilidad?periodo=personalizado&desde=2026-05-01&hasta=2026-01-31' })

    expect(await screen.findByText(/«Hasta» es anterior a «Desde»/i)).toBeInTheDocument()
    expect(screen.getByText('Es anterior a «Desde»')).toBeInTheDocument()
    // Las categorías sí se cargan (hacen falta para los filtros); el libro y el resumen, no.
    await waitFor(() => expect(ultima(simulado, 'categorias')).toContain('todas=true'))
    expect(simulado.mock.calls.some(([url]) => /libro-mayor|resumen/.test(String(url)))).toBe(false)
  })

  it('elegir «Gastos» filtra y vuelve a la primera página', async () => {
    const user = userEvent.setup()
    const simulado = servir(120)
    renderWithProviders(<ContabilidadAdminPage />, { ruta: '/cms/contabilidad?pagina=3' })

    await waitFor(() => expect(ultima(simulado, 'libro-mayor')).toContain('page=3'))
    await user.click(screen.getByRole('button', { name: /^gastos$/i }))

    await waitFor(() => expect(ultima(simulado, 'libro-mayor')).toContain('tipo=GASTO'))
    expect(ultima(simulado, 'libro-mayor')).toContain('page=1')
  })

  it('pinchar una categoría del reparto filtra por ella, y la etiqueta la quita', async () => {
    const user = userEvent.setup()
    const simulado = servir()
    renderWithProviders(<ContabilidadAdminPage />)

    const reparto = await screen.findByRole('region', { name: /de dónde viene y a dónde va/i })
    await user.click(await within(reparto).findByRole('button', { name: /flores y exorno/i }))
    await waitFor(() => expect(ultima(simulado, 'libro-mayor')).toContain('categorias=6'))

    await user.click(screen.getByRole('button', { name: /quitar el filtro categoría/i }))
    await waitFor(() => expect(ultima(simulado, 'libro-mayor')).not.toContain('categorias='))
  })

  it('busca por concepto o hermano', async () => {
    const user = userEvent.setup()
    const simulado = servir()
    renderWithProviders(<ContabilidadAdminPage />)

    await user.type(await screen.findByRole('textbox', { name: /buscar/i }), 'juan')
    await waitFor(() => expect(ultima(simulado, 'libro-mayor')).toContain('q=juan'))
  })

  it('apunte y categorías van cada uno en su ventana, y la categoría se da de alta dentro de la suya', async () => {
    const user = userEvent.setup()
    const simulado = servir()
    renderWithProviders(<ContabilidadAdminPage />)

    await user.click(await screen.findByRole('button', { name: /nuevo apunte/i }))
    expect(screen.getByRole('dialog', { name: /nuevo apunte/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/concepto/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    // Con la ventana abierta, MUI esconde el resto de la pantalla a la accesibilidad.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^categorías$/i }))
    const gestion = await screen.findByRole('dialog', { name: /^categorías$/i })
    await user.click(within(gestion).getByRole('button', { name: /añadir categoría de gasto/i }))
    await user.type(within(gestion).getByLabelText(/nombre de la nueva categoría de gasto/i), 'Banda de música')
    await user.click(within(gestion).getByRole('button', { name: /crear la categoría/i }))
    await waitFor(() => expect(escritura(simulado)).toEqual({ url: '/api/transacciones/categorias', metodo: 'POST', cuerpo: { nombre: 'Banda de música', tipo: 'GASTO' } }))
    // Sin segunda ventana encima.
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })
})

// Los dos tests que rellenan la ventana entera tecla a tecla tardan unos 3 s
// solos; con la suite completa en paralelo pasaban de los 5 s por defecto.
const RELLENAR_VENTANA_MS = 15_000

describe('apuntes manuales (D8)', () => {
  it('el nuevo apunte pide fecha (hoy por defecto) y método, y los manda', { timeout: RELLENAR_VENTANA_MS }, async () => {
    const user = userEvent.setup()
    const simulado = servir()
    renderWithProviders(<ContabilidadAdminPage />)

    await user.click(await screen.findByRole('button', { name: /nuevo apunte/i }))
    const ventana = screen.getByRole('dialog', { name: /nuevo apunte/i })
    expect(within(ventana).getByLabelText(/fecha/i)).toHaveValue(hoy())

    await elegir(user, ventana, /categoría/i, 'Donativos')
    await user.type(within(ventana).getByLabelText(/concepto/i), 'Donativo anónimo')
    await user.type(within(ventana).getByLabelText(/importe/i), '50.25')
    // Sin método no se puede registrar: un apunte sin método desaparece al filtrar por método.
    expect(within(ventana).getByRole('button', { name: 'Registrar' })).toBeDisabled()
    await elegir(user, ventana, /método de pago/i, 'Bizum')
    await user.clear(within(ventana).getByLabelText(/fecha/i))
    await user.type(within(ventana).getByLabelText(/fecha/i), '2026-03-29')

    await user.click(within(ventana).getByRole('button', { name: 'Registrar' }))
    await waitFor(() => expect(escritura(simulado)?.metodo).toBe('POST'))
    expect(escritura(simulado)).toEqual({
      url: '/api/transacciones',
      metodo: 'POST',
      cuerpo: { tipo: 'INGRESO', categoriaId: 3, concepto: 'Donativo anónimo', importe: 50.25, fecha: '2026-03-29', metodoPago: 'BIZUM' },
    })
    expect(await screen.findByText(/transacción registrada/i)).toBeInTheDocument()
  })

  it('no ofrece categorías desactivadas al apuntar', async () => {
    const user = userEvent.setup()
    servir()
    renderWithProviders(<ContabilidadAdminPage />)

    await user.click(await screen.findByRole('button', { name: /nuevo apunte/i }))
    const ventana = screen.getByRole('dialog', { name: /nuevo apunte/i })
    await user.click(within(ventana).getByRole('combobox', { name: /categoría/i }))
    expect(await screen.findByRole('option', { name: 'Donativos' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /rifas antiguas/i })).not.toBeInTheDocument()
  })

  it('un importe con tres decimales o una fecha futura se avisan en el campo y no se registran', { timeout: RELLENAR_VENTANA_MS }, async () => {
    const user = userEvent.setup()
    servir()
    renderWithProviders(<ContabilidadAdminPage />)

    await user.click(await screen.findByRole('button', { name: /nuevo apunte/i }))
    const ventana = screen.getByRole('dialog', { name: /nuevo apunte/i })
    await elegir(user, ventana, /categoría/i, 'Donativos')
    await elegir(user, ventana, /método de pago/i, 'Efectivo')
    await user.type(within(ventana).getByLabelText(/concepto/i), 'Donativo anónimo')
    await user.type(within(ventana).getByLabelText(/importe/i), '12.345')
    expect(within(ventana).getByText('Como mucho dos decimales.')).toBeInTheDocument()
    expect(within(ventana).getByRole('button', { name: 'Registrar' })).toBeDisabled()

    await user.clear(within(ventana).getByLabelText(/importe/i))
    await user.type(within(ventana).getByLabelText(/importe/i), '12.34')
    await user.clear(within(ventana).getByLabelText(/fecha/i))
    await user.type(within(ventana).getByLabelText(/fecha/i), `${new Date().getFullYear() + 1}-01-01`)
    expect(within(ventana).getByText('No puede ser posterior a hoy.')).toBeInTheDocument()
    expect(within(ventana).getByRole('button', { name: 'Registrar' })).toBeDisabled()
  })

  it('un apunte de recibo no se corrige desde aquí; uno manual, sí', async () => {
    servir()
    renderWithProviders(<ContabilidadAdminPage />)

    const deRecibo = await screen.findByRole('row', { name: /cuota anual/i })
    expect(within(deRecibo).queryByRole('button', { name: /corregir|borrar/i })).not.toBeInTheDocument()
    // Lleva al recibo, en Tesorería, que es donde se corrige.
    expect(within(deRecibo).getByRole('link', { name: 'Abrir el recibo #5 en Tesorería' })).toHaveAttribute('href', '/cms/tesoreria?recibo=5')

    const manual = screen.getByRole('row', { name: /exorno floral/i })
    expect(within(manual).getByRole('button', { name: 'Corregir «Exorno floral»' })).toBeInTheDocument()
    expect(within(manual).getByRole('button', { name: 'Borrar «Exorno floral»' })).toBeInTheDocument()
  })

  it('dice lo que falta por cobrar y lleva a los pendientes de Tesorería', async () => {
    servir()
    renderWithProviders(<ContabilidadAdminPage />)

    const cifras = await screen.findByRole('region', { name: 'Cifras del periodo' })
    expect(within(cifras).getByText(/61 recibos de todos los años, 300\s€ en el banco/)).toBeInTheDocument()
    expect(within(cifras).getByRole('link', { name: 'Ver en Tesorería' })).toHaveAttribute('href', '/cms/tesoreria?estado=PENDIENTE&anio=todos')
  })

  it('al llegar desde un recibo enseña solo sus apuntes y deja volver al libro entero', async () => {
    const user = userEvent.setup()
    const simulado = servir()
    renderWithProviders(<ContabilidadAdminPage />, { ruta: '/cms/contabilidad?recibo=5&tipo=GASTO' })

    expect(await screen.findByText(/Apuntes del recibo #5/)).toBeInTheDocument()
    expect(ultima(simulado, 'libro-mayor')).toContain('recibo=5')
    expect(ultima(simulado, 'libro-mayor')).not.toContain('tipo=')
    expect(screen.getByRole('link', { name: 'Ver el recibo' })).toHaveAttribute('href', '/cms/tesoreria?recibo=5')

    await user.click(screen.getByRole('button', { name: 'Todo el libro' }))
    expect(screen.queryByText(/Apuntes del recibo #5/)).not.toBeInTheDocument()
    expect(ultima(simulado, 'libro-mayor')).not.toContain('recibo=')
  })

  it('corregir abre el apunte relleno y manda el cambio con PUT', async () => {
    const user = userEvent.setup()
    const simulado = servir()
    renderWithProviders(<ContabilidadAdminPage />)

    await user.click(await screen.findByRole('button', { name: 'Corregir «Exorno floral»' }))
    const ventana = screen.getByRole('dialog', { name: /corregir apunte/i })
    expect(within(ventana).getByLabelText(/concepto/i)).toHaveValue('Exorno floral')
    expect(within(ventana).getByLabelText(/importe/i)).toHaveValue(342)
    expect(within(ventana).getByLabelText(/fecha/i)).toHaveValue('2026-08-09')
    // Sin cambios no hay nada que guardar.
    expect(within(ventana).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()

    await user.clear(within(ventana).getByLabelText(/importe/i))
    await user.type(within(ventana).getByLabelText(/importe/i), '34.20')
    await user.click(within(ventana).getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(escritura(simulado)?.metodo).toBe('PUT'))
    expect(escritura(simulado)).toEqual({
      url: '/api/transacciones/2',
      metodo: 'PUT',
      cuerpo: { tipo: 'GASTO', categoriaId: 6, concepto: 'Exorno floral', importe: 34.2, fecha: '2026-08-09', metodoPago: 'TRANSFERENCIA' },
    })
    expect(await screen.findByText('Apunte corregido.')).toBeInTheDocument()
  })

  it('borrar pregunta antes y manda DELETE', async () => {
    const user = userEvent.setup()
    const simulado = servir()
    renderWithProviders(<ContabilidadAdminPage />)

    await user.click(await screen.findByRole('button', { name: 'Borrar «Exorno floral»' }))
    const confirmar = screen.getByRole('dialog', { name: /¿borrar el apunte\?/i })
    expect(confirmar).toHaveTextContent('342,00 €')
    expect(escritura(simulado)).toBeNull()

    await user.click(within(confirmar).getByRole('button', { name: 'Borrar' }))
    await waitFor(() => expect(escritura(simulado)).toEqual({ url: '/api/transacciones/2', metodo: 'DELETE', cuerpo: null }))
    expect(await screen.findByText('Apunte borrado.')).toBeInTheDocument()
  })
})

describe('gestión de categorías (D8)', () => {
  it('renombra una categoría', async () => {
    const user = userEvent.setup()
    const simulado = servir()
    renderWithProviders(<ContabilidadAdminPage />)

    await user.click(await screen.findByRole('button', { name: /^categorías$/i }))
    const gestion = await screen.findByRole('dialog', { name: /^categorías$/i })
    await user.click(within(gestion).getByRole('button', { name: 'Más acciones de «Flores y exorno»' }))
    await user.click(await screen.findByRole('menuitem', { name: /renombrar/i }))
    const campo = within(gestion).getByLabelText(/nuevo nombre de «flores y exorno»/i)
    await user.clear(campo)
    await user.type(campo, 'ab')
    expect(within(gestion).getByText('Al menos 3 caracteres.')).toBeInTheDocument()
    await user.type(campo, 'c exorno')
    await user.click(within(gestion).getByRole('button', { name: 'Guardar el nombre' }))

    await waitFor(() => expect(escritura(simulado)).toEqual({ url: '/api/transacciones/categorias/6', metodo: 'PUT', cuerpo: { nombre: 'abc exorno' } }))
  })

  it('desactiva y reactiva, y las de los recibos no se ofrecen para renombrar', async () => {
    const user = userEvent.setup()
    const simulado = servir()
    renderWithProviders(<ContabilidadAdminPage />)

    await user.click(await screen.findByRole('button', { name: /^categorías$/i }))
    const gestion = await screen.findByRole('dialog', { name: /^categorías$/i })
    expect(within(gestion).getByRole('img', { name: /la usan los recibos/i })).toBeInTheDocument()
    await user.click(within(gestion).getByRole('button', { name: 'Más acciones de «Cuotas y papeletas»' }))
    expect(await screen.findByRole('menuitem', { name: /desactivar/i })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /renombrar/i })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())

    await user.click(within(gestion).getByRole('button', { name: 'Más acciones de «Donativos»' }))
    await user.click(await screen.findByRole('menuitem', { name: /desactivar/i }))
    await waitFor(() => expect(escritura(simulado)).toEqual({ url: '/api/transacciones/categorias/3/activa', metodo: 'PATCH', cuerpo: { activa: false } }))

    // Las desactivadas van plegadas al final.
    await user.click(within(gestion).getByRole('button', { name: /desactivadas \(1\)/i }))
    await user.click(await within(gestion).findByRole('button', { name: 'Reactivar «Rifas antiguas»' }))
    await waitFor(() => expect(escritura(simulado)).toEqual({ url: '/api/transacciones/categorias/4/activa', metodo: 'PATCH', cuerpo: { activa: true } }))
  })

  it('el orden va al libro de caja y no al resumen, y vuelve a la primera página', async () => {
    const user = userEvent.setup()
    const simulado = servir(120)
    renderWithProviders(<ContabilidadAdminPage />, { ruta: '/cms/contabilidad?pagina=3' })

    await waitFor(() => expect(ultima(simulado, 'libro-mayor')).toContain('page=3'))
    await elegir(user, document.body, /ordenar por/i, /importe: mayor primero/i)

    await waitFor(() => expect(ultima(simulado, 'libro-mayor')).toContain('orden=importeDesc'))
    expect(ultima(simulado, 'libro-mayor')).toContain('page=1')
    expect(ultima(simulado, 'resumen')).not.toContain('orden=')
  })

  it('«Quitar todos» deja los filtros como al entrar', async () => {
    const user = userEvent.setup()
    const simulado = servir()
    renderWithProviders(<ContabilidadAdminPage />, { ruta: '/cms/contabilidad?periodo=todo&metodo=BIZUM&q=flores' })

    await user.click(await screen.findByRole('button', { name: /quitar todos/i }))
    await waitFor(() => expect(ultima(simulado, 'libro-mayor')).toContain(`desde=${new Date().getFullYear()}-01-01`))
    expect(ultima(simulado, 'libro-mayor')).not.toMatch(/metodo=|q=/)
  })
})
