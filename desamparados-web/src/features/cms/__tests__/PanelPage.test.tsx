import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import { TemaCmsProvider } from '../../../app/temaCms'
import PanelPage from '../PanelPage'
import { useAuthStore } from '../../altas/auth/store'
import type { PanelResponse } from '../../../lib/api/panel'

const panel: PanelResponse = {
  generadoEn: '2026-09-11T08:00:00.000Z',
  ejercicio: { anio: 2026, cerrado: false },
  censo: {
    activos: 1284,
    altas12m: 34,
    bajas12m: 12,
    sinNumeroHermano: 3,
    serieMensual: [{ mes: '2026-08', activos: 1282 }, { mes: '2026-09', activos: 1284 }],
    movimientosMensuales: [{ mes: '2026-08', altas: 3, bajas: 0 }, { mes: '2026-09', altas: 3, bajas: 1 }],
    porEdad: [{ tramo: '31-45', total: 312 }],
  },
  dinero: {
    porEstado: [
      { estado: 'PAGADO', total: 1126, importe: 33780 },
      { estado: 'PENDIENTE', total: 57, importe: 1710 },
      { estado: 'REMESADO', total: 23, importe: 690 },
      { estado: 'DEVUELTO', total: 14, importe: 420 },
    ],
    devueltosPendientes: { total: 14, importe: 420 },
    ejercicio: { anio: 2026, ingresos: 48300, gastos: 35440, saldo: 12860 },
    serieMensual: [{ mes: '2026-08', ingresos: 4100, gastos: 2240 }, { mes: '2026-09', ingresos: 7600, gastos: 4600 }],
    porCategoria: [{ categoria: 'Cultos y liturgia', tipo: 'GASTO', total: 18, importe: 9800 }],
  },
  procesion: {
    anio: 2026,
    papeletas: 612,
    porAnio: [{ anio: 2025, total: 604 }, { anio: 2026, total: 612 }],
    porPuesto: [{ etiqueta: 'Nazarenos', total: 418 }],
    porTalla: [{ etiqueta: 'L', total: 90 }],
    porAlturaHombro: [{ tramo: '170-179', total: 41 }],
  },
  actividad: {
    proximosEventos: [
      { id: 1, title: 'Misa de hermandad', startDate: '2026-09-14T18:30:00.000Z', type: 'CULTO' },
    ],
    noticias: { publicadas: 4, borradores: 2 },
    publicaciones: { total: 7, ultima: '2026-06-01T00:00:00.000Z' },
    reparto: { turnosProximos: 2, citasReservadas: 6, capacidadEstimada: 40 },
  },
  calendario: { mes: '2026-09', eventos: [], diasDeReparto: [] },
  anio: { eventos: [] },
}

function responder(cuerpo: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }),
  ))
}

const entrarComo = (role: string) =>
  useAuthStore.setState({ status: 'listo', cms: { id: 1, email: 'p@e.es', role, perfiles: [], origen: 'cms' }, hermano: null })

const montar = () => renderWithProviders(<TemaCmsProvider><PanelPage /></TemaCmsProvider>)

beforeEach(() => { localStorage.clear() })
afterEach(() => { vi.unstubAllGlobals() })

