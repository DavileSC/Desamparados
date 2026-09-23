import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import { TemaCmsProvider } from '../../../app/temaCms'
import AgendaAdminPage from '../AgendaAdminPage'

const montar = (ruta = '/cms/agenda') => renderWithProviders(<TemaCmsProvider><AgendaAdminPage /></TemaCmsProvider>, { ruta })

const evento = {
  id: 3, title: 'Besapiés', description: null, location: 'Parroquia',
  startDate: '2026-09-12T18:00:00.000Z', endDate: null, type: 'CULTO',
}
const cabildo = {
  id: 4, title: 'Cabildo de cuentas', description: 'Aprobación del ejercicio.', location: null,
  startDate: '2026-09-20T18:00:00.000Z', endDate: null, type: 'REUNION',
}
const triduo = {
  id: 5, title: 'Triduo', description: 'Tres días de culto.', location: 'Parroquia',
  startDate: '2026-10-20T18:00:00.000Z', endDate: '2026-10-22T19:00:00.000Z', type: 'CULTO',
}

const resumenBase = { proximos: 3, pasados: 12, siguiente: null, portada: { limite: 5, ids: [3] } }

/**
 * Una instancia de Response por llamada: `llamarApi` lee el cuerpo con
 * `res.text()` y reutilizar la misma la dejaría consumida en la segunda.
 */
function responder(data: unknown[], meta: Record<string, number>, resumen: Record<string, unknown> = resumenBase) {
  const simulado = vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify({ data, meta, resumen }), { status: 200, headers: { 'Content-Type': 'application/json' } },
  )))
  vi.stubGlobal('fetch', simulado)
  return simulado
}

const ultimaPeticion = (simulado: ReturnType<typeof responder>) => String(simulado.mock.calls.at(-1)?.[0])

afterEach(() => {
  vi.unstubAllGlobals()
  // `cambiarTamano` recuerda la preferencia en sessionStorage: sin limpiarla, el
  // tamaño elegido en un test sería el de partida del siguiente.
  window.sessionStorage.clear()
})

