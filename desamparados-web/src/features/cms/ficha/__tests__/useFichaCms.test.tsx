import { describe, it, expect, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useParams } from 'react-router-dom'
import { useFichaCms } from '../useFichaCms'

// Fija que una respuesta tardía de la ficha anterior no pisa la nueva cuando
// cambia el origen sin desmontar la pantalla (de /noticias/1/editar a la 2).

beforeEach(() => { sessionStorage.clear() })

function Ficha({ origen, cargar }: { origen: number; cargar: (id: number) => Promise<{ titulo: string }> }) {
  const { form } = useFichaCms({
    listado: '/cms/pruebas', origen, cargar, aFormulario: (d) => d, vacio: { titulo: '' }, errorAlCargar: 'No se ha podido cargar.',
  })
  return <p>{form ? `ficha: ${form.titulo}` : 'cargando'}</p>
}

describe('useFichaCms', () => {
  it('si cambia el origen, la respuesta de la ficha anterior que llega tarde se ignora', async () => {
    const pendientes = new Map<number, (d: { titulo: string }) => void>()
    const cargar = (id: number) => new Promise<{ titulo: string }>((resolver) => { pendientes.set(id, resolver) })

    // Como las pantallas de verdad: la misma ruta con otro id reutiliza el componente.
    function FichaDeLaRuta() { return <Ficha origen={Number(useParams().id)} cargar={cargar} /> }
    const router = createMemoryRouter([{ path: '/f/:id', element: <FichaDeLaRuta /> }], { initialEntries: ['/f/1'] })
    render(<RouterProvider router={router} />)
    await act(async () => { await router.navigate('/f/2') })

    await act(async () => { pendientes.get(2)?.({ titulo: 'la segunda' }) })
    expect(screen.getByText('ficha: la segunda')).toBeInTheDocument()

    await act(async () => { pendientes.get(1)?.({ titulo: 'la primera' }) })
    expect(screen.getByText('ficha: la segunda')).toBeInTheDocument()
  })
})
