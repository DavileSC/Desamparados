import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import { useAuthStore } from '../../../altas/auth/store'
import MesaProcesionPage from '../MesaProcesionPage'
import type { Apuntados, FichaDeMesa, PrendaDelRopero } from '../../../../lib/api/mesa'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const APUNTADOS: Apuntados = {
  year: 2027,
  puestos: [{ puesto: 'Guardería', total: 1 }, { puesto: 'Trono', total: 1 }],
  papeletas: [
    {
      id: 1, puesto: 'Trono', tramo: null, observaciones: null, createdAt: '2027-03-01T10:00:00.000Z',
      numTunicaAsignada: null, numCapiroteAsignado: null, numFaraonaAsignada: null, origenTunica: 'PROPIA',
      recibo: { importe: 30, estado: 'PAGADO', metodoPago: 'BIZUM' },
      hermano: { id: 10, nombre: 'Aaron', apellidos: 'Galea Mayorga', fechaNacimiento: '2009-05-06T12:00:00.000Z', telefono: '623577927', email: null, alturaHombro: 145, numeroHermano: 3 },
    },
    {
      id: 2, puesto: 'Guardería', tramo: null, observaciones: null, createdAt: '2027-03-01T10:00:00.000Z',
      numTunicaAsignada: '095-02', numCapiroteAsignado: null, numFaraonaAsignada: '18', origenTunica: 'ROPERO',
      recibo: { importe: 45, estado: 'PAGADO', metodoPago: 'EFECTIVO' },
      hermano: { id: 11, nombre: 'Abel', apellidos: 'Velasco Pérez', fechaNacimiento: '2021-06-06T12:00:00.000Z', telefono: null, email: null, alturaHombro: null, numeroHermano: 4 },
    },
  ],
}

const FICHA: FichaDeMesa = {
  id: 20, nombre: 'Abel', primerApellido: 'Reyes', segundoApellido: 'Díaz', apellidos: 'Reyes Díaz',
  fechaNacimiento: '2013-08-01T12:00:00.000Z', sexo: 'HOMBRE', telefono: '622661532', email: 'virginia@ejemplo.es', dni: null,
  numeroHermano: 57, esTitular: false, situacion: 'activo', tieneTunicaPropia: false, alturaHombro: null, puesto: null, year: 2027,
  prendas: [], papeleta: null,
  anterior: { year: 2026, puesto: 'Nazareno', origenTunica: 'ROPERO', numTunicaAsignada: '140-107', numCapiroteAsignado: '150', numFaraonaAsignada: null },
  cita: { id: 7, fecha: '2027-03-08T00:00:00.000Z', horaInicio: '2027-03-08T17:00:00.000Z' },
  propuesta: { puesto: 'Nazareno', tunica: { origen: 'ROPERO', numero: '140-107' }, capirote: '150', faraona: null },
  precios: { papeleta: 30, alquiler: 15 },
}

const libre = (numero: string, talla: string | null = null): PrendaDelRopero => ({ id: 1, numero, talla, estado: 'DISPONIBLE', hermano: null })

function servidor(opciones: { prendas?: Record<string, PrendaDelRopero[]> } = {}) {
  const llamadas: { url: string; metodo: string; cuerpo?: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn().mockImplementation((entrada: string, init: RequestInit = {}) => {
    const url = String(entrada)
    const metodo = init.method ?? 'GET'
    llamadas.push({ url, metodo, cuerpo: init.body ? JSON.parse(String(init.body)) : undefined })
    if (url.includes('/mesa/apuntados')) return Promise.resolve(json(APUNTADOS))
    if (url.includes('/mesa/esperados')) return Promise.resolve(json([]))
    if (url.includes('/mesa/personas?')) {
      return Promise.resolve(json([{ id: 20, nombre: 'Abel', apellidos: 'Reyes Díaz', fechaNacimiento: FICHA.fechaNacimiento, numeroHermano: 57, situacion: 'activo', papeleta: null }]))
    }
    if (url.includes('/mesa/personas/20')) return Promise.resolve(json(FICHA))
    if (url.includes('/mesa/prendas')) {
      const q = new URL(url, 'http://x').searchParams.get('q') ?? ''
      return Promise.resolve(json(opciones.prendas?.[q] ?? [libre(q, q.includes('-') ? '140' : null)]))
    }
    if (url.includes('/admin/inscribir')) return Promise.resolve(json({ msg: 'ok', data: { recibo: { importe: '45.00', metodoPago: 'EFECTIVO' }, papeleta: { id: 99 } } }))
    return Promise.resolve(json({}))
  }))
  return llamadas
}

async function abrirAbel(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: 'Buscar en el censo' }), 'Abel')
  await user.click(await screen.findByRole('button', { name: /Abel Reyes Díaz/ }))
  return screen.findByRole('button', { name: /Apuntar/ })
}

beforeEach(() => useAuthStore.setState({ status: 'listo', cms: { id: 1, email: 'mesa@ejemplo.es', role: 'ALBACERIA', perfiles: [], origen: 'cms' }, hermano: null }))
afterEach(() => { vi.unstubAllGlobals() })

