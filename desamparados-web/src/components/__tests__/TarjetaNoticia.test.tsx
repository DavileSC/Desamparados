import { describe, it, expect } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import TarjetaNoticia from '../TarjetaNoticia'
import type { Noticia } from '../../types'

const noticiaDePrueba: Noticia = {
  id: '1',
  titulo: 'Solemne triduo',
  extracto: 'Tres jornadas de oración',
  categoria: 'Noticias',
  fecha: '2026-08-29T10:00:00.000Z',
  slug: 'solemne-triduo',
}

describe('TarjetaNoticia', () => {
  it('es un enlace a la ficha con fecha, título y extracto', () => {
    renderWithProviders(<TarjetaNoticia noticia={noticiaDePrueba} />)
    const tarjeta = screen.getByRole('link', { name: /solemne triduo/i })
    expect(tarjeta).toHaveAttribute('href', '/noticias/solemne-triduo')
    expect(within(tarjeta).getByRole('heading', { level: 3 })).toHaveTextContent('Solemne triduo')
    expect(within(tarjeta).getByText('Tres jornadas de oración')).toBeInTheDocument()
    expect(tarjeta.querySelector('time')).toHaveAttribute('datetime', noticiaDePrueba.fecha)
  })

  it('no repite la categoría: en el archivo todas son noticias', () => {
    // Se rompe si vuelve la etiqueta «NOTICIAS» en cada tarjeta.
    renderWithProviders(<TarjetaNoticia noticia={noticiaDePrueba} />)
    expect(screen.queryByText(/^noticias$/i)).not.toBeInTheDocument()
  })

  it('sin foto pone una placa con el escudo velado, y con foto la usa', () => {
    const { unmount } = renderWithProviders(<TarjetaNoticia noticia={noticiaDePrueba} />)
    expect(screen.getByTestId('placa-noticia').querySelector('img')).toHaveAttribute('src', '/images/escudo-grupo.webp')
    unmount()

    renderWithProviders(<TarjetaNoticia noticia={{ ...noticiaDePrueba, imagen: '/storage/triduo.jpg' }} />)
    expect(screen.getByRole('link').querySelector('img')).toHaveAttribute('src', '/storage/triduo.jpg')
    expect(screen.queryByTestId('placa-noticia')).not.toBeInTheDocument()
  })

  it('marca la destacada para que el listado le dé todo el ancho', () => {
    renderWithProviders(<TarjetaNoticia noticia={noticiaDePrueba} destacada />)
    expect(screen.getByRole('link')).toHaveAttribute('data-destacada', 'true')
  })

  it('si la foto no carga, pone la placa y no el icono de imagen rota', () => {
    renderWithProviders(<TarjetaNoticia noticia={{ ...noticiaDePrueba, imagen: '/storage/public/ya-no-esta.jpg' }} />)
    fireEvent.error(screen.getByRole('link').querySelector('img')!)
    expect(screen.getByTestId('placa-noticia')).toBeInTheDocument()
    // Ya no queda la foto rota: la única imagen es el escudo de la placa.
    const imagenes = [...screen.getByRole('link').querySelectorAll('img')].map((img) => img.getAttribute('src'))
    expect(imagenes).toEqual(['/images/escudo-grupo.webp'])
  })
})