describe('Inicio del CMS', () => {
  it('saluda con el cargo y con lo que espera', async () => {
    responder(panel)
    entrarComo('HERMANO_MAYOR')
    montar()
    expect(await screen.findByRole('heading', { level: 1, name: /Buenos días, Hermano Mayor/ })).toBeInTheDocument()
    expect(screen.getByText(/4 asuntos esperando/)).toBeInTheDocument()
  })

  it('abre en «Hoy», con un punto si hay algo urgente', async () => {
    responder(panel)
    entrarComo('ADMIN')
    montar()
    const hoy = await screen.findByRole('tab', { name: /Hoy/ })
    expect(hoy).toHaveAttribute('aria-selected', 'true')
    expect(within(hoy).getByRole('img', { name: 'hay algo urgente' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^Próximo acto/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^El año \d{4}$/ })).toBeInTheDocument()
  })

  it('sin nada urgente, «Hoy» no lleva el punto', async () => {
    responder({ ...panel, dinero: { ...panel.dinero, devueltosPendientes: { total: 0, importe: 0 } } })
    entrarComo('ADMIN')
    montar()
    expect(within(await screen.findByRole('tab', { name: /Hoy/ })).queryByRole('img')).not.toBeInTheDocument()
  })

  it('en «Cifras», las cuatro cifras de hoy; y la pestaña se recuerda', async () => {
    const usuario = userEvent.setup()
    responder(panel)
    entrarComo('ADMIN')
    montar()
    await usuario.click(await screen.findByRole('tab', { name: 'Cifras' }))
    const cifra = (nombre: RegExp) => within(screen.getByRole('button', { name: nombre }))
    expect(cifra(/^Hermanos activos/).getByText('1.284')).toBeInTheDocument()
    expect(cifra(/^Papeletas 2026/).getByText('612')).toBeInTheDocument()
    expect(cifra(/^Por cobrar/).getByText('2.820 €')).toBeInTheDocument() // pendientes + remesados + devueltos
    expect(cifra(/^Saldo 2026/).getByText('12.860 €')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^El año \d{4}$/ })).not.toBeInTheDocument()
    expect(localStorage.getItem('cms.inicio.pestana')).toBe('cifras')
  })

  it('las flechas pasan de una pestaña a otra', async () => {
    const usuario = userEvent.setup()
    responder(panel)
    entrarComo('ADMIN')
    montar()
    await usuario.click(await screen.findByRole('tab', { name: /Hoy/ }))
    await usuario.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Cifras' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Cifras' })).toHaveFocus()
  })

  it('vuelve a la última pestaña abierta', async () => {
    localStorage.setItem('cms.inicio.pestana', 'cifras')
    responder(panel)
    entrarComo('ADMIN')
    montar()
    expect(await screen.findByRole('tab', { name: 'Cifras' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: 'Altas y bajas, mes a mes' })).toBeInTheDocument()
  })

  it('reparte los asuntos según el cargo', async () => {
    responder(panel)
    entrarComo('REDES')
    montar()
    expect(await screen.findByRole('link', { name: /Publicar/ })).toBeInTheDocument()
    expect(screen.getByText('Lo lleva Tesorería')).toBeInTheDocument()
  })

  it('lleva el retablo con la cuenta atrás y el año', async () => {
    responder(panel)
    entrarComo('ADMIN')
    montar()
    expect(await screen.findByRole('img', { name: 'Nuestra Señora de los Desamparados' })).toBeInTheDocument()
    expect(screen.getByText('para la estación de penitencia')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /^El año \d{4}$/ })).toBeInTheDocument()
  })

  it('dice en la cabecera cómo va la web', async () => {
    responder(panel)
    entrarComo('ADMIN')
    montar()
    // La fecha va delante, en la misma línea.
    expect(await screen.findByText(/· En la web: 4 noticias publicadas/)).toBeInTheDocument()
  })

  it('ya no lleva «Para hoy», el calendario del mes ni «Cómo va el año»', async () => {
    responder(panel)
    entrarComo('ADMIN')
    montar()
    await screen.findByRole('heading', { name: /^El año \d{4}$/ })
    expect(screen.queryByRole('heading', { name: 'Para hoy' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Septiembre de 2026' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Cómo va el año' })).not.toBeInTheDocument()
  })

  it('avisa mientras carga', () => {
    responder(panel)
    entrarComo('ADMIN')
    montar()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('explica el fallo si el servidor no responde', async () => {
    responder({}, 500)
    entrarComo('ADMIN')
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se ha podido cargar/i)
  })

  it('aguanta un Grupo Parroquial recién instalado, con todo a cero', async () => {
    responder({
      ...panel,
      censo: { activos: 0, altas12m: 0, bajas12m: 0, sinNumeroHermano: 0, serieMensual: [], movimientosMensuales: [], porEdad: [] },
      dinero: { porEstado: [], devueltosPendientes: { total: 0, importe: 0 }, ejercicio: { anio: 2026, ingresos: 0, gastos: 0, saldo: 0 }, serieMensual: [], porCategoria: [] },
      procesion: { anio: 2026, papeletas: 0, porAnio: [], porPuesto: [], porTalla: [], porAlturaHombro: [] },
      actividad: { ...panel.actividad, proximosEventos: [], noticias: { publicadas: 0, borradores: 0 }, reparto: { turnosProximos: 0, citasReservadas: 0, capacidadEstimada: 0 } },
    })
    entrarComo('ADMIN')
    montar()
    expect(await screen.findByText(/todo al día/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nada pendiente' })).toBeInTheDocument()
  })
})
