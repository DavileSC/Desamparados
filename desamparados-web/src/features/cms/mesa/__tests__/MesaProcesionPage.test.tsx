import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import { useAuthStore } from '../../../altas/auth/store'
import MesaProcesionPage from '../MesaProcesionPage'
import type { Apuntados, Colas, FichaDeMesa, PrendaDelRopero, Requisitos } from '../../../../lib/api/mesa'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const hermanoDe = (id: number, nombre: string, apellidos: string, fechaNacimiento: string) => ({
  id, nombre, apellidos, fechaNacimiento, telefono: null, email: null, alturaHombro: null, numeroHermano: id,
})

const APUNTADOS: Apuntados = {
  year: 2027,
  salida: 'PASION',
  puestos: [{ puesto: 'Guardería', total: 1 }, { puesto: 'Trono', total: 1 }],
  apuntados: [
    {
      tipo: 'papeleta', id: 1, puesto: 'Trono', puestoPedido: 'Trono', tramo: null, observaciones: null, createdAt: '2027-03-01T10:00:00.000Z',
      numTunicaAsignada: null, numCapiroteAsignado: null, numFaraonaAsignada: null, origenTunica: 'PROPIA',
      pagado: { importe: 0, estado: 'EXENTO', metodoPago: null }, estado: 'recogida', pendiente: 0,
      hermano: { ...hermanoDe(10, 'Aaron', 'Galea Mayorga', '2009-05-06T12:00:00.000Z'), telefono: '623577927', alturaHombro: 145 },
    },
    {
      tipo: 'solicitud', id: 2, puesto: 'Guardería', puestoPedido: 'Guardería', tramo: null, observaciones: null, createdAt: '2027-03-01T10:00:00.000Z',
      numTunicaAsignada: null, numCapiroteAsignado: null, numFaraonaAsignada: null, origenTunica: null,
      pagado: null, estado: 'por-pagar', pendiente: 20,
      hermano: hermanoDe(11, 'Abel', 'Velasco Pérez', '2021-06-06T12:00:00.000Z'),
    },
  ],
}

const AL_DIA: Requisitos = { salidaPagada: true, salidaPendiente: 0, cuotasPendientes: [], cuotasEnElBanco: [], totalPendiente: 0, puedeRecoger: true, motivos: [] }
const DEBE: Requisitos = {
  salidaPagada: true, salidaPendiente: 0, cuotasEnElBanco: [], totalPendiente: 20, puedeRecoger: false, motivos: ['Tiene la cuota de 2027 sin pagar.'],
  cuotasPendientes: [{ id: 30, year: 2027, concepto: 'Cuota 2027', importe: 20, estado: 'PENDIENTE' }],
}

const FICHA: FichaDeMesa = {
  id: 20, nombre: 'Abel', primerApellido: 'Reyes', segundoApellido: 'Díaz', apellidos: 'Reyes Díaz',
  fechaNacimiento: '2013-08-01T12:00:00.000Z', sexo: 'HOMBRE', telefono: '622661532', email: 'virginia@ejemplo.es', dni: null,
  numeroHermano: 57, esTitular: false, situacion: 'activo', tieneTunicaPropia: false, alturaHombro: null, puesto: null,
  salida: 'PASION', year: 2027, prendas: [], solicitud: null, papeleta: null, requisitos: DEBE, familia: [],
  anterior: { year: 2026, puesto: 'Nazareno', origenTunica: 'ROPERO', numTunicaAsignada: '140-107', numCapiroteAsignado: '150', numFaraonaAsignada: null },
  propuesta: { puesto: 'Nazareno', tunica: { origen: 'ROPERO', numero: '140-107' }, capirote: '150', faraona: null },
  cuotaSalida: 0,
}

const SOLICITUD: NonNullable<FichaDeMesa['solicitud']> = {
  id: 99, puesto: 'Nazareno', observaciones: null, origen: 'WEB', donativo: null, pendiente: 0, concepto: 'Papeleta Sitio 2027',
  cita: { fecha: '2027-03-08T00:00:00.000Z', horaInicio: '2027-03-08T17:00:00.000Z' },
}

