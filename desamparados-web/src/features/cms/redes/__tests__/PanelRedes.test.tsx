import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TemaCmsProvider } from '../../../../app/temaCms'
import PanelRedes from '../PanelRedes'
import type { NoticiaDeLaApi } from '../../../../lib/api/noticias'
import { enlaceParaPublicarEnX } from '../../../../lib/api/instagram'

const noticia: NoticiaDeLaApi = {
  id: 7, slug: 'besamanos-2026', titulo: 'Besamanos de la Virgen', extracto: 'El sábado, a las seis.',
  contenido: '<p>Texto</p>', imagenUrl: '/storage/public/0123456789abcdef0123456789abcdef.webp',
  visible: true, fijada: false, fecha: '2026-11-03T00:00:00.000Z',
}
const conectada = { conectada: true, usuario: 'grupo_desamparados', caducaEl: '2027-01-02T00:00:00.000Z', conectadoEl: '2026-11-03T00:00:00.000Z', errorAlRenovar: null }
const sinCuenta = { conectada: false, usuario: null, caducaEl: null, conectadoEl: null, errorAlRenovar: null }

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => { vi.unstubAllGlobals() })

function montar({ cuenta = conectada, datos = noticia, sucio = false, alPublicar = () => json({ instagramId: '1', instagramEnlace: 'https://www.instagram.com/p/abc/', instagramEl: '2026-11-03T10:00:00.000Z' }) }: {
  cuenta?: object; datos?: NoticiaDeLaApi; sucio?: boolean; alPublicar?: () => Response
} = {}) {
  const simulado = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (String(url).includes('/instagram/noticias/')) return Promise.resolve(alPublicar())
    if (init?.method === 'PUT') return Promise.resolve(json(conectada))
    return Promise.resolve(json(cuenta))
  })
  vi.stubGlobal('fetch', simulado)
  render(<QueryClientProvider client={new QueryClient()}><TemaCmsProvider><PanelRedes noticia={datos} sucio={sucio} /></TemaCmsProvider></QueryClientProvider>)
  return simulado
}

describe('PanelRedes', () => {
  it('X se abre con el título y la dirección de la noticia, sin API', async () => {
    montar()
    const enlace = await screen.findByRole('link', { name: /publicar en x/i })
    const url = new URL(enlace.getAttribute('href')!)
    expect(url.origin + url.pathname).toBe('https://x.com/intent/post')
    expect(url.searchParams.get('text')).toBe('Besamanos de la Virgen')
    expect(url.searchParams.get('url')).toBe(`${window.location.origin}/noticias/besamanos-2026`)
  })

  it('publica en Instagram con el pie propuesto y dice dónde verla', async () => {
    const simulado = montar()
    await userEvent.click(await screen.findByRole('button', { name: /publicar en instagram/i }))
    const ventana = await screen.findByRole('dialog')
    expect(within(ventana).getByLabelText(/pie de la foto/i)).toHaveValue(
      'Besamanos de la Virgen\n\nEl sábado, a las seis.\n\nLa noticia completa, en el enlace de nuestro perfil.',
    )
    await userEvent.click(within(ventana).getByRole('button', { name: /publicar en @grupo_desamparados/i }))
    expect(await screen.findByRole('link', { name: /ver en instagram/i })).toHaveAttribute('href', 'https://www.instagram.com/p/abc/')
    const [, init] = simulado.mock.calls.find(([url]) => String(url).includes('/instagram/noticias/7'))!
    expect(JSON.parse(String(init.body))).toMatchObject({ otraVez: false })
  })

  it('un pie que Instagram rechazaría no deja publicar', async () => {
    montar()
    await userEvent.click(await screen.findByRole('button', { name: /publicar en instagram/i }))
    const ventana = await screen.findByRole('dialog')
    await userEvent.clear(within(ventana).getByLabelText(/pie de la foto/i))
    expect(within(ventana).getByRole('button', { name: /publicar en @/i })).toBeDisabled()
  })

  it('si Instagram falla, el motivo sale en la ventana', async () => {
    montar({ alPublicar: () => json({ error: 'La conexión con Instagram ha caducado o se ha retirado: vuelve a conectar la cuenta.' }, 409) })
    await userEvent.click(await screen.findByRole('button', { name: /publicar en instagram/i }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /publicar en @/i }))
    expect(await within(screen.getByRole('dialog')).findByText(/vuelve a conectar/i)).toBeInTheDocument()
  })

  it('sin cuenta ofrece conectarla y manda el token pegado', async () => {
    const simulado = montar({ cuenta: sinCuenta })
    await userEvent.click(await screen.findByRole('button', { name: /conectar instagram/i }))
    await userEvent.type(within(await screen.findByRole('dialog')).getByLabelText(/token de instagram/i), '  IGAAtoken123  ')
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^conectar$/i }))
    expect(await screen.findByText(/en @grupo_desamparados/i)).toBeInTheDocument()
    const [, init] = simulado.mock.calls.find(([, i]) => i?.method === 'PUT')!
    expect(JSON.parse(String(init.body))).toEqual({ token: 'IGAAtoken123' })
  })

  it('un borrador o con cambios sin guardar no se manda', async () => {
    montar({ datos: { ...noticia, visible: false } })
    expect(await screen.findByText(/publícala en la web/i)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /publicar en instagram/i })).toBeDisabled()
    expect(screen.getByRole('link', { name: /publicar en x/i })).toHaveAttribute('aria-disabled', 'true')
  })

  it('sin foto, Instagram dice por qué no', async () => {
    montar({ datos: { ...noticia, imagenUrl: null } })
    expect(await screen.findByText(/no publica sin foto/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /publicar en instagram/i })).not.toBeInTheDocument()
  })
})

describe('enlaceParaPublicarEnX', () => {
  it('codifica el título con tildes y signos', () => {
    const url = new URL(enlaceParaPublicarEnX({ titulo: ' ¿Besamanos & Misa? ', direccion: 'https://ejemplo.es/noticias/a' }))
    expect(url.searchParams.get('text')).toBe('¿Besamanos & Misa?')
  })
})
