import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import ModulosAdminPage from '../ModulosAdminPage'
import CATALOGO from '../../../../../shared/modulos.json'

const json = (cuerpo: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }))

const lista = (apagados: string[] = []) => CATALOGO.modulos.map((m) => ({
  ...m, activo: !apagados.includes(m.clave), cambiadoEl: null, cambiadoPor: null,
  datos: m.clave === 'tienda' ? [{ que: 'productos', total: 12 }, { que: 'ventas de caja', total: 40 }] : [],
}))

/**
 * Un servidor de mentira: la lista, y un PUT que responde lo que diga `alCambiar`.
 * Cuando la respuesta es `ok`, el estado se actualiza con lo que ella misma dice
 * (`cambiados`, que el backend enciende todos a una): mirar solo la clave de la
 * URL se queda corto en «encender con requisitos», donde una sola llamada
 * enciende más de un módulo.
 */
function servidor(apagados: string[], alCambiar: (clave: string, body: { activo: boolean; conRequisitos?: boolean }) => Promise<Response>) {
  let estado = apagados
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const ruta = String(url)
    if (init?.method === 'PUT') {
      const clave = ruta.split('/').pop()!
      const body = JSON.parse(String(init.body)) as { activo: boolean; conRequisitos?: boolean }
      return alCambiar(clave, body).then(async (r) => {
        if (r.ok) {
          const { cambiados } = (await r.clone().json()) as { cambiados?: string[] }
          estado = body.activo ? estado.filter((c) => !(cambiados ?? [clave]).includes(c)) : [...estado, clave]
        }
        return r
      })
    }
    if (ruta.endsWith('/cms/modulos')) return json(lista(estado))
    if (ruta.endsWith('/modulos')) return json({ activos: CATALOGO.modulos.map((m) => m.clave).filter((c) => !estado.includes(c)) })
    return json({ message: 'no esperado' }, 500)
  })
}

afterEach(() => { vi.unstubAllGlobals() })

describe('ModulosAdminPage', () => {
  it('lista los módulos por grupo, con su interruptor y sus datos', async () => {
    vi.stubGlobal('fetch', servidor(['loteria'], () => json({ ok: true })))
    renderWithProviders(<ModulosAdminPage />)
    expect(await screen.findByRole('heading', { name: 'Módulos' })).toBeInTheDocument()
    // El título es fijo y sale desde el primer render; lo que depende de la
    // consulta (los grupos, los interruptores) se espera aparte.
    expect(await screen.findByRole('heading', { name: 'Cuentas' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Tienda' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Lotería y talonarios' })).not.toBeChecked()
    expect(screen.getByText('12 productos, 40 ventas de caja')).toBeInTheDocument()
    expect(screen.getByText(/Requiere: Tienda, Pago en línea/)).toBeInTheDocument()
  })

  it('apagar pide confirmación con los datos que se ocultan, y luego apaga', async () => {
    const user = userEvent.setup({ delay: null })
    const put = vi.fn(() => json({ ok: true, cambiados: ['tienda'], activos: [] }))
    vi.stubGlobal('fetch', servidor(['tienda-web'], put))
    renderWithProviders(<ModulosAdminPage />)
    await user.click(await screen.findByRole('switch', { name: 'Tienda' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText(/12 productos, 40 ventas de caja/)).toBeInTheDocument()
    expect(within(dialogo).getByText(/se conservan/i)).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: /apagar/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(put).toHaveBeenCalledWith('tienda', { activo: false, conRequisitos: false })
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Tienda' })).not.toBeChecked())
  })

  it('apagar algo que otros necesitan: el servidor dice que no y la pantalla dice cuáles', async () => {
    const user = userEvent.setup({ delay: null })
    vi.stubGlobal('fetch', servidor([], () => json({ status: 'error', message: 'No se puede apagar «Pago en línea»: lo necesitan «Donativos en línea».', faltan: [], dependientes: ['donativos'] }, 400)))
    renderWithProviders(<ModulosAdminPage />)
    await user.click(await screen.findByRole('switch', { name: 'Pago en línea' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /apagar/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/lo necesitan «Donativos en línea»/)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('switch', { name: 'Pago en línea' })).toBeChecked()
  })

  it('encender con requisitos apagados propone encenderlos en el mismo paso', async () => {
    const user = userEvent.setup({ delay: null })
    const put = vi.fn((_clave: string, body: { activo: boolean; conRequisitos?: boolean }) =>
      body.conRequisitos ? json({ ok: true, cambiados: ['tienda', 'tienda-web'], activos: [] }) : json({ status: 'error', message: 'Para encender «Tienda en la web» hay que encender también «Tienda».', faltan: ['tienda'], dependientes: [] }, 400))
    vi.stubGlobal('fetch', servidor(['tienda', 'tienda-web'], put))
    renderWithProviders(<ModulosAdminPage />)
    await user.click(await screen.findByRole('switch', { name: 'Tienda en la web' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText(/encender también/i)).toHaveTextContent('Tienda')
    await user.click(within(dialogo).getByRole('button', { name: /encender/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(put).toHaveBeenLastCalledWith('tienda-web', { activo: true, conRequisitos: true })
    expect(put).toHaveBeenCalledTimes(2) // el intento sin requisitos, y el definitivo con ellos
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Tienda' })).toBeChecked())
  })
})