describe('AgendaAdminPage', () => {
  it('«Nuevo evento» lleva a la ficha, no a una ventana', async () => {
    responder([evento], { total: 1, page: 1, limit: 20, totalPages: 1 })
    montar()

    expect(await screen.findByRole('heading', { name: 'Besapiés' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /nuevo evento/i })).toHaveAttribute('href', '/cms/agenda/nuevo')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cada acto dice su tipo con el nombre de la web, quién lo ve y qué le falta', async () => {
    responder([evento, cabildo], { total: 2, page: 1, limit: 20, totalPages: 1 })
    montar()

    const besapies = (await screen.findByRole('heading', { name: 'Besapiés' })).closest('li')!
    expect(within(besapies).getAllByText('Culto').length).toBeGreaterThan(0)
    expect(within(besapies).getByText('Sin descripción')).toBeInTheDocument()
    expect(within(besapies).queryByText('Sin lugar')).not.toBeInTheDocument()
    expect(within(besapies).getByText('En portada')).toBeInTheDocument()

    const reunion = screen.getByRole('heading', { name: 'Cabildo de cuentas' }).closest('li')!
    expect(within(reunion).getAllByText('Reunión').length).toBeGreaterThan(0)
    expect(within(reunion).getByText('Sin lugar')).toBeInTheDocument()
    expect(within(reunion).queryByText('En portada')).not.toBeInTheDocument()
  })

  it('agrupa por meses y un acto de varios días enseña los dos', async () => {
    responder([evento, triduo], { total: 2, page: 1, limit: 20, totalPages: 1 })
    montar()

    expect(await screen.findByRole('heading', { name: /^septiembre/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^octubre/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Triduo' }).closest('li')).toHaveTextContent('20–22')
  })

  it('marca con una raya dónde acaba lo que sale en la portada', async () => {
    responder([evento, cabildo], { total: 2, page: 1, limit: 20, totalPages: 1 })
    montar()

    expect(await screen.findByText('Hasta aquí sale en la portada: el próximo acto.')).toBeInTheDocument()
  })

  it('en la cabecera dice cuál es el siguiente', async () => {
    const manana = new Date()
    manana.setDate(manana.getDate() + 1)
    manana.setHours(20, 0, 0, 0)
    responder([evento], { total: 1, page: 1, limit: 20, totalPages: 1 }, {
      ...resumenBase, siguiente: { id: 3, title: 'Besapiés', startDate: manana.toISOString() },
    })
    montar()

    expect(await screen.findByText('Lo siguiente: Besapiés, mañana a las 20:00')).toBeInTheDocument()
  })

  it('pinta los eventos que llegan en data y ofrece pasar de página', async () => {
    responder([evento], { total: 45, page: 1, limit: 20, totalPages: 3 })
    montar()

    expect(await screen.findByRole('heading', { name: 'Besapiés' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ir a la página 2/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /editar besapiés/i })).toHaveAttribute('href', '/cms/agenda/3/editar')
  })

  it('«Duplicar» abre una ficha nueva que parte del evento', async () => {
    const usuario = userEvent.setup()
    responder([evento], { total: 1, page: 1, limit: 20, totalPages: 1 })
    montar()

    await usuario.click(await screen.findByRole('button', { name: /más acciones para besapiés/i }))
    expect(screen.getByRole('menuitem', { name: /duplicar/i })).toHaveAttribute('href', '/cms/agenda/nuevo')
  })

  it('pide la página que dice la URL', async () => {
    const simulado = responder([], { total: 60, page: 2, limit: 20, totalPages: 3 })
    montar('/cms/agenda?pagina=2')

    await waitFor(() => expect(ultimaPeticion(simulado)).toContain('page=2'))
  })

  it('el CMS pide su propio listado, el que incluye los eventos pasados', async () => {
    const simulado = responder([evento], { total: 1, page: 1, limit: 20, totalPages: 1 })
    montar()

    await waitFor(() => expect(ultimaPeticion(simulado)).toContain('/events/admin?'))
    expect(ultimaPeticion(simulado)).toContain('periodo=proximos')
    expect(screen.getByRole('button', { name: /próximos/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('«Pasados» pide los pasados desde la primera página, con su cifra', async () => {
    // Un evento fechado por error en el pasado desaparecía del CMS: sin esta
    // pestaña no había forma de corregirlo ni de borrarlo.
    const usuario = userEvent.setup()
    const simulado = responder([evento], { total: 60, page: 2, limit: 20, totalPages: 3 })
    montar('/cms/agenda?pagina=2')
    await waitFor(() => expect(ultimaPeticion(simulado)).toContain('page=2'))

    await usuario.click(await screen.findByRole('button', { name: /pasados\s*12/i }))

    await waitFor(() => expect(ultimaPeticion(simulado)).toContain('periodo=pasados'))
    expect(ultimaPeticion(simulado)).toContain('page=1')
    expect(screen.getByRole('button', { name: /pasados/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('con ?periodo=pasados en la URL (al volver de editar) abre esa pestaña', async () => {
    const simulado = responder([], { total: 0, page: 1, limit: 20, totalPages: 0 })
    montar('/cms/agenda?periodo=pasados')

    await waitFor(() => expect(ultimaPeticion(simulado)).toContain('periodo=pasados'))
    expect(await screen.findByText('No hay eventos pasados')).toBeInTheDocument()
  })

  it('el tipo viaja al servidor, y sin resultados se puede quitar', async () => {
    const usuario = userEvent.setup()
    const simulado = responder([], { total: 0, page: 1, limit: 20, totalPages: 0 })
    montar('/cms/agenda?tipo=ENSAYO')

    await waitFor(() => expect(ultimaPeticion(simulado)).toContain('tipo=ENSAYO'))
    expect(await screen.findByText('Ningún evento próximo con estos filtros.')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: /quitar los filtros/i }))
    await waitFor(() => expect(ultimaPeticion(simulado)).not.toContain('tipo='))
  })

  it('al elegir otro tamaño en el selector, la petición lo lleva como limit', async () => {
    // La cadena entera —abrir el selector, elegir 50, que llegue al servidor
    // como limit=50— no estaba cubierta en ningún punto: el Paginador ya
    // comprueba que avisa, y esto comprueba que el aviso llega a la petición.
    // Vivía en la agenda pública hasta que el selector quedó solo para el CMS.
    const simulado = responder([evento], { total: 45, page: 1, limit: 20, totalPages: 3 })
    const usuario = userEvent.setup()
    montar()

    expect(await screen.findByRole('heading', { name: 'Besapiés' })).toBeInTheDocument()
    await waitFor(() => expect(ultimaPeticion(simulado)).toContain('limit=20'))

    await usuario.click(screen.getByLabelText(/resultados por página/i))
    await usuario.click(await screen.findByRole('option', { name: '50' }))

    await waitFor(() => expect(ultimaPeticion(simulado)).toContain('limit=50'))
    // Y la preferencia queda guardada para el resto de la sesión.
    expect(window.sessionStorage.getItem('desamparados:porPagina')).toBe('50')
  })
})