const COLAS: Colas = {
  salida: 'PASION', year: 2027,
  porCobrar: [{ solicitudId: 99, hermano: { id: 20, nombre: 'Abel', apellidos: 'Reyes Díaz', fechaNacimiento: FICHA.fechaNacimiento, numeroHermano: 57 }, puesto: 'Nazareno', conCitaHoy: false, totalPendiente: 20, motivos: [], puedeRecoger: false }],
  porRecoger: [{ solicitudId: 98, hermano: { id: 20, nombre: 'Abel', apellidos: 'Reyes Díaz', fechaNacimiento: FICHA.fechaNacimiento, numeroHermano: 57 }, puesto: 'Nazareno', conCitaHoy: true, totalPendiente: 0, motivos: [], puedeRecoger: true }],
}

const libre = (numero: string, talla: string | null = null): PrendaDelRopero => ({ id: 1, numero, talla, estado: 'DISPONIBLE', hermano: null })

interface Opciones {
  ficha?: FichaDeMesa
  prendas?: Record<string, PrendaDelRopero[]>
  /** Respuestas de los POST, por el final de la ruta; `'red'` simula que la WiFi se ha caído. */
  respuestas?: Record<string, unknown | 'red'>
}

function servidor(opciones: Opciones = {}) {
  const llamadas: { url: string; metodo: string; cuerpo?: Record<string, unknown> }[] = []
  const ficha = opciones.ficha ?? FICHA
  vi.stubGlobal('fetch', vi.fn().mockImplementation((entrada: string, init: RequestInit = {}) => {
    const url = String(entrada)
    const metodo = init.method ?? 'GET'
    llamadas.push({ url, metodo, cuerpo: init.body ? JSON.parse(String(init.body)) : undefined })
    const ruta = url.split('?')[0]
    for (const [final, respuesta] of Object.entries(opciones.respuestas ?? {})) {
      if (metodo === 'POST' && ruta.endsWith(final)) {
        return respuesta === 'red' ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(json(respuesta))
      }
    }
    if (url.includes('/mesa/apuntados')) return Promise.resolve(json(APUNTADOS))
    if (url.includes('/mesa/colas')) return Promise.resolve(json(COLAS))
    if (url.includes('/mesa/esperados')) return Promise.resolve(json([]))
    if (url.includes('/mesa/personas?')) {
      return Promise.resolve(json([{ id: 20, nombre: 'Abel', apellidos: 'Reyes Díaz', fechaNacimiento: FICHA.fechaNacimiento, numeroHermano: 57, situacion: 'activo', papeleta: null }]))
    }
    if (url.includes('/mesa/personas/20')) return Promise.resolve(json(ficha))
    if (url.includes('/mesa/prendas')) {
      const q = new URL(url, 'http://x').searchParams.get('q') ?? ''
      return Promise.resolve(json(opciones.prendas?.[q] ?? [libre(q, q.includes('-') ? '140' : null)]))
    }
    return Promise.resolve(json({}))
  }))
  return llamadas
}

const post = (llamadas: ReturnType<typeof servidor>, final: string) => llamadas.filter((l) => l.metodo === 'POST' && l.url.split('?')[0].endsWith(final))

async function buscarAbel(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByRole('textbox', { name: 'Buscar en el censo' }), 'Abel')
  await user.click(await screen.findByRole('button', { name: /Abel Reyes Díaz/ }))
}

const como = (role: string) => useAuthStore.setState({ status: 'listo', cms: { id: 1, email: 'mesa@ejemplo.es', role, perfiles: [], origen: 'cms' }, hermano: null })

beforeEach(() => { localStorage.clear(); como('TESORERIA') })
afterEach(() => { vi.unstubAllGlobals() })

