import { describe, it, expect } from 'vitest'
import { tareasDelDia, repartirTareas } from '../tareas'
import type { PanelResponse } from '../../../../lib/api/panel'

const PANEL = {
  generadoEn: '2026-09-11T08:00:00.000Z',
  ejercicio: { anio: 2026, cerrado: false },
  censo: { activos: 1284, altas12m: 34, bajas12m: 12, sinNumeroHermano: 3, serieMensual: [], movimientosMensuales: [], porEdad: [] },
  dinero: {
    porEstado: [
      { estado: 'PAGADO', total: 1126, importe: 33780 },
      { estado: 'DEVUELTO', total: 14, importe: 420 },
    ],
    devueltosPendientes: { total: 14, importe: 420 },
    ejercicio: { anio: 2026, ingresos: 48300, gastos: 35440, saldo: 12860 },
    serieMensual: [],
    porCategoria: [],
  },
  procesion: { anio: 2026, papeletas: 612, porAnio: [], porPuesto: [], porTalla: [], porAlturaHombro: [] },
  actividad: {
    proximosEventos: [],
    noticias: { publicadas: 4, borradores: 2 },
    publicaciones: { total: 7, ultima: null },
    reparto: { turnosProximos: 2, citasReservadas: 6, capacidadEstimada: 40 },
    registro: [],
  },
} as unknown as PanelResponse

const vacio = {
  ...PANEL,
  censo: { ...PANEL.censo, sinNumeroHermano: 0 },
  dinero: { ...PANEL.dinero, porEstado: [{ estado: 'PAGADO' as const, total: 1126, importe: 33780 }], devueltosPendientes: { total: 0, importe: 0 } },
  actividad: {
    ...PANEL.actividad,
    noticias: { publicadas: 4, borradores: 0 },
    reparto: { turnosProximos: 0, citasReservadas: 0, capacidadEstimada: 0 },
  },
} as unknown as PanelResponse

describe('tareasDelDia', () => {
  it('saca un asunto por cada cosa pendiente, y cada uno con su cargo', () => {
    const tareas = tareasDelDia(PANEL)
    expect(tareas.map((t) => t.clave)).toEqual([
      'recibos-devueltos', 'noticias-borrador', 'hermanos-sin-numero', 'citas-reparto',
    ])
    expect(tareas.map((t) => t.cargo)).toEqual(['Tesorería', 'Redes', 'Secretaría', 'Secretaría'])
  })

  it('los ordena por prisa: lo urgente primero', () => {
    const prioridades = tareasDelDia(PANEL).map((t) => t.prioridad)
    expect(prioridades).toEqual(['urgente', 'pendiente', 'pendiente', 'programado'])
  })

  it('cada estado lleva color y texto, nunca color solo', () => {
    for (const tarea of tareasDelDia(PANEL)) {
      expect(tarea.etiqueta).toMatch(/^(Urgente|Pendiente|Programado)$/)
    }
  })

  it('cuenta en singular cuando solo hay uno', () => {
    const uno = { ...PANEL, censo: { ...PANEL.censo, sinNumeroHermano: 1 } } as PanelResponse
    const tarea = tareasDelDia(uno).find((t) => t.clave === 'hermanos-sin-numero')!
    expect(tarea.titulo).toBe('1 hermano sin número de hermano')
  })

  it('sin nada pendiente, ningún asunto', () => {
    expect(tareasDelDia(vacio)).toEqual([])
  })

  it('el reparto no lleva botón: todavía no hay pantalla de turnos', () => {
    const reparto = tareasDelDia(PANEL).find((t) => t.clave === 'citas-reparto')!
    expect(reparto.accion).toBeNull()
  })

  it('los asuntos con pantalla apuntan a la suya', () => {
    const porClave = Object.fromEntries(tareasDelDia(PANEL).map((t) => [t.clave, t.accion?.href]))
    expect(porClave['recibos-devueltos']).toBe('/cms/tesoreria')
    expect(porClave['noticias-borrador']).toBe('/cms/noticias')
    expect(porClave['hermanos-sin-numero']).toBe('/cms/hermanos')
  })

  it('las tareas de un módulo apagado no salen; las del núcleo sí', () => {
    // PANEL ya trae recibos devueltos, borradores y citas de reparto a la vez.
    const todas = tareasDelDia(PANEL)
    expect(todas.map((t) => t.clave)).toEqual(expect.arrayContaining(['recibos-devueltos', 'noticias-borrador', 'citas-reparto']))
    const sinProcesionNiNoticias = tareasDelDia(PANEL, undefined, new Set())
    expect(sinProcesionNiNoticias.map((t) => t.clave)).toContain('recibos-devueltos')
    expect(sinProcesionNiNoticias.map((t) => t.clave)).not.toContain('citas-reparto')
    expect(sinProcesionNiNoticias.map((t) => t.clave)).not.toContain('noticias-borrador')
  })
})

describe('repartirTareas', () => {
  it('el Hermano Mayor y el Administrador lo llevan todo', () => {
    for (const role of ['ADMIN', 'HERMANO_MAYOR']) {
      const { tuyas, deLaJunta } = repartirTareas(tareasDelDia(PANEL), role)
      expect(tuyas).toHaveLength(4)
      expect(deLaJunta).toHaveLength(0)
    }
  })

  it('un cargo acotado ve lo suyo con botón y el resto sin él', () => {
    const { tuyas, deLaJunta } = repartirTareas(tareasDelDia(PANEL), 'REDES')
    expect(tuyas.map((t) => t.clave)).toEqual(['noticias-borrador'])
    expect(deLaJunta.map((t) => t.cargo)).toEqual(['Tesorería', 'Secretaría', 'Secretaría'])
  })

  it('Secretaría lleva dos asuntos, uno de ellos sin botón', () => {
    const { tuyas } = repartirTareas(tareasDelDia(PANEL), 'SECRETARIA')
    expect(tuyas.map((t) => t.clave)).toEqual(['hermanos-sin-numero', 'citas-reparto'])
    expect(tuyas[1].accion).toBeNull()
  })

  it('sin cargo (aún cargando la sesión) no se atribuye nada', () => {
    const { tuyas, deLaJunta } = repartirTareas(tareasDelDia(PANEL), undefined)
    expect(tuyas).toHaveLength(0)
    expect(deLaJunta).toHaveLength(4)
  })
})
