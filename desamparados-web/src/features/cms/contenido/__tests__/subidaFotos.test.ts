import { describe, it, expect, vi, afterEach } from 'vitest'
import { subirFotos } from '../subidaFotos'

const foto = (nombre: string, tipo = 'image/jpeg', bytes = 1000) => new File([new Uint8Array(bytes)], nombre, { type: tipo })

/**
 * Un servidor de subidas de mentira: responde con el nombre del fichero y
 * tarda más en unos que en otros, para que terminen desordenados.
 */
function servidor(retrasos: Record<string, number> = {}, fallan: string[] = []) {
  const simulado = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
    const archivo = (init.body as FormData).get('file') as File
    await new Promise((r) => setTimeout(r, retrasos[archivo.name] ?? 0))
    if (fallan.includes(archivo.name)) {
      return new Response(JSON.stringify({ message: 'El archivo no ha pasado el análisis.' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ message: 'ok', data: { filename: archivo.name, url: '', type: '', size: '' } }), { status: 201, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', simulado)
  return simulado
}

afterEach(() => { vi.unstubAllGlobals() })

describe('subirFotos', () => {
  it('devuelve las rutas en el orden en que se eligieron, no en el que terminan', async () => {
    servidor({ 'a.jpg': 40, 'b.jpg': 5, 'c.jpg': 20, 'd.jpg': 0 })
    const { rutas, fallos } = await subirFotos([foto('a.jpg'), foto('b.jpg'), foto('c.jpg'), foto('d.jpg')], 30)
    expect(rutas).toEqual(['/storage/public/a.jpg', '/storage/public/b.jpg', '/storage/public/c.jpg', '/storage/public/d.jpg'])
    expect(fallos).toEqual([])
  })

  it('las que no son fotos o pesan demasiado no se envían, y dice por qué', async () => {
    const simulado = servidor()
    const { rutas, fallos } = await subirFotos([foto('a.jpg'), foto('b.heic', 'image/heic'), foto('c.png', 'image/png', 6 * 1024 * 1024)], 30)
    expect(rutas).toEqual(['/storage/public/a.jpg'])
    expect(fallos).toEqual([
      { nombre: 'b.heic', motivo: 'tiene que ser JPG, PNG o WebP' },
      { nombre: 'c.png', motivo: 'pesa más de 5 MB' },
    ])
    expect(simulado).toHaveBeenCalledTimes(1)
  })

  it('una que el servidor rechaza no tira las demás', async () => {
    servidor({}, ['b.jpg'])
    const { rutas, fallos } = await subirFotos([foto('a.jpg'), foto('b.jpg'), foto('c.jpg')], 30)
    expect(rutas).toEqual(['/storage/public/a.jpg', '/storage/public/c.jpg'])
    expect(fallos).toEqual([{ nombre: 'b.jpg', motivo: 'El archivo no ha pasado el análisis.' }])
  })

  it('solo sube las que caben en la galería, y cuenta las que sobran', async () => {
    const simulado = servidor()
    const { rutas, sobrantes } = await subirFotos([foto('a.jpg'), foto('b.jpg'), foto('c.jpg')], 2)
    expect(rutas).toHaveLength(2)
    expect(sobrantes).toBe(1)
    expect(simulado).toHaveBeenCalledTimes(2)
  })

  it('no sube más de tres a la vez', async () => {
    let enCurso = 0
    let maximo = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      enCurso += 1; maximo = Math.max(maximo, enCurso)
      await new Promise((r) => setTimeout(r, 10))
      enCurso -= 1
      const archivo = (init.body as FormData).get('file') as File
      return new Response(JSON.stringify({ message: 'ok', data: { filename: archivo.name } }), { status: 201, headers: { 'Content-Type': 'application/json' } })
    }))
    await subirFotos(Array.from({ length: 8 }, (_, i) => foto(`${i}.jpg`)), 30)
    expect(maximo).toBe(3)
  })
})