describe('MesaProcesionPage · Inscripción', () => {
  it('busca solo entre los no apuntados y apunta sin cobrar; si debe algo, lo manda a Tesorería', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({ respuestas: { '/mesa/inscribir': { solicitudId: 99, puesto: 'Nazareno', requisitos: DEBE } } })
    renderWithProviders(<MesaProcesionPage />)
    await buscarAbel(user)
    expect(llamadas.some((l) => l.url.includes('/mesa/personas?') && l.url.includes('zona=inscripcion'))).toBe(true)

    expect(screen.getByText('En 2026 salió de Nazareno.')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Puesto' })).toHaveValue('Nazareno')
    expect(screen.getByText(/Debe la cuota de 2027 \(20,00 €\)/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Apuntar' }))

    await waitFor(() => expect(post(llamadas, '/mesa/inscribir')).toHaveLength(1))
    expect(post(llamadas, '/mesa/inscribir')[0].cuerpo).toMatchObject({ hermanoId: 20, salida: 'PASION', puesto: 'Nazareno' })
    expect(post(llamadas, '/mesa/inscribir')[0].cuerpo?.clave).toMatch(/^[0-9a-f]{32}$/)
    // Los datos no se han tocado: no se corrige la ficha.
    expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false)
    expect(await screen.findByText(/Abel Reyes, apuntado como Nazareno\. Que pase a Tesorería: tiene 20,00 € por pagar/)).toBeInTheDocument()
    // Y vuelve al buscador, listo para el siguiente.
    expect(screen.getByRole('textbox', { name: 'Buscar en el censo' })).toBeInTheDocument()
  })

  it('lo corregido en los datos va a la ficha antes de apuntar', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({ respuestas: { '/mesa/inscribir': { solicitudId: 99, puesto: 'Nazareno', requisitos: AL_DIA } } })
    renderWithProviders(<MesaProcesionPage />)
    await buscarAbel(user)

    const telefono = screen.getByRole('textbox', { name: 'Teléfono' })
    await user.clear(telefono)
    await user.type(telefono, '600111222')
    await user.click(screen.getByRole('button', { name: 'Apuntar' }))
    await waitFor(() => expect(post(llamadas, '/mesa/inscribir')).toHaveLength(1))
    const patch = llamadas.find((l) => l.metodo === 'PATCH')
    expect(patch?.url).toContain('/mesa/personas/20')
    expect(patch?.cuerpo).toEqual({ telefono: '600111222' })
    expect(await screen.findByText(/Que pase a Túnicas/)).toBeInTheDocument()
  })
})

