import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import { useAuthStore } from '../../../altas/auth/store'
import MesaProcesionPage from '../MesaProcesionPage'
import type { Apuntados, Colas, FichaDeMesa, PrendaDelRopero, Requisitos, SinDevolver } from '../../../../lib/api/mesa'

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const hermanoDe = (id: number, nombre: string, apellidos: string, fechaNacimiento: string) => ({
  id, nombre, apellidos, fechaNacimiento, telefono: null, email: null, alturaHombro: null, numeroHermano: id,
})

const APUNTADOS: Apuntados = {
  year: 2027,
  salida: 'PASION',
  puestos: [{ puesto: 'Guardería', total: 1 }, { puesto: 'Trono', total: 1 }],
  faltanCingulos: 0,
  apuntados: [
    {
      tipo: 'papeleta', id: 1, puesto: 'Trono', puestoPedido: 'Trono', tramo: null, observaciones: null, createdAt: '2027-03-01T10:00:00.000Z',
      numTunicaAsignada: null, numCapiroteAsignado: null, numFaraonaAsignada: null, origenTunica: 'PROPIA', cingulo: 'PROPIO',
      pagado: { importe: 0, estado: 'EXENTO', metodoPago: null }, estado: 'recogida', pendiente: 0,
      hermano: { ...hermanoDe(10, 'Aaron', 'Galea Mayorga', '2009-05-06T12:00:00.000Z'), telefono: '623577927', alturaHombro: 145 },
    },
    {
      tipo: 'solicitud', id: 2, puesto: 'Guardería', puestoPedido: 'Guardería', tramo: null, observaciones: null, createdAt: '2027-03-01T10:00:00.000Z',
      numTunicaAsignada: null, numCapiroteAsignado: null, numFaraonaAsignada: null, origenTunica: null, cingulo: null,
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
  salida: 'PASION', year: 2027, prendas: [], cingulosSinDevolver: [], cingulos: { total: 10, prestados: 3, enElRopero: 7, debidos: 0 },
  solicitud: null, papeleta: null, requisitos: DEBE, familia: [],
  anterior: { year: 2026, puesto: 'Nazareno', origenTunica: 'ROPERO', numTunicaAsignada: '140-107', numCapiroteAsignado: '150', numFaraonaAsignada: null, cingulo: 'DEVUELTO' },
  propuesta: { puesto: 'Nazareno', tunica: { origen: 'ROPERO', numero: '140-107' }, capirote: '150', faraona: null, cingulo: 'PRESTADO' },
  cuotaSalida: 0,
}

const SOLICITUD: NonNullable<FichaDeMesa['solicitud']> = {
  id: 99, puesto: 'Nazareno', observaciones: null, origen: 'WEB', donativo: null, pendiente: 0, concepto: 'Papeleta de sitio 2027',
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
  apuntados?: Apuntados
  sinDevolver?: SinDevolver[]
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
    if (url.includes('/mesa/apuntados')) return Promise.resolve(json(opciones.apuntados ?? APUNTADOS))
    if (url.includes('/mesa/sin-devolver')) return Promise.resolve(json(opciones.sinDevolver ?? []))
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
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

/** La pestaña donde se abre la papeleta para imprimirla: se abre en el clic y luego se le da el PDF. */
function pestanaDeImpresion() {
  const pestana = { location: { href: '' }, close: vi.fn() }
  vi.spyOn(window, 'open').mockReturnValue(pestana as unknown as Window)
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:papeleta') }))
  return pestana
}

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

  it('un clic de más se deshace desde el aviso: cancela la solicitud recién apuntada', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({ respuestas: { '/mesa/inscribir': { solicitudId: 99, puesto: 'Nazareno', requisitos: AL_DIA } } })
    renderWithProviders(<MesaProcesionPage />)
    await buscarAbel(user)
    await user.click(await screen.findByRole('button', { name: 'Apuntar' }))
    await screen.findByText(/apuntado como Nazareno/)
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'DELETE' && l.url.includes('/admin/solicitudes/99'))).toBe(true))
    expect(await screen.findByText('Deshecho: Abel Reyes ya no está apuntado.')).toBeInTheDocument()
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
    // El cíngulo va con la túnica del ropero, y se ve cuántos quedan.
    expect(screen.getByRole('button', { name: 'Se lo lleva' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Quedan 7 en el ropero')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dar la ropa' }))

    await waitFor(() => expect(post(llamadas, '/mesa/entregar')).toHaveLength(1))
    expect(post(llamadas, '/mesa/entregar')[0].cuerpo).toMatchObject({
      solicitudId: 99, puesto: 'Nazareno', origenTunica: 'ROPERO', numTunicaAsignada: '140-107', numCapiroteAsignado: '150', cingulo: 'PRESTADO',
    })
    expect(await screen.findByText(/Nazareno, túnica 140-107\. Recogida/)).toBeInTheDocument()

    // Recogida, se imprime la papeleta para dársela en mano.
    const pestana = pestanaDeImpresion()
    await user.click(screen.getByRole('button', { name: 'Imprimir papeleta' }))
    await waitFor(() => expect(pestana.location.href).toBe('blob:papeleta'))
    expect(llamadas.some((l) => l.metodo === 'GET' && l.url.endsWith('/procesion/admin/papeletas/99/pdf'))).toBe(true)
  })

  it('sin túnica en casa ni la de antes libre, propone la de su talla y lo dice', async () => {
    const user = userEvent.setup()
    const porTalla = { ...apuntado, alturaHombro: 145, propuesta: { ...apuntado.propuesta, tunica: { origen: 'ROPERO' as const, numero: '146-03', porTalla: true } } }
    servidor({ ficha: porTalla })
    renderWithProviders(<MesaProcesionPage />)

    const cola = await screen.findByRole('region', { name: 'Listos para la ropa' })
    await user.click(await within(cola).findByRole('button', { name: /Abel Reyes Díaz/ }))
    expect(await screen.findByRole('textbox', { name: 'N.º de túnica' })).toHaveValue('146-03')
    expect(screen.getByText(/Propuesta por su talla \(1,45 m al hombro\)/)).toBeInTheDocument()

    // Si la mesa escribe otra, el aviso ya no es de esa.
    await user.clear(screen.getByRole('textbox', { name: 'N.º de túnica' }))
    await user.type(screen.getByRole('textbox', { name: 'N.º de túnica' }), '150-01')
    expect(screen.queryByText(/Propuesta por su talla/)).not.toBeInTheDocument()
  })

  it('sin cíngulos en el ropero se le debe; con túnica propia lleva el suyo', async () => {
    const user = userEvent.setup()
    const sinCingulos = { ...apuntado, cingulos: { total: 10, prestados: 10, enElRopero: 0, debidos: 2 } }
    const llamadas = servidor({ ficha: sinCingulos, respuestas: { '/mesa/entregar': { papeletaId: 99, puesto: 'Nazareno', numTunicaAsignada: '140-107', cingulo: 'DEBIDO', repetida: false } } })
    renderWithProviders(<MesaProcesionPage />)
    await buscarAbel(user)

    expect(await screen.findByRole('button', { name: 'Se le debe' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Se lo lleva' })).toBeDisabled()
    expect(screen.getByText(/No quedan cíngulos en el ropero/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Propia' }))
    expect(screen.getByRole('button', { name: 'Propio' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Del ropero' }))
    expect(screen.getByRole('button', { name: 'Se le debe' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Dar la ropa' }))
    await waitFor(() => expect(post(llamadas, '/mesa/entregar')).toHaveLength(1))
    expect(post(llamadas, '/mesa/entregar')[0].cuerpo).toMatchObject({ cingulo: 'DEBIDO' })
    expect(await screen.findByText(/sin cíngulo \(se le debe\)\. Recogida/)).toBeInTheDocument()
  })

  it('quien trae ropa sin devolver lo ve avisado', async () => {
    const user = userEvent.setup()
    servidor({ ficha: { ...apuntado, prendas: [{ id: 7, tipo: 'TUNICA', numero: '140-107', talla: '140', fechaAsignacion: null }], cingulosSinDevolver: [{ papeletaId: 70, year: 2026 }] } })
    renderWithProviders(<MesaProcesionPage />)
    await buscarAbel(user)
    expect(await screen.findByText(/Tiene sin devolver: túnica 140-107 y cíngulo/)).toBeInTheDocument()
    expect(screen.getByText('Ya tiene uno prestado: se queda con ese')).toBeInTheDocument()
  })

  it('si se apuntó a quien no era, se cancela desde Túnicas, con confirmación', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({ ficha: apuntado })
    renderWithProviders(<MesaProcesionPage />)
    await buscarAbel(user)
    await user.click(await screen.findByRole('button', { name: 'Cancelar la inscripción' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar la inscripción' }))
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'DELETE' && l.url.includes('/admin/solicitudes/99'))).toBe(true))
  })

  it('una túnica libre en el ropero pero en la papeleta de otro este año no se da', async () => {
    const user = userEvent.setup()
    servidor({ ficha: apuntado, prendas: { '140-107': [{ ...libre('140-107', '140'), enPapeleta: { id: 5, nombre: 'Álvaro', apellidos: 'Gómez Fernández' } }] } })
    renderWithProviders(<MesaProcesionPage />)
    await buscarAbel(user)
    expect(await screen.findByText('Va en la papeleta de Álvaro Gómez Fernández de este año')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dar la ropa' })).toBeDisabled())
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
    // La fecha de nacimiento y el teléfono están en la ficha, no en la tabla.
    expect(within(tabla).queryByRole('columnheader', { name: 'Nacimiento' })).not.toBeInTheDocument()
    expect(within(tabla).queryByRole('columnheader', { name: 'Teléfono' })).not.toBeInTheDocument()
    expect(within(aaron).queryByText('623577927')).not.toBeInTheDocument()
    expect(within(aaron).getByText('1,45')).toBeInTheDocument()
    expect(within(aaron).getByText('Propia')).toBeInTheDocument()
    expect(within(aaron).getByText('Recogida')).toBeInTheDocument()
    expect(within(tabla).getByText('Debe 20,00 €')).toBeInTheDocument()
    expect(screen.getByText(/2 apuntados, 1 con la ropa/)).toBeInTheDocument()
  })

  it('desde el listado se reimprime la papeleta de quien ya la recogió, sin abrir su ficha', async () => {
    localStorage.setItem('mesa.zona', 'listado')
    const user = userEvent.setup()
    const llamadas = servidor()
    renderWithProviders(<MesaProcesionPage />)
    const tabla = await screen.findByRole('table', { name: 'Apuntados' })
    const pestana = pestanaDeImpresion()

    await user.click(within(tabla).getByRole('button', { name: /Imprimir la papeleta de Aaron/ }))
    await waitFor(() => expect(pestana.location.href).toBe('blob:papeleta'))
    expect(llamadas.some((l) => l.url.endsWith('/procesion/admin/papeletas/1/pdf'))).toBe(true)
    expect(llamadas.some((l) => /\/mesa\/personas\/\d+$/.test(l.url.split('?')[0])), 'no abre la ficha').toBe(false)
    // Solo las recogidas se imprimen: la solicitud sin recoger no tiene botón.
    expect(within(tabla).getAllByRole('button', { name: /Imprimir la papeleta/ })).toHaveLength(1)
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

  it('«Le falta el cíngulo» filtra el listado, y desde la ficha se le da cuando lo haya', async () => {
    const user = userEvent.setup()
    localStorage.setItem('mesa.zona', 'listado')
    const papeleta = {
      id: 5, year: 2027, puesto: 'Nazareno', puestoPedido: 'Nazareno', tramo: null, observaciones: null,
      numTunicaAsignada: '140-107', numCapiroteAsignado: null, numFaraonaAsignada: null, origenTunica: 'ROPERO' as const, cingulo: 'DEBIDO' as const,
      recibo: { id: 1, concepto: 'Papeleta de sitio 2027', importe: 0, estado: 'EXENTO' as const, metodoPago: null, tipo: 'PAPELETA_SITIO' },
    }
    const llamadas = servidor({ apuntados: { ...APUNTADOS, faltanCingulos: 1 }, ficha: { ...FICHA, papeleta, requisitos: AL_DIA } })
    renderWithProviders(<MesaProcesionPage />)

    await user.click(await screen.findByRole('button', { name: 'Le falta el cíngulo · 1' }))
    await waitFor(() => expect(llamadas.some((l) => l.url.includes('/mesa/apuntados') && l.url.includes('faltaCingulo=1'))).toBe(true))

    await buscarAbel(user)
    expect(await screen.findByText(/Se le debe el cíngulo/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dárselo ahora' }))
    await waitFor(() => expect(llamadas.some((l) => l.metodo === 'PATCH' && l.url.includes('/admin/papeletas/5'))).toBe(true))
    expect(llamadas.find((l) => l.url.includes('/admin/papeletas/5'))?.cuerpo).toEqual({ cingulo: 'PRESTADO' })
  })

  it('al corregir, la ropa que ya tiene la papeleta no se mira en el ropero; solo la que se cambia', async () => {
    const user = userEvent.setup()
    localStorage.setItem('mesa.zona', 'listado')
    const papeleta = {
      id: 5, year: 2027, puesto: 'Nazareno', puestoPedido: 'Nazareno', tramo: null, observaciones: null,
      numTunicaAsignada: '140-107', numCapiroteAsignado: null, numFaraonaAsignada: null, origenTunica: 'ROPERO' as const, cingulo: 'DEVUELTO' as const,
      recibo: { id: 1, concepto: 'Papeleta de sitio 2027', importe: 0, estado: 'EXENTO' as const, metodoPago: null, tipo: 'PAPELETA_SITIO' },
    }
    const otraPersona = { id: 3, numero: '140-107', talla: '140', estado: 'PRESTADA' as const, hermano: { id: 5, nombre: 'Lucía', apellidos: 'Rosillo Mansidao' } }
    const llamadas = servidor({
      ficha: { ...FICHA, papeleta, requisitos: AL_DIA },
      prendas: { '140-107': [otraPersona], '140-200': [{ ...otraPersona, numero: '140-200' }] },
    })
    renderWithProviders(<MesaProcesionPage />)
    await buscarAbel(user)

    // La salida pasó y la túnica ya la tiene otra persona: su papeleta se sigue pudiendo corregir.
    expect(await screen.findByText('Asignada en esta papeleta')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
    expect(llamadas.some((l) => l.url.includes('/mesa/prendas'))).toBe(false)

    const tunica = screen.getByRole('textbox', { name: 'N.º de túnica' })
    await user.clear(tunica)
    await user.type(tunica, '140-200')
    expect(await screen.findByText('La tiene Lucía Rosillo Mansidao')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled())
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

describe('MesaProcesionPage · Devolución', () => {
  beforeEach(() => localStorage.setItem('mesa.zona', 'devolucion'))
  const conRopa: FichaDeMesa = {
    ...FICHA, requisitos: AL_DIA,
    prendas: [
      { id: 1, tipo: 'TUNICA', numero: '140-107', talla: '140', fechaAsignacion: '2027-03-08T17:00:00.000Z' },
      { id: 2, tipo: 'CAPIROTE', numero: '150', talla: null, fechaAsignacion: '2027-03-08T17:00:00.000Z' },
    ],
    cingulosSinDevolver: [{ papeletaId: 77, year: 2027 }],
  }
  const lista: SinDevolver[] = [{
    hermano: { id: 20, nombre: 'Abel', apellidos: 'Reyes Díaz', fechaNacimiento: FICHA.fechaNacimiento, numeroHermano: 57, telefono: '622661532' },
    prendas: [{ id: 1, tipo: 'TUNICA', numero: '140-107', fechaAsignacion: null }, { id: 2, tipo: 'CAPIROTE', numero: '150', fechaAsignacion: null }],
    cingulos: [{ id: 77, year: 2027 }],
  }]

  it('la lista dice quién no ha devuelto y qué; lo devuelve todo, lo roto al taller', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({ ficha: conRopa, sinDevolver: lista, respuestas: { '/mesa/devolver': { prendas: [], cingulos: 1, repetida: false } } })
    renderWithProviders(<MesaProcesionPage />)

    const pendientes = await screen.findByRole('region', { name: 'Sin devolver' })
    expect(await within(pendientes).findByText(/túnica 140-107, capirote 150 y cíngulo/)).toBeInTheDocument()
    await user.click(within(pendientes).getByRole('button', { name: /Abel Reyes Díaz/ }))

    expect(await screen.findByText(/al lavado/)).toBeInTheDocument()
    await user.click(screen.getAllByLabelText('Rota: al taller')[1])
    await user.click(screen.getByRole('button', { name: 'Lo devuelve todo' }))

    await waitFor(() => expect(post(llamadas, '/mesa/devolver')).toHaveLength(1))
    expect(post(llamadas, '/mesa/devolver')[0].cuerpo).toMatchObject({ hermanoId: 20, prendas: [{ id: 1 }, { id: 2, rota: true }], cingulos: [77] })
    expect(await screen.findByText(/Abel Reyes: lo ha devuelto todo/)).toBeInTheDocument()
  })

  it('si no trae algo, sigue a su nombre y lo dice', async () => {
    const user = userEvent.setup()
    const llamadas = servidor({ ficha: conRopa, respuestas: { '/mesa/devolver': { prendas: [], cingulos: 0, repetida: false } } })
    renderWithProviders(<MesaProcesionPage />)
    await user.type(await screen.findByRole('textbox', { name: 'Buscar en el censo' }), 'Abel')
    await user.click(await screen.findByRole('button', { name: /Abel Reyes Díaz/ }))
    expect(llamadas.some((l) => l.url.includes('/mesa/personas?') && l.url.includes('zona=devolucion'))).toBe(true)

    await user.click(await screen.findByRole('checkbox', { name: 'Cíngulo' }))
    await user.click(screen.getByRole('button', { name: 'Devolver lo marcado' }))
    await waitFor(() => expect(post(llamadas, '/mesa/devolver')).toHaveLength(1))
    expect(post(llamadas, '/mesa/devolver')[0].cuerpo).toMatchObject({ cingulos: [] })
    expect(await screen.findByText(/Le falta: cíngulo/)).toBeInTheDocument()
  })

  it('en el Rosario no hay devolución: se va de traje', async () => {
    localStorage.setItem('mesa.salida', 'ROSARIO')
    servidor()
    renderWithProviders(<MesaProcesionPage />)
    await screen.findByRole('table', { name: 'Apuntados' })
    expect(screen.queryByRole('tab', { name: 'Devolución' })).not.toBeInTheDocument()
  })
})
