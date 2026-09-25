import { describe, it, expect, vi, afterEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BloquesDePagina from '../BloquesDePagina'
import { ModoEdicionContext } from '../modoEdicion'
import { ICONOS } from '../iconos'
import { hoyEnMadrid, valorDe, visibilidadDe } from '../presentacion'
import { instanteEnMadrid } from '../fechas'
import CATALOGO from '../../../../../shared/presentacion-de-bloques.json'
import type { Bloque } from '../../../lib/api/contenido'

const TEXTO: Bloque = { tipo: 'texto', titulo: 'Bienvenida', html: '<p>Un párrafo</p>' }
const FOTO = '/storage/public/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp'
const PDF = '/storage/public/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.pdf'

afterEach(() => { vi.useRealTimers() })

describe('los ayudantes de la presentación', () => {
  it('sin decir nada, cada opción vale lo de siempre (el primero de su lista)', () => {
    expect(valorDe(TEXTO, 'fondo')).toBe('ninguno')
    expect(valorDe(TEXTO, 'estilo')).toBe('normal')
    expect(valorDe({ tipo: 'foto' }, 'tamano')).toBe('grande')
  })

  it('un valor que no está en el catálogo vuelve al de siempre', () => {
    expect(valorDe({ ...TEXTO, presentacion: { fondo: 'fucsia' } }, 'fondo')).toBe('ninguno')
    expect(valorDe({ ...TEXTO, presentacion: { fondo: 'papel' } }, 'fondo')).toBe('papel')
  })

  it('la visibilidad: oculto, antes de su día, pasado su día o visible (los dos días cuentan)', () => {
    expect(visibilidadDe({ presentacion: { oculto: true } }, '2026-10-10')).toBe('oculto')
    expect(visibilidadDe({ presentacion: { desde: '2026-10-11' } }, '2026-10-10')).toBe('antes')
    expect(visibilidadDe({ presentacion: { desde: '2026-10-10' } }, '2026-10-10')).toBe('visible')
    expect(visibilidadDe({ presentacion: { hasta: '2026-10-10' } }, '2026-10-10')).toBe('visible')
    expect(visibilidadDe({ presentacion: { hasta: '2026-10-09' } }, '2026-10-10')).toBe('despues')
  })

  it('«hoy» es el de Madrid, no el del reloj de quien mira', () => {
    // 22:30 UTC del 25 de septiembre ya es día 26 en Madrid (verano, +2).
    expect(hoyEnMadrid(new Date('2026-09-25T22:30:00Z'))).toBe('2026-09-26')
  })

  it('la hora de una cuenta atrás es la de Madrid, con su horario de invierno y de verano', () => {
    expect(instanteEnMadrid('2027-03-20T18:00')).toBe(Date.UTC(2027, 2, 20, 17, 0))
    expect(instanteEnMadrid('2026-07-01T18:00')).toBe(Date.UTC(2026, 6, 1, 16, 0))
    expect(instanteEnMadrid('mañana')).toBeNull()
  })

  it('cada icono del catálogo tiene su dibujo', () => {
    expect(Object.keys(ICONOS).sort()).toEqual([...CATALOGO.iconosDeTarjeta].sort())
  })
})

describe('la envoltura de cada bloque', () => {
  it('un bloque oculto o fuera de sus fechas no sale en la web', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-10T10:00:00Z'))
    renderWithProviders(<BloquesDePagina bloques={[
      { ...TEXTO, titulo: 'Se ve' },
      { ...TEXTO, titulo: 'Oculto', presentacion: { oculto: true } },
      { ...TEXTO, titulo: 'Futuro', presentacion: { desde: '2026-11-01' } },
      { ...TEXTO, titulo: 'Caducado', presentacion: { hasta: '2026-10-01' } },
    ]} />)
    expect(screen.getByRole('heading', { name: 'Se ve' })).toBeInTheDocument()
    for (const titulo of ['Oculto', 'Futuro', 'Caducado']) expect(screen.queryByRole('heading', { name: titulo })).not.toBeInTheDocument()
  })

  it('en la vista en vivo del CMS sí sale, con su aviso, y al pulsarlo avisa de cuál es', async () => {
    const user = userEvent.setup()
    const alPulsar = vi.fn()
    renderWithProviders(
      <ModoEdicionContext.Provider value={{ seleccionado: 1, alPulsar }}>
        <BloquesDePagina bloques={[TEXTO, { ...TEXTO, titulo: 'Oculto', presentacion: { oculto: true } }]} />
      </ModoEdicionContext.Provider>,
    )
    expect(screen.getByRole('heading', { name: 'Oculto' })).toBeInTheDocument()
    expect(screen.getByText('Oculto', { selector: 'span' })).toBeInTheDocument()
    await user.click(screen.getByRole('heading', { name: 'Bienvenida' }))
    expect(alPulsar).toHaveBeenCalledWith(0)
  })

  it('el ancla es el id del bloque, y la franja de papel lo envuelve', () => {
    const { container } = renderWithProviders(<BloquesDePagina bloques={[{ ...TEXTO, presentacion: { ancla: 'bienvenida', fondo: 'papel', separador: true } }]} />)
    const bloque = container.querySelector('#bienvenida')!
    expect(bloque).not.toBeNull()
    expect(bloque.querySelector('[data-fondo="papel"]')).not.toBeNull()
    expect(within(bloque as HTMLElement).getByRole('heading', { name: 'Bienvenida' })).toBeInTheDocument()
  })
})

