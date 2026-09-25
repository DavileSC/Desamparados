import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDeshacer } from '../useDeshacer'
import { aAncla } from '../utilidades'
import PaginaEnVivo from '../PaginaEnVivo'

describe('useDeshacer', () => {
  it('deshace y rehace paso a paso; un cambio nuevo borra lo que había para rehacer', () => {
    const { result } = renderHook(() => useDeshacer(0))
    act(() => result.current.fijar(1))
    act(() => result.current.fijar(2))
    act(() => result.current.deshacer())
    expect(result.current.estado).toBe(1)
    expect(result.current.puedeRehacer).toBe(true)
    act(() => result.current.fijar(5))
    expect(result.current.puedeRehacer).toBe(false)
    act(() => result.current.deshacer())
    expect(result.current.estado).toBe(1)
  })

  it('los cambios seguidos del mismo grupo son un solo paso', () => {
    const { result } = renderHook(() => useDeshacer(''))
    for (const texto of ['S', 'Sá', 'Sáb']) act(() => result.current.fijar(texto, 'titulo'))
    act(() => result.current.fijar('otro', 'subtitulo'))
    act(() => result.current.deshacer())
    expect(result.current.estado).toBe('Sáb')
    act(() => result.current.deshacer())
    expect(result.current.estado).toBe('')
  })

  it('reiniciar olvida la historia: después de guardar no se deshace lo guardado', () => {
    const { result } = renderHook(() => useDeshacer(0))
    act(() => result.current.fijar(1))
    act(() => result.current.reiniciar(1))
    expect(result.current.puedeDeshacer).toBe(false)
  })
})

describe('aAncla', () => {
  it('deja lo escrito como un slug', () => {
    expect(aAncla('Horario de Misas')).toBe('horario-de-misas')
    expect(aAncla('Sábado  de Pasión!')).toBe('sabado-de-pasion-')
    expect(aAncla('  -hola')).toBe('hola')
  })
})

describe('PaginaEnVivo', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'parent')
  afterEach(() => {
    if (original) Object.defineProperty(window, 'parent', original)
    document.querySelectorAll('iframe[data-padre]').forEach((i) => i.remove())
  })

  it('avisa al constructor, pinta el documento que le manda y dice qué bloque se pulsa', async () => {
    // El constructor es la ventana de fuera: aquí, la de un iframe de mentira.
    const marco = document.createElement('iframe')
    marco.dataset.padre = ''
    document.body.appendChild(marco)
    const padre = marco.contentWindow!
    const recibido = vi.spyOn(padre, 'postMessage')
    Object.defineProperty(window, 'parent', { value: padre, configurable: true })

    const router = createMemoryRouter([{ path: '/cms/vista-previa/:slug', element: <PaginaEnVivo /> }], { initialEntries: ['/cms/vista-previa/cultos'] })
    render(<HelmetProvider><QueryClientProvider client={new QueryClient()}><RouterProvider router={router} /></QueryClientProvider></HelmetProvider>)
    await waitFor(() => expect(recibido).toHaveBeenCalledWith({ tipo: 'desamparados:lista' }, window.location.origin))

    const documento = {
      cabecera: { titulo: 'Cultos en vivo', subtitulo: '', foto: '', fotoAlt: '' },
      bloques: [
        { tipo: 'texto', titulo: 'Primero', html: '<p>Uno</p>' },
        { tipo: 'texto', titulo: 'Escondido', html: '<p>Dos</p>', presentacion: { oculto: true } },
      ],
    }
    // Un mensaje de otra ventana no vale; el del constructor, sí.
    fireEvent(window, new MessageEvent('message', { data: { tipo: 'desamparados:borrador', documento, seleccionado: null }, origin: window.location.origin, source: window }))
    expect(screen.queryByText('Cultos en vivo')).not.toBeInTheDocument()
    fireEvent(window, new MessageEvent('message', { data: { tipo: 'desamparados:borrador', documento, seleccionado: 0 }, origin: window.location.origin, source: padre }))

    expect(await screen.findByRole('heading', { name: 'Cultos en vivo' })).toBeInTheDocument()
    // El oculto se ve, con su aviso: es la vista del CMS.
    expect(screen.getByRole('heading', { name: 'Escondido' })).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('heading', { name: 'Escondido' }))
    expect(recibido).toHaveBeenLastCalledWith({ tipo: 'desamparados:pulsado', indice: 1 }, window.location.origin)
  })
})