describe('MesaProcesionPage · Tesorería', () => {
  beforeEach(() => localStorage.setItem('mesa.zona', 'tesoreria'))

  it('la cola dice a quién le toca; se cobra lo marcado de una vez', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({ respuestas: { '/mesa/cobrar': { cobrados: [{ id: 30, concepto: 'Cuota 2027', importe: 20 }], total: 20, repetida: false } } })
    renderWithProviders(<MesaProcesionPage />)

    const cola = await screen.findByRole('region', { name: 'Por cobrar' })
    expect(await within(cola).findByText('Debe 20,00 €')).toBeInTheDocument()
    await user.click(within(cola).getByRole('button', { name: /Abel Reyes Díaz/ }))

    expect(await screen.findByRole('checkbox', { name: 'Cobrar Cuota 2027' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Bizum' }))
    await user.click(screen.getByRole('button', { name: 'Cobrar 20,00 €' }))

    await waitFor(() => expect(post(llamadas, '/mesa/cobrar')).toHaveLength(1))
    expect(post(llamadas, '/mesa/cobrar')[0].cuerpo).toMatchObject({ hermanoId: 20, reciboIds: [30], metodoPago: 'BIZUM' })
    expect(await screen.findByText(/Abel: cobrado 20,00 € en bizum\. Que pase a Inscripción/)).toBeInTheDocument()
  })

  it('si se cae la red al cobrar, lo dice, no pierde nada y el reintento lleva la misma clave', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({ respuestas: { '/mesa/cobrar': 'red' } })
    renderWithProviders(<MesaProcesionPage />)
    await buscarAbel(user)

    const cobrar = await screen.findByRole('button', { name: 'Cobrar 20,00 €' })
    await user.click(cobrar)
    expect(await screen.findByText(/No hay conexión y no se ha guardado.*no se cobrará dos veces/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Cobrar Cuota 2027' })).toBeChecked()
    await user.click(cobrar)
    await waitFor(() => expect(post(llamadas, '/mesa/cobrar')).toHaveLength(2))
    const [primero, segundo] = post(llamadas, '/mesa/cobrar')
    expect(segundo.cuerpo?.clave).toBe(primero.cuerpo?.clave)
  })

  it('en el Rosario cobra la voluntad de la solicitud, con lo que dé al final', async () => {
    const user = userEvent.setup()
    localStorage.setItem('mesa.salida', 'ROSARIO')
    const ficha = { ...FICHA, salida: 'ROSARIO' as const, requisitos: { ...AL_DIA, salidaPagada: false, salidaPendiente: 5, totalPendiente: 5, puedeRecoger: false },
      solicitud: { ...SOLICITUD, puesto: 'Vela', donativo: 5, pendiente: 5, concepto: 'Donativo Rosario vespertino 2027' } }
    const llamadas = servidor({ ficha, respuestas: { '/mesa/cobrar': { cobrados: [{ id: 70, concepto: 'Donativo Rosario vespertino 2027', importe: 3 }], total: 3, repetida: false } } })
    renderWithProviders(<MesaProcesionPage />)
    await buscarAbel(user)

    expect(await screen.findByRole('checkbox', { name: 'Cobrar Donativo Rosario vespertino 2027' })).toBeChecked()
    const voluntad = screen.getByRole('textbox', { name: 'Donativo' })
    await user.clear(voluntad)
    await user.type(voluntad, '3')
    await user.click(screen.getByRole('button', { name: 'Cobrar 3,00 €' }))
    await waitFor(() => expect(post(llamadas, '/mesa/cobrar')).toHaveLength(1))
    expect(post(llamadas, '/mesa/cobrar')[0].cuerpo).toMatchObject({ reciboIds: [], solicitudes: [{ solicitudId: 99, importe: 3 }] })
    expect(await screen.findByText(/Que pase a Túnicas/)).toBeInTheDocument()
  })

  it('perdonar la cuota lo puede marcar Tesorería, con su motivo; Albacería no ve el botón', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({ respuestas: { '/mesa/perdonar': { perdonadas: [{ id: 30, concepto: 'Cuota 2027' }], repetida: false } } })
    const { unmount } = renderWithProviders(<MesaProcesionPage />)
    await buscarAbel(user)

    await user.click(await screen.findByRole('button', { name: 'Perdonar la cuota' }))
    const dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getByText(/Lo decide el Hermano Mayor/)).toBeInTheDocument()
    await user.type(within(dialogo).getByRole('textbox', { name: /motivo/i }), 'Apuros')
    await user.click(within(dialogo).getByRole('button', { name: 'Perdonar' }))
    await waitFor(() => expect(post(llamadas, '/mesa/perdonar')).toHaveLength(1))
    expect(post(llamadas, '/mesa/perdonar')[0].cuerpo).toMatchObject({ reciboIds: [30], motivo: 'Apuros' })
    unmount()

    como('ALBACERIA')
    renderWithProviders(<MesaProcesionPage />)
    await buscarAbel(user)
    await screen.findByRole('button', { name: 'Cobrar 20,00 €' })
    expect(screen.queryByRole('button', { name: /Perdonar/ })).not.toBeInTheDocument()
  })
})

describe('MesaProcesionPage · Túnicas', () => {
  beforeEach(() => localStorage.setItem('mesa.zona', 'tunicas'))
  const apuntado = { ...FICHA, solicitud: SOLICITUD, requisitos: AL_DIA }

  it('propone la ropa del año pasado y la da, con el puesto confirmado', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({ ficha: apuntado, respuestas: { '/mesa/entregar': { papeletaId: 99, puesto: 'Nazareno', numTunicaAsignada: '140-107', repetida: false } } })
    renderWithProviders(<MesaProcesionPage />)

    const cola = await screen.findByRole('region', { name: 'Listos para la ropa' })
    await user.click(await within(cola).findByRole('button', { name: /Abel Reyes Díaz/ }))

    expect(await screen.findByRole('combobox', { name: 'Puesto' })).toHaveValue('Nazareno')
    expect(screen.getByText(/En 2026: Nazareno · túnica 140-107 · capirote 150/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'N.º de túnica' })).toHaveValue('140-107')
    expect(await screen.findByText('Libre en el ropero · talla 140')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dar la ropa' }))

    await waitFor(() => expect(post(llamadas, '/mesa/entregar')).toHaveLength(1))
    expect(post(llamadas, '/mesa/entregar')[0].cuerpo).toMatchObject({
      solicitudId: 99, puesto: 'Nazareno', origenTunica: 'ROPERO', numTunicaAsignada: '140-107', numCapiroteAsignado: '150',
    })
    expect(await screen.findByText(/Nazareno, túnica 140-107\. Recogida/)).toBeInTheDocument()
  })

  it('sin pagar no sale la túnica: lo dice y manda a Tesorería', async () => {
    const user = userEvent.setup()
    servidor({ ficha: { ...apuntado, requisitos: DEBE } })
    renderWithProviders(<MesaProcesionPage />)
    await buscarAbel(user)

    expect(await screen.findByText('La túnica no sale todavía.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dar la ropa' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'A Tesorería' }))
    expect(await screen.findByRole('button', { name: 'Cobrar 20,00 €' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Tesorería' })).toHaveAttribute('aria-selected', 'true')
  })

  it('una túnica que tiene otra persona dice quién y no deja darla', async () => {
    const user = userEvent.setup()
    servidor({ ficha: apuntado, prendas: { '140-107': [{ id: 3, numero: '140-107', talla: '140', estado: 'PRESTADA', hermano: { id: 5, nombre: 'Lucía', apellidos: 'Rosillo Mansidao' } }] } })
    renderWithProviders(<MesaProcesionPage />)
    await buscarAbel(user)

    expect(await screen.findByText('La tiene Lucía Rosillo Mansidao')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dar la ropa' })).toBeDisabled())
  })

  it('en el Rosario se va de traje: solo se confirma el puesto', async () => {
    const user = userEvent.setup()
    localStorage.setItem('mesa.salida', 'ROSARIO')
    const llamadas = servidor({ ficha: { ...apuntado, salida: 'ROSARIO', solicitud: { ...SOLICITUD, puesto: 'Vela' } }, respuestas: { '/mesa/entregar': { papeletaId: 99, puesto: 'Vela', numTunicaAsignada: null, repetida: false } } })
    renderWithProviders(<MesaProcesionPage />)
    await buscarAbel(user)

    expect(await screen.findByRole('button', { name: 'Confirmar el puesto' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'N.º de túnica' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmar el puesto' }))
    await waitFor(() => expect(post(llamadas, '/mesa/entregar')).toHaveLength(1))
    expect(post(llamadas, '/mesa/entregar')[0].cuerpo).not.toHaveProperty('origenTunica')
    expect(llamadas.some((l) => l.url.includes('/mesa/personas/20?salida=ROSARIO'))).toBe(true)
  })
})

describe('MesaProcesionPage · Listado y teclado', () => {
  it('el listado es la hoja de siempre, con el punto de cada uno', async () => {
    localStorage.setItem('mesa.zona', 'listado')
    servidor()
    renderWithProviders(<MesaProcesionPage />)
    const tabla = await screen.findByRole('table', { name: 'Apuntados' })
    const aaron = within(tabla).getByRole('row', { name: /Aaron/ })
    expect(within(aaron).getByText('06/05/2009')).toBeInTheDocument()
    expect(within(aaron).getByText('1,45')).toBeInTheDocument()
    expect(within(aaron).getByText('Propia')).toBeInTheDocument()
    expect(within(aaron).getByText('Recogida')).toBeInTheDocument()
    expect(within(tabla).getByText('Debe 20,00 €')).toBeInTheDocument()
    expect(screen.getByText(/2 apuntados, 1 con la ropa/)).toBeInTheDocument()
  })

  it('desde el listado, una solicitud sin recoger se corrige o se cancela', async () => {
    const user = userEvent.setup()
    localStorage.setItem('mesa.zona', 'listado')
    const llamadas = servidor({ ficha: { ...FICHA, solicitud: SOLICITUD, requisitos: AL_DIA } })
    renderWithProviders(<MesaProcesionPage />)
    await buscarAbel(user)

    expect(await screen.findByText(/Apuntado desde su área, sin recoger · al día/)).toBeInTheDocument()
    const puesto = screen.getByRole('combobox', { name: 'Puesto' })
    await user.clear(puesto)
    await user.type(puesto, 'Bocina')
    await user.click(await screen.findByRole('option', { name: 'Bocina' }))
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PATCH' && l.url.includes('/admin/solicitudes/99'))).toBe(true))
    expect(llamadas.find((l) => l.url.includes('/admin/solicitudes/99'))?.cuerpo).toMatchObject({ puesto: 'Bocina' })

    await buscarAbel(user)
    await user.click(await screen.findByRole('button', { name: 'Cancelar solicitud' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar solicitud' }))
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'DELETE' && l.url.includes('/admin/solicitudes/99'))).toBe(true))
  })

  it('Alt+número cambia de zona, y cada ordenador la recuerda', async () => {
    const user = userEvent.setup()
    servidor()
    renderWithProviders(<MesaProcesionPage />)
    await screen.findByRole('textbox', { name: 'Buscar en el censo' })
    await user.keyboard('{Alt>}3{/Alt}')
    expect(screen.getByRole('tab', { name: 'Túnicas' })).toHaveAttribute('aria-selected', 'true')
    expect(localStorage.getItem('mesa.zona')).toBe('tunicas')
  })
})