describe('los bloques nuevos', () => {
  it('foto con texto: la foto con su descripción, el texto y el botón a su página', () => {
    renderWithProviders(<BloquesDePagina bloques={[{
      tipo: 'fotoTexto', titulo: '', url: FOTO, alt: 'La Virgen en su camarín', pie: '', html: '<p>Nuestra titular</p>', boton: 'Conócela', enlace: '/desamparados',
    }]} />)
    expect(screen.getByRole('img', { name: 'La Virgen en su camarín' })).toBeInTheDocument()
    expect(screen.getByText('Nuestra titular')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Conócela' })).toHaveAttribute('href', '/desamparados')
  })

  it('cita: en un blockquote, firmada', () => {
    const { container } = renderWithProviders(<BloquesDePagina bloques={[{ tipo: 'cita', titulo: '', texto: 'Madre de los desamparados', autor: 'San Pablo', fuente: 'Homilía' }]} />)
    expect(container.querySelector('blockquote')?.textContent).toBe('Madre de los desamparados')
    expect(screen.getByText('San Pablo, Homilía')).toBeInTheDocument()
  })

  it('vídeo: la portada nuestra hasta que se pulsa el play, y entonces el marco sin cookies', async () => {
    const user = userEvent.setup()
    const { container } = renderWithProviders(<BloquesDePagina bloques={[{
      tipo: 'video', titulo: '', url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', portada: FOTO, alt: 'Salida de 2026', pie: '',
    }]} />)
    expect(container.querySelector('iframe')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Ver el vídeo: Salida de 2026' }))
    expect(container.querySelector('iframe')?.getAttribute('src')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1')
  })

  it('botones: cada uno a su página; uno a una página que no existe no sale', () => {
    renderWithProviders(<BloquesDePagina bloques={[{ tipo: 'botones', titulo: '', botones: [
      { texto: 'Hazte hermano', enlace: '/hazte-hermano', estilo: 'principal' },
      { texto: 'Agenda', enlace: '/agenda#cultos', estilo: 'secundario' },
      { texto: 'Roto', enlace: '/no-existe', estilo: 'secundario' },
    ] }]} />)
    expect(screen.getByRole('link', { name: 'Hazte hermano' })).toHaveAttribute('href', '/hazte-hermano')
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('href', '/agenda#cultos')
    expect(screen.queryByRole('link', { name: 'Roto' })).not.toBeInTheDocument()
  })

  it('preguntas: plegadas, se abren al pulsar; con «la primera abierta», la primera ya lo está', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BloquesDePagina bloques={[{ tipo: 'preguntas', titulo: '', presentacion: { abrirPrimera: true }, preguntas: [
      { pregunta: '¿Cuánto cuesta?', respuesta: 'La cuota es anual.' },
      { pregunta: '¿Dónde está?', respuesta: 'En la parroquia.' },
    ] }]} />)
    expect(screen.getByRole('button', { name: '¿Cuánto cuesta?' })).toHaveAttribute('aria-expanded', 'true')
    const segunda = screen.getByRole('button', { name: '¿Dónde está?' })
    expect(segunda).toHaveAttribute('aria-expanded', 'false')
    await user.click(segunda)
    expect(segunda).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('En la parroquia.')).toBeVisible()
  })

  it('descargas: enlaces de descarga a los PDF', () => {
    renderWithProviders(<BloquesDePagina bloques={[{ tipo: 'descargas', titulo: '', archivos: [{ titulo: 'Reglas', descripcion: 'Aprobadas en 2020', url: PDF }] }]} />)
    const enlace = screen.getByRole('link', { name: /reglas/i })
    expect(enlace).toHaveAttribute('href', PDF)
    expect(enlace).toHaveAttribute('download')
  })

  it('mapa: no llama a Google hasta que se pide', async () => {
    const user = userEvent.setup()
    localStorage.removeItem('desamparados-cookies-consent')
    const { container } = renderWithProviders(<BloquesDePagina bloques={[{ tipo: 'mapa', titulo: '', lugar: 'Parroquia', direccion: 'Calle Eduardo Domínguez Ávila, 6, Málaga' }]} />)
    expect(container.querySelector('iframe')).toBeNull()
    expect(screen.getByRole('link', { name: 'Cómo llegar' })).toHaveAttribute('href', expect.stringContaining('google.com/maps'))
    await user.click(screen.getByRole('button', { name: 'Mostrar el mapa' }))
    expect(container.querySelector('iframe')?.getAttribute('src')).toContain('output=embed')
  })

  it('cuenta atrás: pasada la fecha, se lee el texto final en vez de ceros', () => {
    renderWithProviders(<BloquesDePagina bloques={[{ tipo: 'cuentaAtras', titulo: '', fecha: '2020-03-20T18:00', texto: 'Sábado de Pasión', textoFinal: '¡Ya está en la calle!' }]} />)
    expect(screen.getByText('¡Ya está en la calle!')).toBeInTheDocument()
  })

  it('cuenta atrás: antes de la fecha, días, horas, minutos y segundos', () => {
    renderWithProviders(<BloquesDePagina bloques={[{ tipo: 'cuentaAtras', titulo: '', fecha: '2099-03-20T18:00', texto: 'Sábado de Pasión', textoFinal: '' }]} />)
    expect(screen.getByText('Sábado de Pasión')).toBeInTheDocument()
    expect(screen.getByText(/^Faltan \d+ días para el/)).toBeInTheDocument()
  })

  it('cuenta atrás con números que ruedan: un rodillo por cifra, callado, y la frase para quien no ve', () => {
    renderWithProviders(<BloquesDePagina bloques={[{ tipo: 'cuentaAtras', titulo: '', fecha: '2099-03-20T18:00', texto: '', textoFinal: '', presentacion: { estilo: 'rueda' } }]} />)
    expect(screen.getByText(/^Faltan \d+ días para el/)).toBeInTheDocument()
    // Días (cinco cifras a tantos años vista), horas, minutos y segundos: cada
    // cifra es un rodillo con del 0 al 9, así que hay un «9» por rodillo.
    expect(screen.getAllByText('9')).toHaveLength(11)
    expect(screen.getByText('seg')).toBeInTheDocument()
  })

  it('las tarjetas pueden llevar foto o icono', () => {
    renderWithProviders(<BloquesDePagina bloques={[{ tipo: 'tarjetas', titulo: '', tarjetas: [
      { titulo: 'Caridad', descripcion: '', enlace: '', foto: FOTO, fotoAlt: 'Reparto de alimentos' },
      { titulo: 'Formación', descripcion: '', enlace: '', icono: 'libro' },
    ] }]} />)
    expect(screen.getByRole('img', { name: 'Reparto de alimentos' })).toBeInTheDocument()
    expect(screen.getByTestId('MenuBookIcon')).toBeInTheDocument()
  })
})
