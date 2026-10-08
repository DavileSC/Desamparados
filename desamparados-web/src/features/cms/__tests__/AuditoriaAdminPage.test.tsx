import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import AuditoriaAdminPage from '../AuditoriaAdminPage'

afterEach(() => { vi.unstubAllGlobals() })

function responder(data: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response(
    JSON.stringify({ data, meta: { total: data.length, page: 1, limit: 20, totalPages: 1 } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  ))))
}

const autor = { id: 1, email: 'secre@ejemplo.es', nombre: 'Carmen', apellidos: 'Secretaria', role: 'SECRETARIA' }

describe('AuditoriaAdminPage', () => {
  it('pide la página que dice la URL', async () => {
    const fetchSimulado = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ data: [], meta: { total: 400, page: 2, limit: 20, totalPages: 20 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<AuditoriaAdminPage />, { ruta: '/cms/auditoria?pagina=2' })

    await waitFor(() => expect(String(fetchSimulado.mock.calls.at(-1)?.[0])).toContain('page=2'))
  })

  it('despliega el antes y el después de un cambio, en palabras', async () => {
    // Antes solo se veía «HERMANO_ACTUALIZAR · hermano #42»: qué cambió y desde
    // qué valor había que buscarlo en la base de datos.
    const user = userEvent.setup()
    responder([{
      id: 7, action: 'HERMANO_ACTUALIZAR', entityType: 'hermano', entityId: '42', ip: null,
      createdAt: '2026-09-11T10:00:00.000Z', user: autor,
      detalles: { antes: { dni: '20000001R', fechaBaja: null, activo: true }, despues: { dni: '20000001X', fechaBaja: '2026-01-20', activo: false } },
    }])
    renderWithProviders(<AuditoriaAdminPage />)

    expect(await screen.findByText('Editar la ficha de un hermano')).toBeInTheDocument()
    // Plegado de entrada: el listado no se convierte en un muro de tablas.
    expect(screen.queryByRole('table', { name: 'Cambios' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ver detalles' }))
    const tabla = screen.getByRole('table', { name: 'Cambios' })
    const filaDni = within(tabla).getByRole('row', { name: /dni/i })
    expect(filaDni).toHaveTextContent('20000001R')
    expect(filaDni).toHaveTextContent('20000001X')
    expect(within(tabla).getByRole('row', { name: /fecha de baja/i })).toHaveTextContent('20/01/2026')
    expect(within(tabla).getByRole('row', { name: /en el censo/i })).toHaveTextContent(/sí.*no/i)
    expect(screen.getByRole('button', { name: 'Ocultar detalles' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('enseña los datos sueltos que acompañan al cambio', async () => {
    const user = userEvent.setup()
    responder([{
      id: 8, action: 'EMANCIPACION', entityType: 'hermano', entityId: '43', ip: '127.0.0.1',
      createdAt: '2026-09-11T10:00:00.000Z', user: autor,
      detalles: { origen: 'secretaría', antes: { userId: 5 }, despues: { userId: 99 } },
    }])
    renderWithProviders(<AuditoriaAdminPage />)
    await user.click(await screen.findByRole('button', { name: 'Ver detalles' }))
    expect(screen.getByText(/origen:/i).parentElement).toHaveTextContent('Origen: secretaría')
  })

  it('un apunte sin detalles no ofrece desplegar nada', async () => {
    responder([{
      id: 9, action: 'NOTICIA_CREAR', entityType: 'noticia', entityId: '3', ip: null,
      createdAt: '2026-09-11T10:00:00.000Z', user: autor,
    }])
    renderWithProviders(<AuditoriaAdminPage />)
    expect(await screen.findByText('Crear una noticia')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver detalles' })).not.toBeInTheDocument()
  })

  it('encender y apagar un módulo se leen en palabras, sobre qué módulo', async () => {
    responder([{
      id: 11, action: 'MODULO_APAGAR', entityType: 'modulo', entityId: 'loteria', ip: null,
      createdAt: '2026-10-02T10:00:00.000Z', user: autor,
    }])
    renderWithProviders(<AuditoriaAdminPage />)
    expect(await screen.findByText('Módulo apagado')).toBeInTheDocument()
    expect(screen.getByText('Módulo #loteria')).toBeInTheDocument()
  })

  it('una acción sin nombre legible se enseña con su código', async () => {
    responder([{
      id: 10, action: 'ACCION_NUEVA', entityType: null, entityId: null, ip: null,
      createdAt: '2026-09-11T10:00:00.000Z', user: null,
    }])
    renderWithProviders(<AuditoriaAdminPage />)
    expect(await screen.findByText('ACCION_NUEVA')).toBeInTheDocument()
  })

  it('un correo fallido dice qué correo era, por su nombre, y por qué no salió', async () => {
    // Ya no guarda el asunto (podía llevar el nombre de quien lo recibía) sino la clave del uso.
    const user = userEvent.setup()
    responder([{
      id: 12, action: 'EMAIL_FALLIDO', entityType: 'email', entityId: null, ip: null,
      createdAt: '2026-10-08T10:00:00.000Z', user: null,
      detalles: { para: 'j***@ejemplo.es', uso: 'solicitud_recibida', motivo: 'ECONNECTION · código 421' },
    }])
    renderWithProviders(<AuditoriaAdminPage />)

    expect(await screen.findByText('Correo que no se pudo enviar')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver detalles' }))
    expect(screen.getByText(/^Correo:/).parentElement).toHaveTextContent('Correo: Solicitud de ingreso recibida (solicitud_recibida)')
    expect(screen.getByText(/^Motivo:/).parentElement).toHaveTextContent('Motivo: ECONNECTION · código 421')
  })

  it('las acciones nuevas de la auditoría del 07-10 tienen nombre, y sus datos también', async () => {
    const user = userEvent.setup()
    responder([
      { id: 13, action: 'ALTA_NO_TRAMITADA', entityType: 'hermano', entityId: '42', ip: null, createdAt: '2026-10-08T10:00:00.000Z', user: null,
        detalles: { motivo: 'dni_en_el_censo', para: 'j***@ejemplo.es' } },
      { id: 14, action: 'FAMILIAR_DNI_OCUPADO', entityType: 'hermano', entityId: '7', ip: null, createdAt: '2026-10-08T10:00:00.000Z', user: autor,
        detalles: { fichaConEseDni: 42 } },
      { id: 15, action: 'CONTRASENA_CAMBIAR', entityType: 'user', entityId: '1', ip: null, createdAt: '2026-10-08T10:00:00.000Z', user: autor,
        detalles: { sesionesCerradas: true } },
      { id: 16, action: 'SOLICITUD_SALIDA_CANCELAR', entityType: 'solicitud', entityId: '9', ip: null, createdAt: '2026-10-08T10:00:00.000Z', user: autor,
        detalles: { origen: 'baja en el censo', antes: { puesto: 'Cirio' }, despues: { estado: 'CANCELADA' } } },
    ])
    renderWithProviders(<AuditoriaAdminPage />)

    expect(await screen.findByText('Alta por la web no tramitada (datos ya registrados)')).toBeInTheDocument()
    expect(screen.getByText('DNI de otra ficha escrito desde el área de hermanos')).toBeInTheDocument()
    expect(screen.getByText('Cambiar su contraseña')).toBeInTheDocument()
    expect(screen.getByText('Cancelar una solicitud de salida')).toBeInTheDocument()

    for (const boton of screen.getAllByRole('button', { name: 'Ver detalles' })) await user.click(boton)
    expect(screen.getByText(/^Motivo:/).parentElement).toHaveTextContent('El DNI ya está en el censo (dni_en_el_censo)')
    expect(screen.getByText(/^Ficha que ya tiene ese DNI:/).parentElement).toHaveTextContent('42')
    expect(screen.getByText(/^Sesiones cerradas:/).parentElement).toHaveTextContent('Sí')
    expect(screen.getByText(/^Origen:/).parentElement).toHaveTextContent('baja en el censo')
  })

  it('un antes y un después sueltos (no objetos) no se pierden', async () => {
    const user = userEvent.setup()
    responder([{
      id: 17, action: 'DEFUNCION_FIJAR', entityType: 'hermano', entityId: '42', ip: null, createdAt: '2026-10-08T10:00:00.000Z', user: autor,
      detalles: { antes: null, despues: '2026-10-01' },
    }])
    renderWithProviders(<AuditoriaAdminPage />)

    expect(await screen.findByText('Fijar la fecha de defunción')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver detalles' }))
    expect(screen.getByText(/^Después:/).parentElement).toHaveTextContent('01/10/2026')
  })
})

