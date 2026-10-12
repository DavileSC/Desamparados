import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BloquesDePagina from '../BloquesDePagina'
import { PASO_DEL_FOCO_MS } from '../FinesEnFoco'
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'
import type { Bloque } from '../../../lib/api/contenido'

// En jsdom nada está «a la vista»: se da por visto para que el foco pueda pasar solo.
vi.mock('framer-motion', async (original) => ({ ...(await original<typeof import('framer-motion')>()), useInView: () => true }))

afterEach(() => { vi.useRealTimers() })

// Los anillos y la llamada, del contenido de partida de Nuestros fines; la
// cita que se enfoca, escrita aquí, porque el de partida (neutro) no la trae.
const bloquesDeFines = POR_DEFECTO['nuestros-fines'].bloques as unknown as Bloque[]
const FINES = bloquesDeFines.find((b) => b.tipo === 'anillos')!
const LLAMADA = bloquesDeFines.find((b) => b.tipo === 'llamada')!
const CITA = {
  tipo: 'cita', titulo: '', presentacion: { estilo: 'enfoque', alineacion: 'izquierda' },
  texto: 'Venid a mí todos los que estáis cansados y agobiados, y yo os aliviaré.', autor: 'Jesús', fuente: 'Evangelio según san Mateo, 11, 28',
} as Bloque
const palabra = (nombre: string) => screen.getByRole('button', { name: nombre })

describe('los fines en foco', () => {
  it('pinta los tres nombres con el primero enfocado, y su texto y su botón al lado', () => {
    renderWithProviders(<BloquesDePagina bloques={[FINES]} />)

    expect(palabra('Culto')).toHaveAttribute('aria-pressed', 'true')
    expect(palabra('Caridad')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('I · Culto')).toBeInTheDocument()
    expect(screen.getByText(/La eucaristía y los cultos del año/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver los cultos/i })).toHaveAttribute('href', '/cultos')
    // El texto común va al lado.
    expect(screen.getByText(/La salida procesional es lo que más se ve/)).toBeInTheDocument()
  })

  it('el título va dentro, una sola vez', () => {
    renderWithProviders(<BloquesDePagina bloques={[FINES]} />)
    expect(screen.getAllByRole('heading', { name: 'Tres cosas que no se entienden por separado' })).toHaveLength(1)
  })

  it('el foco pasa solo de un fin al siguiente', () => {
    vi.useFakeTimers()
    renderWithProviders(<BloquesDePagina bloques={[FINES]} />)

    act(() => { vi.advanceTimersByTime(PASO_DEL_FOCO_MS) })
    expect(palabra('Caridad')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('II · Caridad')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /qué hacemos/i })).toHaveAttribute('href', '/nuestros-fines/caridad')
  })

  it('al pulsar una palabra se enfoca esa, y ya no pasa sola', () => {
    vi.useFakeTimers()
    renderWithProviders(<BloquesDePagina bloques={[FINES]} />)

    fireEvent.click(palabra('Formación'))
    expect(palabra('Formación')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('III · Formación')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(PASO_DEL_FOCO_MS * 3) })
    expect(palabra('Formación')).toHaveAttribute('aria-pressed', 'true')
  })

  it('con la disposición de siempre siguen los anillos', () => {
    const enAnillos = { ...FINES, presentacion: { fondo: 'oscuro' } } as Bloque
    renderWithProviders(<BloquesDePagina bloques={[enAnillos]} />)
    expect(screen.queryByRole('button', { name: 'Culto' })).not.toBeInTheDocument()
  })
})

describe('la cita que se enfoca y la llamada en fila', () => {
  it('la cita se lee entera, aunque cada palabra vaya por su cuenta', () => {
    renderWithProviders(<BloquesDePagina bloques={[CITA]} />)
    const cita = document.querySelector('blockquote')!
    expect(cita.textContent).toBe('Venid a mí todos los que estáis cansados y agobiados, y yo os aliviaré.')
    expect(screen.getByText(/Evangelio según san Mateo, 11, 28/)).toBeInTheDocument()
  })

  it('la llamada en fila lleva su texto y su botón', () => {
    renderWithProviders(<BloquesDePagina bloques={[LLAMADA]} />)
    expect(screen.getByText(/desde dentro, hazte hermano/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /hazte hermano/i })).toHaveAttribute('href', '/hazte-hermano')
  })
})
