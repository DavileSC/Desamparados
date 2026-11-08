import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TemaCmsProvider } from '../../../../app/temaCms'
import PanelRedes from '../PanelRedes'
import type { NoticiaDeLaApi } from '../../../../lib/api/noticias'
import { enlaceParaPublicarEnX } from '../../../../lib/api/x'
import { site } from '../../../../config/site'

const noticia: NoticiaDeLaApi = {
  id: 7, slug: 'besamanos-2026', titulo: 'Besamanos de la Virgen', extracto: 'El sábado, a las seis.',
  contenido: '<p>Texto</p>', imagenUrl: '/storage/public/0123456789abcdef0123456789abcdef.webp',
  visible: true, fijada: false, fecha: '2026-11-03T00:00:00.000Z',
}
const conectada = { conectada: true, usuario: 'grupo_desamparados', caducaEl: '2027-01-02T00:00:00.000Z', conectadoEl: '2026-11-03T00:00:00.000Z', errorAlRenovar: null }
const sinCuenta = { conectada: false, usuario: null, caducaEl: null, conectadoEl: null, errorAlRenovar: null }
const conectadaX = { conectada: true, usuario: 'grupo_x', conectadoEl: '2026-11-08T00:00:00.000Z', errorDeClaves: null }
const sinCuentaX = { conectada: false, usuario: null, conectadoEl: null, errorDeClaves: null }

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => { vi.unstubAllGlobals() })

function montar({
  cuenta = conectada, cuentaX = sinCuentaX, datos = noticia, sucio = false,
  alPublicar = () => json({ instagramId: '1', instagramEnlace: 'https://www.instagram.com/p/abc/', instagramEl: '2026-11-03T10:00:00.000Z' }),
  alPublicarEnX = () => json({ xId: '19', xEnlace: 'https://x.com/grupo_x/status/19', xEl: '2026-11-08T10:00:00.000Z' }),
}: {
  cuenta?: object; cuentaX?: object; datos?: NoticiaDeLaApi; sucio?: boolean; alPublicar?: () => Response; alPublicarEnX?: () => Response
} = {}) {
  const simulado = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (String(url).includes('/instagram/noticias/')) return Promise.resolve(alPublicar())
    if (String(url).includes('/x/noticias/')) return Promise.resolve(alPublicarEnX())
    if (String(url).endsWith('/x')) return Promise.resolve(json(init?.method === 'PUT' ? conectadaX : cuentaX))
    if (init?.method === 'PUT') return Promise.resolve(json(conectada))
    return Promise.resolve(json(cuenta))
  })
  vi.stubGlobal('fetch', simulado)
  render(<QueryClientProvider client={new QueryClient()}><TemaCmsProvider><PanelRedes noticia={datos} sucio={sucio} /></TemaCmsProvider></QueryClientProvider>)
  return simulado
}

