import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import CabeceraASangre from '../CabeceraASangre'
import { cejaDePagina, srcSetDeCabecera, tipoDeCabecera } from '../cabecera'
import CATALOGO from '../../../../../shared/paginas-publicas.json'
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'
import type { PaginaDeBloques } from '../../../lib/api/contenido'

describe('cejaDePagina', () => {
  it('dice dónde está la página en el menú, de fuera adentro', () => {
    expect(cejaDePagina('enseres', 'Enseres')).toEqual(['Corporación', 'Sábado de Pasión'])
    expect(cejaDePagina('organos-de-gobierno', 'Órganos de Gobierno')).toEqual(['Corporación', 'Historia'])
    expect(cejaDePagina('caridad', 'Caridad')).toEqual(['Corporación', 'Nuestros fines'])
    expect(cejaDePagina('ajuar', 'Ajuar')).toEqual(['Sagrada titular'])
  })

  it('con los nombres del menú que se pusieron en el CMS, como en la barra', () => {
    const nombres = { '/historia': 'Nuestra historia', '/corporacion': 'No vale' }
    expect(cejaDePagina('organos-de-gobierno', 'Órganos de Gobierno', nombres)).toEqual(['Corporación', 'Nuestra historia'])
  })

  it('no repite una sección que se llama como la página, y las de primer nivel no llevan', () => {
    expect(cejaDePagina('publicaciones', 'Publicaciones')).toEqual([])
    expect(cejaDePagina('contacto', 'Contacto')).toEqual([])
  })

  it('las demás páginas con cabecera a sangre sí la llevan: están dentro de una sección del menú', () => {
    const sinCeja = CATALOGO.paginas
      .filter((p) => tipoDeCabecera(p.slug) === 'a-sangre' && !['contacto', 'publicaciones'].includes(p.slug))
      .filter((p) => cejaDePagina(p.slug, p.nombre).length === 0)
    expect(sinCeja.map((p) => p.slug)).toEqual([])
  })
})

describe('fotos de partida', () => {
  it('toda página con cabecera a sangre nace sin foto (es de cada instalación), pero con su encuadre', () => {
    // El contenido de partida es neutro: la foto la sube cada corporación, o
    // llega con la semilla de su instalación. El encuadre sí tiene que estar:
    // al mezclar, el servidor descarta las claves que el de partida no trae,
    // y sin él no se podría guardar el de la foto que se suba.
    for (const { slug } of CATALOGO.paginas.filter((p) => tipoDeCabecera(p.slug) === 'a-sangre')) {
      const { cabecera } = (POR_DEFECTO as unknown as Record<string, PaginaDeBloques>)[slug]
      expect(cabecera.foto, slug).toBe('')
      expect(cabecera.encuadre, slug).toBeGreaterThanOrEqual(0)
    }
  })

  it('las del repositorio llevan su copia de 1000 px; las subidas, no', () => {
    expect(srcSetDeCabecera('/images/cabeceras/cera.webp')).toBe('/images/cabeceras/cera-1000.webp 1000w, /images/cabeceras/cera.webp 2000w')
    expect(srcSetDeCabecera('/storage/public/abc.jpg')).toBeUndefined()
  })
})

describe('CabeceraASangre', () => {
  const props = {
    titulo: 'Enseres',
    subtitulo: 'El patrimonio del Grupo Parroquial, pieza a pieza.',
    foto: '/images/cabeceras/insignias-de-noche.webp',
    fotoAlt: 'Banderines del cortejo, de noche',
    encuadre: 45,
    ceja: ['Corporación', 'Sábado de Pasión'],
  }

  it('pinta ceja, título como h1, subtítulo y la foto con su descripción y encuadre', () => {
    renderWithProviders(<CabeceraASangre {...props} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Enseres' })).toBeInTheDocument()
    expect(screen.getByText('Corporación · Sábado de Pasión')).toBeInTheDocument()
    expect(screen.getByText(props.subtitulo)).toBeInTheDocument()
    const foto = screen.getByAltText(props.fotoAlt)
    expect(foto).toHaveAttribute('srcset', expect.stringContaining('insignias-de-noche-1000.webp'))
    expect(getComputedStyle(foto).objectPosition).toBe('50% 45%')
  })

  it('sin descripción, la foto es adorno; sin foto, no hay imagen rota', () => {
    const { rerender } = renderWithProviders(<CabeceraASangre {...props} fotoAlt="" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    rerender(<CabeceraASangre {...props} foto="" />)
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Enseres' })).toBeInTheDocument()
  })
})