describe('MesaProcesionPage', () => {
  it('lista a los apuntados como la hoja: talla en metros, túnica propia y faraona', async () => {
    servidor()
    renderWithProviders(<MesaProcesionPage />)
    const tabla = await screen.findByRole('table', { name: 'Apuntados' })
    const aaron = within(tabla).getByRole('row', { name: /Aaron/ })
    expect(within(aaron).getByText('06/05/2009')).toBeInTheDocument()
    expect(within(aaron).getByText('1,45')).toBeInTheDocument()
    expect(within(aaron).getByText('Propia')).toBeInTheDocument()
    expect(within(tabla).getByText('18 (faraona)')).toBeInTheDocument()
    expect(screen.getByText(/2 apuntados en 2027 · 75,00 € cobrados/)).toBeInTheDocument()
  })

  it('propone la ropa del año pasado y apunta cobrando papeleta y alquiler, con su cita', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<MesaProcesionPage />)

    const boton = await abrirAbel(user)
    expect(screen.getByText(/En 2026: Nazareno · túnica 140-107 · capirote 150/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'N.º de túnica' })).toHaveValue('140-107')
    expect(await screen.findByText('Libre en el ropero · talla 140')).toBeInTheDocument()
    expect(boton).toHaveTextContent('Apuntar y cobrar 45,00 €')

    await user.click(screen.getByRole('button', { name: 'Bizum' }))
    await user.click(boton)

    await waitFor(() => expect(llamadas.some((l) => l.url.includes('/admin/inscribir'))).toBe(true))
    expect(llamadas.find((l) => l.url.includes('/admin/inscribir'))?.cuerpo).toMatchObject({
      hermanoId: 20, citaId: 7, metodoPago: 'BIZUM', puesto: 'Nazareno',
      origenTunica: 'ROPERO', numTunicaAsignada: '140-107', numCapiroteAsignado: '150',
    })
    // Los datos no se han tocado: no se corrige la ficha.
    expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false)
    expect(await screen.findByText(/Abel Reyes, apuntado como Nazareno: 45,00 € en bizum/)).toBeInTheDocument()
  })

  it('con túnica propia no cobra alquiler, y una mantilla no lleva túnica', async () => {
    const user = userEvent.setup()
    servidor()
    renderWithProviders(<MesaProcesionPage />)
    const boton = await abrirAbel(user)

    await user.click(screen.getByRole('button', { name: 'Propia' }))
    expect(boton).toHaveTextContent('Apuntar y cobrar 30,00 €')
    expect(screen.queryByRole('textbox', { name: 'N.º de túnica' })).not.toBeInTheDocument()

    const puesto = screen.getByRole('combobox', { name: 'Puesto' })
    await user.clear(puesto)
    await user.type(puesto, 'Mantilla')
    await user.click(await screen.findByRole('option', { name: 'Mantilla' }))
    expect(screen.getByRole('button', { name: 'No lleva' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Ninguno' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('una túnica que tiene otra persona dice quién y no deja apuntar', async () => {
    const user = userEvent.setup()
    servidor({ prendas: { '140-107': [{ id: 3, numero: '140-107', talla: '140', estado: 'PRESTADA', hermano: { id: 5, nombre: 'Lucía', apellidos: 'Rosillo Mansidao' } }] } })
    renderWithProviders(<MesaProcesionPage />)
    const boton = await abrirAbel(user)

    expect(await screen.findByText('La tiene Lucía Rosillo Mansidao')).toBeInTheDocument()
    await waitFor(() => expect(boton).toBeDisabled())
  })

  it('una túnica que no está en el ropero se puede dar de alta al apuntar', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({ prendas: { '140-107': [], '145-31': [] } })
    renderWithProviders(<MesaProcesionPage />)
    const boton = await abrirAbel(user)

    expect(await screen.findByText('No está en el ropero')).toBeInTheDocument()
    await waitFor(() => expect(boton).toBeDisabled())
    await user.click(screen.getByRole('checkbox', { name: /Darla de alta en el ropero con el número 140-107/ }))
    await waitFor(() => expect(boton).toBeEnabled())
    await user.click(boton)
    await waitFor(() => expect(llamadas.find((l) => l.url.includes('/admin/inscribir'))?.cuerpo).toMatchObject({ crearPrendas: ['TUNICA'] }))
  })

  it('lo corregido en los datos va a la ficha antes de apuntar', async () => {
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<MesaProcesionPage />)
    const boton = await abrirAbel(user)

    const telefono = screen.getByRole('textbox', { name: 'Teléfono' })
    await user.clear(telefono)
    await user.type(telefono, '600111222')
    await user.click(boton)
    await waitFor(() => expect(llamadas.some((l) => l.url.includes('/admin/inscribir'))).toBe(true))
    const patch = llamadas.find((l) => l.metodo === 'PATCH')
    expect(patch?.url).toContain('/mesa/personas/20')
    expect(patch?.cuerpo).toEqual({ telefono: '600111222' })
  })
})
