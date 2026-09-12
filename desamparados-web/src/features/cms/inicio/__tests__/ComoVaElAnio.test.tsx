import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import ComoVaElAnio from '../ComoVaElAnio'
import type { PanelResponse } from '../../../../lib/api/panel'

const PANEL = {
  generadoEn: '2026-09-11T08:00:00.000Z',
  ejercicio: { anio: 2026, cerrado: false },
  censo: {
    activos: 1284, altas12m: 34, bajas12m: 12, sinNumeroHermano: 3,
    serieMensual: [{ mes: '2026-08', activos: 1282 }, { mes: '2026-09', activos: 1284 }],
    movimientosMensuales: [{ mes: '2026-08', altas: 3, bajas: 0 }, { mes: '2026-09', altas: 3, bajas: 1 }],
    porEdad: [{ tramo: '31-45', total: 312 }],
  },
  dinero: {
    porEstado: [
      { estado: 'PAGADO', total: 1126, importe: 33780 },
      { estado: 'DEVUELTO', total: 14, importe: 420 },
    ],
    ejercicio: { anio: 2026, ingresos: 48300, gastos: 35440, saldo: 12860 },
    serieMensual: [{ mes: '2026-08', ingresos: 4100, gastos: 2240 }, { mes: '2026-09', ingresos: 7600, gastos: 4600 }],
    porCategoria: [
      { categoria: 'Cultos y liturgia', tipo: 'GASTO', total: 18, importe: 9800 },
      { categoria: 'Cuotas de hermanos', tipo: 'INGRESO', total: 240, importe: 21000 },
    ],
  },
  procesion: {
    anio: 2026, papeletas: 612,
    porAnio: [{ anio: 2025, total: 604 }, { anio: 2026, total: 612 }],
    porPuesto: [{ etiqueta: 'Nazarenos', total: 418 }, { etiqueta: 'Acólitos', total: 22 }],
    porTalla: [{ etiqueta: 'L', total: 90 }, { etiqueta: 'M', total: 70 }],
    porAlturaHombro: [{ tramo: '170-179', total: 41 }],
  },
  actividad: {
    proximosEventos: [], noticias: { publicadas: 4, borradores: 2 },
    publicaciones: { total: 7, ultima: null },
    reparto: { turnosProximos: 2, citasReservadas: 6, capacidadEstimada: 40 },
    registro: [],
  },
} as unknown as PanelResponse

const DE_2025 = {
  ...PANEL,
  ejercicio: { anio: 2025, cerrado: true },
  // Un censo por edad distinto del de `panelDeHoy`: si «Hermanos por edad»
  // leyera de aquí por error, el test de más abajo lo detectaría.
  censo: { ...PANEL.censo, porEdad: [{ tramo: '18-30', total: 57 }] },
  dinero: { ...PANEL.dinero, ejercicio: { anio: 2025, ingresos: 41000, gastos: 39000, saldo: 2000 } },
  procesion: {
    ...PANEL.procesion,
    anio: 2025,
    papeletas: 604,
    // Puestos distintos de panelDeHoy: sirve para comprobar que «Puestos de
    // la procesión» SÍ sigue al ejercicio elegido (el backend lo acota).
    porPuesto: [{ etiqueta: 'Nazarenos', total: 388 }],
    // Talla y altura de hombro distintas de panelDeHoy: si «Túnicas y
    // varales» leyera de aquí por error, el test de más abajo lo detectaría,
    // igual que ya pasa con «Hermanos por edad».
    porTalla: [{ etiqueta: 'S', total: 5 }],
    porAlturaHombro: [{ tramo: '150-159', total: 3 }],
  },
} as unknown as PanelResponse

function responder(cuerpo: unknown, status = 200) {
  const espia = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }),
  )
  vi.stubGlobal('fetch', espia)
  return espia
}

const montar = () =>
  renderWithProviders(<TemaCmsProvider><ComoVaElAnio panelDeHoy={PANEL} /></TemaCmsProvider>)

afterEach(() => { vi.unstubAllGlobals() })