describe('PanelRedes', () => {
  it('sin cuenta de X, se abre X con el título y la dirección de la web pública', async () => {
    montar()
    const enlace = await screen.findByRole('link', { name: /publicar en x/i })
    const url = new URL(enlace.getAttribute('href')!)
    expect(url.origin + url.pathname).toBe('https://x.com/intent/post')
    expect(url.searchParams.get('text')).toBe('Besamanos de la Virgen')
    expect(url.searchParams.get('url')).toBe(`${site.url}/noticias/besamanos-2026`)
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

describe('PanelRedes con la cuenta de X', () => {
  it('publica con el texto propuesto y la foto, y dice dónde verlo', async () => {
    const simulado = montar({ cuentaX: conectadaX })
    await userEvent.click(await screen.findByRole('button', { name: /publicar en x/i }))
    const ventana = await screen.findByRole('dialog')
    expect(within(ventana).getByLabelText(/texto del post/i)).toHaveValue(`Besamanos de la Virgen

${site.url}/noticias/besamanos-2026`)
    // Título (22) + dos saltos + el enlace, que cuenta 23.
    expect(within(ventana).getByText('47 / 280')).toBeInTheDocument()
    expect(within(ventana).getByRole('checkbox', { name: /con la foto/i })).toBeChecked()
    await userEvent.click(within(ventana).getByRole('button', { name: /publicar en @grupo_x/i }))
    expect(await screen.findByRole('link', { name: /ver en x/i })).toHaveAttribute('href', 'https://x.com/grupo_x/status/19')
    const [, init] = simulado.mock.calls.find(([url]) => String(url).includes('/x/noticias/7'))!
    expect(JSON.parse(String(init.body))).toMatchObject({ conFoto: true, otraVez: false })
  })

  it('sin la foto, la manda sin ella', async () => {
    const simulado = montar({ cuentaX: conectadaX })
    await userEvent.click(await screen.findByRole('button', { name: /publicar en x/i }))
    const ventana = await screen.findByRole('dialog')
    await userEvent.click(within(ventana).getByRole('checkbox', { name: /con la foto/i }))
    await userEvent.click(within(ventana).getByRole('button', { name: /publicar en @/i }))
    await screen.findByRole('link', { name: /ver en x/i })
    const [, init] = simulado.mock.calls.find(([url]) => String(url).includes('/x/noticias/7'))!
    expect(JSON.parse(String(init.body))).toMatchObject({ conFoto: false })
  })

  it('un texto de más de 280 no deja publicar', async () => {
    montar({ cuentaX: conectadaX })
    await userEvent.click(await screen.findByRole('button', { name: /publicar en x/i }))
    const ventana = await screen.findByRole('dialog')
    const campo = within(ventana).getByLabelText(/texto del post/i)
    await userEvent.clear(campo)
    await userEvent.click(campo)
    await userEvent.paste('x'.repeat(281))
    expect(within(ventana).getByText(/x admite 280/i)).toBeInTheDocument()
    expect(within(ventana).getByRole('button', { name: /publicar en @/i })).toBeDisabled()
  })

  it('conectar manda las cuatro claves sin espacios', async () => {
    const simulado = montar()
    await userEvent.click(await screen.findByRole('button', { name: /conectar x/i }))
    const ventana = await screen.findByRole('dialog')
    await userEvent.type(within(ventana).getByLabelText(/^api key$/i), ' clave1 ')
    await userEvent.type(within(ventana).getByLabelText(/api key secret/i), 'clave2')
    await userEvent.type(within(ventana).getByLabelText(/^access token$/i), '123-clave3')
    expect(within(ventana).getByRole('button', { name: /^conectar$/i })).toBeDisabled()
    await userEvent.type(within(ventana).getByLabelText(/access token secret/i), 'clave4')
    await userEvent.click(within(ventana).getByRole('button', { name: /^conectar$/i }))
    expect(await screen.findByText(/en @grupo_x/i)).toBeInTheDocument()
    const [, init] = simulado.mock.calls.find(([url, i]) => String(url).endsWith('/x') && i?.method === 'PUT')!
    expect(JSON.parse(String(init.body))).toEqual({ apiKey: 'clave1', apiSecret: 'clave2', accessToken: '123-clave3', accessSecret: 'clave4' })
  })

  it('si las claves fallaron, lo avisa con «Volver a conectar»', async () => {
    montar({ cuentaX: { ...conectadaX, errorDeClaves: 'Las claves son de solo lectura.' } })
    expect(await screen.findByText(/solo lectura/i)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /volver a conectar/i })).toHaveLength(1)
  })
})

describe('enlaceParaPublicarEnX', () => {
  it('codifica el título con tildes y signos', () => {
    const url = new URL(enlaceParaPublicarEnX({ titulo: ' ¿Besamanos & Misa? ', direccion: 'https://ejemplo.es/noticias/a' }))
    expect(url.searchParams.get('text')).toBe('¿Besamanos & Misa?')
  })
})
