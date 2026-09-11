import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Paginador from '../Paginador'

const meta = { total: 308, page: 2, limit: 20, totalPages: 16 }

describe('Paginador', () => {
  it('dice qué tramo se está viendo y cuántos hay', () => {
    render(<Paginador meta={meta} onPagina={vi.fn()} onTamano={vi.fn()} etiqueta="censo" />)
    expect(screen.getByText(/mostrando 21-40 de 308/i)).toBeInTheDocument()
  })

  it('con una sola página esconde los números pero deja el selector', () => {
    // Es la única forma de cambiar el tamaño: si se esconde, no hay vuelta atrás.
    render(<Paginador meta={{ total: 8, page: 1, limit: 20, totalPages: 1 }} onPagina={vi.fn()} onTamano={vi.fn()} etiqueta="noticias" />)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/resultados por página/i)).toBeInTheDocument()
    expect(screen.getByText(/8 resultados/i)).toBeInTheDocument()
  })

  it('sin onTamano (listados públicos) solo quedan los números de página', () => {
    render(<Paginador meta={meta} onPagina={vi.fn()} etiqueta="noticias" />)
    expect(screen.queryByLabelText(/resultados por página/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/mostrando/i)).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: /paginación de noticias/i })).toBeInTheDocument()
  })

  it('sin onTamano y con una sola página no se pinta nada', () => {
    // «8 resultados» sin nada más que hacer es ruido para el visitante.
    const { container } = render(<Paginador meta={{ total: 8, page: 1, limit: 20, totalPages: 1 }} onPagina={vi.fn()} etiqueta="noticias" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('sin resultados no se pinta nada', () => {
    const { container } = render(<Paginador meta={{ total: 0, page: 1, limit: 20, totalPages: 0 }} onPagina={vi.fn()} onTamano={vi.fn()} etiqueta="censo" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('avisa al pulsar otra página', async () => {
    const user = userEvent.setup()
    const onPagina = vi.fn()
    render(<Paginador meta={meta} onPagina={onPagina} onTamano={vi.fn()} etiqueta="censo" />)
    await user.click(screen.getByRole('button', { name: /ir a la página 3/i }))
    expect(onPagina).toHaveBeenCalledWith(3)
  })

  it('avisa al elegir otro tamaño de página', async () => {
    // El `onChange` del Select no lo disparaba NINGÚN test, en ninguna capa:
    // quitar `onTamano={cambiarTamano}` de cualquiera de las diecisiete
    // pantallas no habría roto nada. Como las diecisiete delegan en este
    // componente, abrir el selector aquí las cubre a todas.
    const user = userEvent.setup()
    const onTamano = vi.fn()
    render(<Paginador meta={meta} onPagina={vi.fn()} onTamano={onTamano} etiqueta="censo" />)

    await user.click(screen.getByLabelText(/resultados por página/i))
    await user.click(await screen.findByRole('option', { name: '50' }))

    expect(onTamano).toHaveBeenCalledWith(50)
  })

  it('si la página pedida ya no existe, lleva a la última', () => {
    // Un enlace viejo con ?pagina=99 no debe dejar al usuario mirando un vacío.
    const onPagina = vi.fn()
    render(<Paginador meta={{ total: 40, page: 99, limit: 20, totalPages: 2 }} onPagina={onPagina} onTamano={vi.fn()} etiqueta="censo" />)
    expect(onPagina).toHaveBeenCalledWith(2)
  })

  it('con una etiqueta de varias palabras, el selector sigue siendo accesible por su etiqueta', () => {
    // Sin sanear, el id con espacios rompe aria-labelledby y el selector se
    // queda sin nombre accesible en toda la aplicación.
    render(<Paginador meta={meta} onPagina={vi.fn()} onTamano={vi.fn()} etiqueta="censo de hermanos" />)
    expect(screen.getByLabelText(/resultados por página/i)).toBeInTheDocument()
  })
})
