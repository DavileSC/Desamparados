import { describe, it, expect, vi, afterEach } from 'vitest'
import { subirImagenPublica, subirPdfPublico } from '../upload'

afterEach(() => { vi.unstubAllGlobals() })

const respuesta = (cuerpo: unknown, status: number) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

describe('subirImagenPublica', () => {
  it('manda el archivo en un formulario a la subida pública y devuelve su ruta relativa', async () => {
    // Se guarda la ruta, no la URL absoluta que devuelve el backend: así la noticia
    // no queda atada al dominio del servidor.
    const espia = vi.fn().mockResolvedValue(respuesta({
      message: 'Archivo subido correctamente',
      data: { url: 'http://localhost:3001/storage/public/abc.webp', filename: 'abc.webp', type: 'image/webp', size: '10 KB' },
    }, 201))
    vi.stubGlobal('fetch', espia)
    const archivo = new File(['x'], 'foto.webp', { type: 'image/webp' })

    await expect(subirImagenPublica(archivo)).resolves.toBe('/storage/public/abc.webp')

    const [url, init] = espia.mock.calls[0]
    expect(String(url)).toContain('/upload/public')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body.get('file') as File).name).toBe('foto.webp')
    // Sin Content-Type a mano: el navegador pone el de multipart con su separador.
    expect(init.headers['Content-Type']).toBeUndefined()
  })

  it('propaga el mensaje del servidor cuando rechaza el archivo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ error: 'El tipo de archivo real no es válido.' }, 400)))

    await expect(subirImagenPublica(new File(['x'], 'foto.png', { type: 'image/png' }))).rejects.toThrow('El tipo de archivo real no es válido.')
  })
})

describe('subirPdfPublico', () => {
  it('sube el PDF a la carpeta pública y devuelve su ruta relativa, que es lo único que admite el servidor', async () => {
    const espia = vi.fn().mockResolvedValue(respuesta({
      message: 'Archivo subido correctamente',
      data: { url: 'http://localhost:3001/storage/public/abc.pdf', filename: 'abc.pdf', type: 'application/pdf', size: '900 KB' },
    }, 201))
    vi.stubGlobal('fetch', espia)

    await expect(subirPdfPublico(new File(['%PDF'], 'boletin.pdf', { type: 'application/pdf' }))).resolves.toBe('/storage/public/abc.pdf')
    expect(String(espia.mock.calls[0][0])).toContain('/upload/public')
  })
})
