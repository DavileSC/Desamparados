import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import Asuntos from '../Asuntos'
import NuevoAviso from '../NuevoAviso'
import { tareaDeAviso, type Tarea } from '../tareas'
import type { AvisoJunta } from '../../../../lib/api/panel'

const AVISO: AvisoJunta = {
  id: 7, texto: 'Preparar el orden del día del cabildo', para: 'SECRETARIA', hasta: '2026-11-20', urgente: false,
  creadoPorId: 3, creadorRol: 'HERMANO_MAYOR', createdAt: '2026-09-29T10:00:00.000Z',
}
const HOY = new Date('2026-09-29T10:00:00.000Z')

function ConEstado({ tareas, role, userId, filas }: { tareas: Tarea[]; role?: string; userId?: number; filas?: number }) {
  const [todos, setTodos] = useState(false)
  return <Asuntos tareas={tareas} role={role} userId={userId} todos={todos} onTodos={setTodos} filas={filas} onNuevoAviso={() => {}} />
}
const montar = (tareas: Tarea[], role?: string, userId?: number, filas?: number) =>
  renderWithProviders(<TemaCmsProvider><ConEstado tareas={tareas} role={role} userId={userId} filas={filas} /></TemaCmsProvider>)

afterEach(() => { vi.unstubAllGlobals() })

describe('un aviso de la junta como asunto', () => {
  it('el de un hermano («no es de mi familia») se lee entero; los de la junta, en una línea', () => {
    const deHermano = tareaDeAviso({ ...AVISO, creadorRol: 'USER', texto: 'N.º 305, Bruno Pérez Ruiz: Ana Pérez Ruiz dice que no es de su familia. Ha vuelto al censo importado.' }, HOY)
    expect(deHermano.entero).toBe(true)
    expect(tareaDeAviso(AVISO, HOY).entero).toBe(false)
  })

  it('dice para quién es, quién lo puso y hasta cuándo', () => {
    const tarea = tareaDeAviso(AVISO, HOY)
    expect(tarea).toMatchObject({ prioridad: 'pendiente', titulo: AVISO.texto, cargo: 'Secretaría', detalle: 'para Secretaría · de Hermano Mayor · hasta el 20 nov' })
  })

  it('pasada la fecha sin hacerse, se pone urgente solo', () => {
    const vencido = tareaDeAviso({ ...AVISO, hasta: '2026-09-28' }, HOY)
    expect(vencido.prioridad).toBe('urgente')
    expect(vencido.detalle).toMatch(/vencía ayer$/)
    expect(tareaDeAviso({ ...AVISO, hasta: '2026-09-29' }, HOY)).toMatchObject({ prioridad: 'pendiente', detalle: expect.stringMatching(/vence hoy$/) })
    expect(tareaDeAviso({ ...AVISO, hasta: null, urgente: true }, HOY).prioridad).toBe('urgente')
  })

  it('para toda la junta, lo lleva cualquiera', () => {
    const tarea = tareaDeAviso({ ...AVISO, para: null }, HOY)
    expect(tarea.cargo).toBe('Toda la junta')
    expect(tarea.roles).toEqual(expect.arrayContaining(['REDES', 'ALBACERIA', 'TESORERIA']))
  })
})

describe('los avisos en la lista de asuntos', () => {
  it('llevan su marca y un «Hecho» para quien lo lleva', () => {
    montar([tareaDeAviso(AVISO, HOY)], 'SECRETARIA', 99)
    expect(screen.getByText('Aviso')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Dar por hecho: ${AVISO.texto}` })).toBeInTheDocument()
  })

  it('quien lo puso también lo puede dar por hecho; el resto ve quién lo lleva', () => {
    montar([tareaDeAviso(AVISO, HOY)], 'REDES', 3)
    expect(screen.getByRole('button', { name: /Dar por hecho/ })).toBeInTheDocument()
  })

  it('a otro cargo, solo «Lo lleva»', () => {
    montar([tareaDeAviso(AVISO, HOY)], 'REDES', 99)
    expect(screen.queryByRole('button', { name: /Dar por hecho/ })).not.toBeInTheDocument()
    expect(screen.getByText('Lo lleva Secretaría')).toBeInTheDocument()
  })

  it('«Hecho» se lo dice al servidor', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetch)
    montar([tareaDeAviso(AVISO, HOY)], 'SECRETARIA', 99)
    await userEvent.setup().click(screen.getByRole('button', { name: /Dar por hecho/ }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/panel\/avisos\/7\/hecho$/), expect.objectContaining({ method: 'POST' })))
  })

  it('en pantallas bajas caben tres filas: con cuatro asuntos, dos y «Ver los 4»', () => {
    const cuatro = [1, 2, 3, 4].map((i) => tareaDeAviso({ ...AVISO, id: i, texto: `Aviso ${i}` }, HOY))
    montar(cuatro, 'ADMIN', 1, 3)
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Ver los 4' })).toBeInTheDocument()
  })
})

describe('NuevoAviso', () => {
  it('crea el aviso con su texto, su cargo, su fecha y si es urgente', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(AVISO), { status: 201, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetch)
    const cerrar = vi.fn()
    const usuario = userEvent.setup()
    renderWithProviders(<TemaCmsProvider><NuevoAviso abierto onCerrar={cerrar} /></TemaCmsProvider>)

    expect(screen.getByRole('button', { name: 'Crear aviso' })).toBeDisabled()
    await usuario.type(screen.getByRole('textbox', { name: /Qué hay que hacer/ }), 'Confirmar la banda')
    await usuario.click(screen.getByRole('button', { name: 'Tesorería' }))
    expect(screen.getByRole('button', { name: 'Tesorería' })).toHaveAttribute('aria-pressed', 'true')
    await usuario.type(screen.getByLabelText(/Hasta/), '2026-10-10')
    await usuario.click(screen.getByRole('switch', { name: 'Urgente desde ya' }))
    await usuario.click(screen.getByRole('button', { name: 'Crear aviso' }))

    await waitFor(() => expect(cerrar).toHaveBeenCalled())
    const [url, opciones] = fetch.mock.calls[0]
    expect(url).toMatch(/\/panel\/avisos$/)
    expect(JSON.parse(opciones.body)).toEqual({ texto: 'Confirmar la banda', para: 'TESORERIA', hasta: '2026-10-10', urgente: true })
  })
})