describe('ComoVaElAnio', () => {
  it('arranca en el ejercicio en curso y no pide nada: ya tiene los datos', () => {
    const espia = responder(PANEL)
    montar()
    expect(screen.getByRole('combobox', { name: /ejercicio/i })).toHaveTextContent('2026')
    expect(espia).not.toHaveBeenCalled()
  })

  it('pinta todas las gráficas con su título', () => {
    responder(PANEL)
    montar()
    for (const titulo of [
      'Censo de hermanos', 'Altas y bajas', 'Ingresos y gastos por mes', 'De dónde entra', 'En qué se gasta',
      'Cobro de recibos', 'Papeletas de sitio', 'Puestos de la procesión', 'Túnicas y varales', 'Hermanos por edad',
    ]) {
      expect(screen.getByRole('heading', { name: titulo })).toBeInTheDocument()
    }
  })

  it('el subtítulo de «Ingresos y gastos por mes» lleva los tres totales del ejercicio', () => {
    responder(PANEL)
    montar()
    expect(screen.getByText('Ingresos 48.300 € · Gastos 35.440 € · Saldo 12.860 €')).toBeInTheDocument()
  })

  it('al elegir un año cerrado pide ese ejercicio y lo dice en la cabecera', async () => {
    const espia = responder(DE_2025)
    montar()
    await userEvent.click(screen.getByRole('combobox', { name: /ejercicio/i }))
    await userEvent.click(screen.getByRole('option', { name: '2025' }))

    await waitFor(() => expect(espia).toHaveBeenCalledWith('/api/panel?anio=2025', expect.anything()))
    expect(await screen.findByText(/Ejercicio 2025 · cerrado/)).toBeInTheDocument()
  })

  it('el gasto por categoría va en euros, no en número de apuntes', () => {
    responder(PANEL)
    montar()
    // La barra lleva el importe redondo; el número de apuntes (18) solo vive en
    // la tabla, como dato secundario.
    expect(screen.getByText('9.800 €')).toBeInTheDocument()
  })

  it('el ingreso por categoría va en euros, no en número de apuntes, y antes del gasto', () => {
    responder(PANEL)
    montar()
    expect(screen.getByText('21.000 €')).toBeInTheDocument()

    // «De dónde entra» y «En qué se gasta» se leen como pareja: la primera
    // va justo antes de la segunda.
    const titulos = screen.getAllByRole('heading', { name: /^(De dónde entra|En qué se gasta)$/ })
    expect(titulos.map((h) => h.textContent)).toEqual(['De dónde entra', 'En qué se gasta'])
  })

  it('los tramos de edad son siempre de hoy, y el subtítulo lo dice', async () => {
    // DE_2025 trae un censo por edad distinto («18-30», 57) del de panelDeHoy
    // («31-45», 312): si la gráfica leyera del ejercicio elegido en vez de
    // panelDeHoy, este test lo pillaría al cambiar de año.
    responder(DE_2025)
    montar()

    // «Túnicas y varales» también dice «a día de hoy», así que la búsqueda
    // se acota a esta tarjeta desde el principio.
    const seccionInicial = screen.getByRole('heading', { name: 'Hermanos por edad' }).closest('section') as HTMLElement
    expect(within(seccionInicial).getByText(/a día de hoy/i)).toBeInTheDocument()
    expect(within(seccionInicial).getAllByText('31-45').length).toBeGreaterThan(0)
    expect(within(seccionInicial).getAllByText('312').length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('combobox', { name: /ejercicio/i }))
    await userEvent.click(screen.getByRole('option', { name: '2025' }))

    // Mientras carga el ejercicio 2025, toda la cuadrícula desaparece un
    // instante; se espera a que «Hermanos por edad» vuelva a existir para no
    // comparar contra un nodo ya desmontado.
    const cabeceraTrasCambiar = await screen.findByRole('heading', { name: 'Hermanos por edad' })
    const tarjeta = cabeceraTrasCambiar.closest('section') as HTMLElement

    // El ejercicio cambió, pero la gráfica sigue enseñando los tramos y las
    // cifras de hoy, no los de DE_2025.
    expect(within(tarjeta).getAllByText('31-45').length).toBeGreaterThan(0)
    expect(within(tarjeta).getAllByText('312').length).toBeGreaterThan(0)
    expect(within(tarjeta).queryByText('18-30')).not.toBeInTheDocument()
    expect(within(tarjeta).queryByText('57')).not.toBeInTheDocument()
  })

  it('«Puestos de la procesión» sí sigue al ejercicio elegido, y el subtítulo dice de cuál', async () => {
    responder(DE_2025)
    montar()

    const seccionInicial = screen.getByRole('heading', { name: 'Puestos de la procesión' }).closest('section') as HTMLElement
    expect(within(seccionInicial).getByText('Papeletas del ejercicio 2026, por puesto')).toBeInTheDocument()
    expect(within(seccionInicial).getAllByText('Acólitos').length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('combobox', { name: /ejercicio/i }))
    await userEvent.click(screen.getByRole('option', { name: '2025' }))

    const cabeceraTrasCambiar = await screen.findByRole('heading', { name: 'Puestos de la procesión' })
    const tarjeta = cabeceraTrasCambiar.closest('section') as HTMLElement

    // El backend acota `porPuesto` con el ejercicio elegido: al cambiar de
    // año, el puesto que solo existía en 2026 desaparece.
    expect(within(tarjeta).getByText('Papeletas del ejercicio 2025, por puesto')).toBeInTheDocument()
    expect(within(tarjeta).queryByText('Acólitos')).not.toBeInTheDocument()
    expect(within(tarjeta).getAllByText('Nazarenos').length).toBeGreaterThan(0)
  })

  it('«Túnicas y varales» son siempre de hoy: tallas y altura de hombro no cambian con el ejercicio', async () => {
    // DE_2025 trae una talla y una altura de hombro distintas de las de
    // panelDeHoy: si la tarjeta leyera del ejercicio elegido en vez de
    // panelDeHoy, este test lo pillaría al cambiar de año.
    responder(DE_2025)
    montar()

    const seccionInicial = screen.getByRole('heading', { name: 'Túnicas y varales' }).closest('section') as HTMLElement
    expect(within(seccionInicial).getAllByText('L').length).toBeGreaterThan(0)
    expect(within(seccionInicial).getAllByText('170-179').length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('combobox', { name: /ejercicio/i }))
    await userEvent.click(screen.getByRole('option', { name: '2025' }))

    const cabeceraTrasCambiar = await screen.findByRole('heading', { name: 'Túnicas y varales' })
    const tarjeta = cabeceraTrasCambiar.closest('section') as HTMLElement

    expect(within(tarjeta).getAllByText('L').length).toBeGreaterThan(0)
    expect(within(tarjeta).getAllByText('170-179').length).toBeGreaterThan(0)
    expect(within(tarjeta).queryByText('S')).not.toBeInTheDocument()
    expect(within(tarjeta).queryByText('150-159')).not.toBeInTheDocument()
  })

  it('cada gráfica ofrece su tabla', () => {
    responder(PANEL)
    montar()
    expect(screen.getAllByText('Ver tabla').length).toBeGreaterThanOrEqual(10)
  })

  it('si el ejercicio elegido falla al cargar, avisa y deja volver al actual', async () => {
    responder({}, 500)
    montar()
    await userEvent.click(screen.getByRole('combobox', { name: /ejercicio/i }))
    await userEvent.click(screen.getByRole('option', { name: '2025' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se ha podido cargar el ejercicio 2025/i)

    await userEvent.click(screen.getByRole('button', { name: /volver al ejercicio en curso/i }))
    expect(screen.getByRole('combobox', { name: /ejercicio/i })).toHaveTextContent('2026')
    expect(screen.getByText(/Ejercicio en curso/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Censo de hermanos' })).toBeInTheDocument()
  })

  it('con las series vacías no revienta', () => {
    const vacio = {
      ...PANEL,
      censo: { ...PANEL.censo, serieMensual: [], movimientosMensuales: [], porEdad: [] },
      dinero: { ...PANEL.dinero, serieMensual: [], porCategoria: [], porEstado: [] },
      procesion: { ...PANEL.procesion, porAnio: [], porPuesto: [], porTalla: [], porAlturaHombro: [] },
    } as unknown as PanelResponse
    responder(vacio)
    renderWithProviders(<TemaCmsProvider><ComoVaElAnio panelDeHoy={vacio} /></TemaCmsProvider>)
    expect(screen.getAllByText(/todavía no hay datos/i).length).toBeGreaterThan(0)
  })
})
