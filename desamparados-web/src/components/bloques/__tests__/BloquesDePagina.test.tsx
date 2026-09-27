import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import { stubFetchPublico } from '../../../test/fetchPublico'
import BloquesDePagina from '../BloquesDePagina'
import { REGISTRO_BLOQUES } from '../registro'
import TIPOS from '../../../../../shared/tipos-de-bloque.json'
import type { Bloque } from '../../../lib/api/contenido'

const TEXTO: Bloque = { tipo: 'texto', titulo: '', html: '<p>Un párrafo</p>' }
const FOTO: Bloque = { tipo: 'foto', titulo: '', url: '/storage/public/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp', alt: 'La Virgen', pie: 'Camarín' }
const TARJETAS: Bloque = {
  tipo: 'tarjetas', titulo: 'Explora la sección',
  tarjetas: [{ titulo: 'Historia', descripcion: 'Orígenes.', enlace: '/historia' }],
}

describe('BloquesDePagina', () => {
  it('el registro cubre todos los tipos del catálogo compartido', () => {
    // Si alguien añade un tipo en shared/ y olvida su componente, la página
    // dejaría un hueco en blanco sin que nada fallara.
    for (const tipo of TIPOS.tipos) {
      expect(REGISTRO_BLOQUES[tipo as keyof typeof REGISTRO_BLOQUES], `falta el componente de «${tipo}»`).toBeDefined()
    }
  })

  it('pinta los bloques en el orden en que vienen', () => {
    renderWithProviders(<BloquesDePagina bloques={[TARJETAS, TEXTO]} />)
    const textos = screen.getAllByText(/Explora la sección|Un párrafo/)
    expect(textos[0].textContent).toContain('Explora la sección')
  })

  it('el bloque de texto pinta el HTML maquetado, no como etiquetas', () => {
    const { container } = renderWithProviders(<BloquesDePagina bloques={[TEXTO]} />)
    expect(container.querySelector('p')?.textContent).toBe('Un párrafo')
    expect(container.textContent).not.toContain('<p>')
  })

  it('la foto lleva su descripción y su pie', () => {
    renderWithProviders(<BloquesDePagina bloques={[FOTO]} />)
    expect(screen.getByAltText('La Virgen')).toBeInTheDocument()
    expect(screen.getByText('Camarín')).toBeInTheDocument()
  })

  it('las tarjetas enlazan donde dicen', () => {
    renderWithProviders(<BloquesDePagina bloques={[TARJETAS]} />)
    expect(screen.getByRole('link', { name: /Historia/ })).toHaveAttribute('href', '/historia')
  })

  it('una página sin bloques no revienta', () => {
    const { container } = renderWithProviders(<BloquesDePagina bloques={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('un tipo desconocido se salta sin tirar la página', () => {
    // El servidor ya lo rechaza al guardar; esto es la segunda red, para un
    // documento viejo en la base tras quitar un tipo del catálogo.
    const raro = { tipo: 'loQueSea', titulo: '' } as unknown as Bloque
    renderWithProviders(<BloquesDePagina bloques={[raro, TEXTO]} />)
    expect(screen.getByText('Un párrafo')).toBeInTheDocument()
  })
})

describe('bloques de la segunda fase', () => {
  const GALERIA: Bloque = {
    tipo: 'galeria',
    titulo: 'Galería',
    medios: [
      {
        tipo: 'foto',
        url: '/storage/public/cccccccccccccccccccccccccccccccc.webp',
        portada: '', alt: 'El trono en la plaza', pie: 'Sábado de Pasión',
      },
      {
        tipo: 'video',
        url: 'https://www.youtube-nocookie.com/embed/aaaaaaaaaaa',
        portada: '/storage/public/dddddddddddddddddddddddddddddddd.webp',
        alt: 'Salida procesional', pie: '',
      },
    ],
  }

  const LLAMADA: Bloque = {
    tipo: 'llamada', titulo: '¿Quieres ser hermano?',
    texto: 'Las solicitudes se abren cada año en septiembre.',
    boton: 'Hazte hermano', enlace: '/hazte-hermano',
  }

  const DATOS: Bloque = {
    tipo: 'datos', titulo: 'Horario de cultos',
    lineas: [
      { etiqueta: 'Misa de hermandad', valor: 'Primer viernes de mes, a las 20:00' },
      { etiqueta: 'Rosario', valor: '' },
    ],
  }

  it('la galería pinta la foto con su descripción', () => {
    renderWithProviders(<BloquesDePagina bloques={[GALERIA]} />)
    expect(screen.getByAltText('El trono en la plaza')).toBeInTheDocument()
  })

  it('el vídeo no carga el marco de YouTube hasta que se pulsa el play', async () => {
    const { container } = renderWithProviders(<BloquesDePagina bloques={[GALERIA]} />)
    // Hasta ese momento se ve la portada nuestra: incrustarlo de entrada avisa
    // a YouTube de la visita sin que nadie haya pedido ver nada.
    expect(container.querySelector('iframe')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: /Reproducir: Salida procesional/ }))
    // Mezcla fotos y vídeos: se reproduce en el visor, que se abre por encima de la página.
    const visor = await screen.findByRole('dialog', { name: /galería ampliada/i })
    expect(visor.querySelector('iframe')?.getAttribute('src')).toContain('youtube-nocookie.com/embed/')
  })

  it('la llamada lleva su botón al destino que dice', () => {
    renderWithProviders(<BloquesDePagina bloques={[LLAMADA]} />)
    expect(screen.getByText('Las solicitudes se abren cada año en septiembre.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Hazte hermano' })).toHaveAttribute('href', '/hazte-hermano')
  })

  it('los datos van en una lista de definiciones, con el valor junto a su concepto', () => {
    // Es lo que hace que un lector de pantalla anuncie cada valor con el nombre
    // al que pertenece, en vez de leer dos listas sueltas.
    const { container } = renderWithProviders(<BloquesDePagina bloques={[DATOS]} />)
    const conceptos = [...container.querySelectorAll('dt')].map((n) => n.textContent)
    expect(conceptos).toEqual(['Misa de hermandad', 'Rosario'])
    expect(container.querySelector('dd')?.textContent).toBe('Primer viernes de mes, a las 20:00')
  })

  it('un valor vacío no rompe la lista: la línea sigue estando', () => {
    const { container } = renderWithProviders(<BloquesDePagina bloques={[DATOS]} />)
    expect(container.querySelectorAll('dd')).toHaveLength(2)
  })
})

describe('bloques de páginas con diseño o datos propios', () => {
  const HITO = {
    periodo: '1954', etiqueta: 'Fundación', titulo: 'Se funda el grupo',
    relato: 'Uno.\n\nDos.', foto: { url: '', alt: '', pie: '' }, tono: 'oro' as const,
  }

  it('la cronología pinta sus hitos en una lista, con los párrafos partidos', () => {
    renderWithProviders(<BloquesDePagina bloques={[{ tipo: 'cronologia', titulo: 'Nuestra historia', hitos: [HITO] }]} />)
    expect(screen.getByRole('list', { name: 'Nuestra historia' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Se funda el grupo' })).toBeInTheDocument()
    expect(screen.getByText('Uno.')).toBeInTheDocument()
    expect(screen.getByText('Dos.')).toBeInTheDocument()
    // Fuera de Historia no lleva anclas: dos cronologías repetirían ids.
    expect(document.getElementById('hito-1')).toBeNull()
  })

  it('el listado pinta su título una sola vez, con el enlace al listado entero', async () => {
    stubFetchPublico(() => Promise.resolve(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })))
    renderWithProviders(<BloquesDePagina bloques={[{ tipo: 'listado', titulo: 'Últimas noticias', fuente: 'noticias-recientes' }]} />)

    expect(screen.getAllByRole('heading', { name: 'Últimas noticias' })).toHaveLength(1)
    expect(screen.getByRole('link', { name: /ver todas las noticias/i })).toHaveAttribute('href', '/noticias')
    expect(await screen.findByText('No hay noticias publicadas.')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('cada fuente del listado pide lo suyo', async () => {
    const casos = [
      ['boletines', '/publications/category/boletin?'],
      ['dossier', '/publications/category/dossier?'],
      ['agenda-proxima', '/events?limit=4'],
      ['agenda', '/events?limit=100'],
    ] as const
    for (const [fuente, url] of casos) {
      const simulado = vi.fn().mockImplementation(() => Promise.resolve(new Response(
        JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )))
      stubFetchPublico(simulado)
      const { unmount } = renderWithProviders(<BloquesDePagina bloques={[{ tipo: 'listado', titulo: '', fuente }]} />)
      await vi.waitFor(() => expect(String(simulado.mock.calls[0]?.[0])).toContain(url))
      unmount()
      vi.unstubAllGlobals()
    }
  })

  it('el contacto pinta la tarjeta con sus líneas, y sin líneas solo el formulario', () => {
    const lineas = [{ etiqueta: 'Email', valor: 'secretaria@desamparados.es' }]
    const { unmount } = renderWithProviders(
      <BloquesDePagina bloques={[{ tipo: 'contacto', titulo: '', tituloDatos: 'Dónde estamos', lineas }]} />,
    )
    expect(screen.getByRole('heading', { name: 'Dónde estamos' })).toBeInTheDocument()
    expect(screen.getByText('secretaria@desamparados.es')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enviar mensaje/i })).toBeInTheDocument()
    unmount()

    renderWithProviders(<BloquesDePagina bloques={[{ tipo: 'contacto', titulo: '', tituloDatos: 'Dónde estamos', lineas: [] }]} />)
    expect(screen.queryByRole('heading', { name: 'Dónde estamos' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enviar mensaje/i })).toBeInTheDocument()
  })
})
