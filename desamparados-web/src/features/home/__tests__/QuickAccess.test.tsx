import { describe, it, expect, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import { site } from '../../../config/site'
import QuickAccess from '../QuickAccess'

// `site` es de solo lectura en los tipos, pero en tiempo de ejecución es un objeto
// normal: así se simula que alguien rellena el canal de YouTube en la configuración.
const redes = site.redes as { youtube: string | null }
const youtubeOriginal = redes.youtube

describe('QuickAccess', () => {
  afterEach(() => {
    redes.youtube = youtubeOriginal
  })

  it('ofrece seis accesos en una lista, cada uno a su página', () => {
    // Se rompe si un acceso apunta a otra ruta, si vuelve el acceso de hermanos
    // (ya está siempre visible en el menú), si vuelven la agenda o el recorrido
    // (tienen bloque propio en la portada) o si el bloque deja de ser una lista.
    renderWithProviders(<QuickAccess />)

    const lista = screen.getByRole('list', { name: /accesos directos/i })
    const destinos = within(lista).getAllByRole('link').map((enlace) => enlace.getAttribute('href'))

    expect(destinos).toEqual([
      '/hermanos/hazte-hermano',
      '/corporacion/parroquia-pasionistas',
      '/corporacion/nuestros-fines/caridad',
      '/corporacion/historia',
      '/publicaciones/boletines',
      '/contacto',
    ])
  })

  it('anuncia en cada enlace qué hay detrás, no solo su título', () => {
    // Se rompe si la descripción se saca del enlace: un lector de pantalla
    // volvería a oír solo «Boletines», sin contexto.
    renderWithProviders(<QuickAccess />)

    expect(
      screen.getByRole('link', { name: /boletines.*boletín informativo y anuarios/i }),
    ).toHaveAttribute('href', '/publicaciones/boletines')
  })

  it('destaca «Hazte hermano» como primer acceso, con titular y llamada a la acción', () => {
    // Se rompe si la captación de hermanos vuelve a ser un acceso más, sin
    // titular ni botón, o si su texto deja de llegar al lector de pantalla.
    renderWithProviders(<QuickAccess />)

    const lista = screen.getByRole('list', { name: /accesos directos/i })
    const [primero] = within(lista).getAllByRole('link')

    expect(primero).toHaveAttribute('href', '/hermanos/hazte-hermano')
    expect(primero).toHaveAccessibleName(/hazte hermano.*forma parte de nuestra historia.*quiero ser hermano/i)
    expect(primero).toHaveAccessibleDescription(/comunidad de fe/i)
  })

  it('con un número impar de accesos pequeños, Contacto ocupa la fila entera con «Escríbenos»', () => {
    // Hoy son cinco (sin YouTube): si el último no se estira, queda un hueco en el mosaico.
    renderWithProviders(<QuickAccess />)

    const contacto = screen.getByRole('link', { name: /contacto/i })
    expect(within(contacto).getByText('Escríbenos')).toBeInTheDocument()
  })

  it('con YouTube configurado, Contacto vuelve a ser un acceso normal', () => {
    // Con seis accesos pequeños el mosaico cuadra solo: estirar Contacto lo descuadraría.
    redes.youtube = 'https://www.youtube.com/@desamparadosmalaga'
    renderWithProviders(<QuickAccess />)

    expect(screen.getByRole('link', { name: /canal de youtube/i })).toHaveAttribute('href', redes.youtube)
    const contacto = screen.getByRole('link', { name: /contacto/i })
    expect(within(contacto).queryByText('Escríbenos')).not.toBeInTheDocument()
  })
})
