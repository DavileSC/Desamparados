import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import Cifras from '../Cifras'
import type { PanelResponse } from '../../../../lib/api/panel'

const PANEL: PanelResponse = {
  generadoEn: '2026-09-14T08:00:00.000Z',
  ejercicio: { anio: 2026, cerrado: false },
  censo: { activos: 1284, altas12m: 34, bajas12m: 12, sinNumeroHermano: 3, serieMensual: [], movimientosMensuales: [], porEdad: [] },
  dinero: {
    porEstado: [{ estado: 'DEVUELTO', total: 14, importe: 420 }],
    devueltosPendientes: { total: 14, importe: 420 },
    ejercicio: { anio: 2026, ingresos: 0, gastos: 0, saldo: 0 },
    serieMensual: [],
    porCategoria: [],
  },
  procesion: { anio: 2026, papeletas: 612, porAnio: [], porPuesto: [], porTalla: [], porAlturaHombro: [] },
  actividad: {
    proximosEventos: [],
    noticias: { publicadas: 4, borradores: 2 },
    publicaciones: { total: 7, ultima: '2026-06-01T00:00:00.000Z' },
    reparto: { turnosProximos: 2, citasReservadas: 6, capacidadEstimada: 40 },
  },
  calendario: { mes: '2026-09', eventos: [], diasDeReparto: [] },
  anio: { eventos: [] },
}

const montar = (panel: PanelResponse) => renderWithProviders(<TemaCmsProvider><Cifras panel={panel} /></TemaCmsProvider>)
const cifra = (nombre: RegExp) => screen.getByRole('button', { name: nombre })

describe('Cifras', () => {
  it('enseña las cuatro cifras de hoy, para elegir, y abre con Hermanos', () => {
    montar(PANEL)
    expect(within(cifra(/^Hermanos activos/)).getByText('1.284')).toBeInTheDocument()
    expect(within(cifra(/^Papeletas 2026/)).getByText('612')).toBeInTheDocument()
    expect(within(cifra(/^Por cobrar 2026/)).getByText('420 €')).toBeInTheDocument()
    expect(cifra(/^Hermanos activos/)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Altas y bajas, mes a mes' })).toBeInTheDocument()
  })

  it('en hermanos, las altas y bajas de cada mes y el cambio neto en doce meses', () => {
    montar({
      ...PANEL,
      censo: { ...PANEL.censo, movimientosMensuales: [{ mes: '2026-08', altas: 5, bajas: 1 }, { mes: '2026-09', altas: 2, bajas: 0 }] },
    })
    expect(screen.getByRole('img', { name: /ago, 5 altas y 1 bajas; sep, 2 altas y 0 bajas/ })).toBeInTheDocument()
    expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === '+22 en doce meses · 34 altas, 12 bajas')).toBeInTheDocument()
  })

  it('al elegir otra cifra, se abre la suya en grande', async () => {
    const usuario = userEvent.setup()
    montar({ ...PANEL, procesion: { ...PANEL.procesion, porAnio: [{ anio: 2025, total: 604 }, { anio: 2026, total: 612 }] } })
    await usuario.click(cifra(/^Papeletas 2026/))
    expect(cifra(/^Papeletas 2026/)).toHaveAttribute('aria-pressed', 'true')
    expect(cifra(/^Hermanos activos/)).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('heading', { name: 'Papeletas de sitio, año a año' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Papeletas por año: 2025, 604; 2026, 612' })).toBeInTheDocument()
    expect(screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === '+8 sobre las 604 de 2025')).toBeInTheDocument()
  })

  it('lo que queda por cobrar, repartido con sus recibos y su importe', async () => {
    montar({
      ...PANEL,
      dinero: {
        ...PANEL.dinero,
        porEstado: [{ estado: 'PENDIENTE', total: 57, importe: 1710 }, { estado: 'REMESADO', total: 23, importe: 690 }],
        anterioresPorCobrar: { total: 4, importe: 120 },
      },
    })
    await userEvent.setup().click(cifra(/^Por cobrar/))
    const pendiente = screen.getByText('Pendiente').closest('li') as HTMLElement
    expect(within(pendiente).getByText('57 recibos')).toBeInTheDocument()
    expect(within(pendiente).getByText('1.710 €')).toBeInTheDocument()
    expect(screen.getByText(/Y 120 € de años anteriores \(4 recibos\)/)).toBeInTheDocument()
  })

  it('la curva del saldo recorre el ejercicio y acaba en la misma cifra que el botón', async () => {
    montar({
      ...PANEL,
      dinero: {
        ...PANEL.dinero,
        ejercicio: { anio: 2026, ingresos: 300, gastos: 100, saldo: 200 },
        // Diciembre del año anterior no cuenta: es de otro ejercicio.
        serieMensual: [
          { mes: '2025-12', ingresos: 5000, gastos: 0 },
          { mes: '2026-01', ingresos: 100, gastos: 50 },
          { mes: '2026-02', ingresos: 200, gastos: 50 },
        ],
      },
    })
    await userEvent.setup().click(cifra(/^Saldo 2026/))
    expect(within(cifra(/^Saldo 2026/)).getByText('200 €')).toBeInTheDocument()
    expect(screen.getByText('1 ene · 0 €')).toBeInTheDocument()
    expect(screen.getByText('feb · 200 €')).toBeInTheDocument()
  })

  it('sin datos, cada gráfica lo dice en vez de quedarse en blanco', () => {
    montar(PANEL)
    expect(screen.getByText('Todavía no hay altas ni bajas que contar.')).toBeInTheDocument()
  })
})
