import { describe, it, expect, vi, afterEach } from 'vitest'
import { llamarApi, ErrorDeApi, alModuloNoActivado } from '../cliente'

function responder(status: number, cuerpo: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }),
  ))
}

async function errorDe(ruta: string): Promise<ErrorDeApi> {
  try {
    await llamarApi(ruta, { auth: false })
  } catch (e) {
    return e as ErrorDeApi
  }
  throw new Error('la petición debía fallar')
}

afterEach(() => { vi.unstubAllGlobals() })

describe('llamarApi ante un 400 de validación', () => {
  it('dice qué campos fallan, no solo «Error de validación»', async () => {
    responder(400, {
      status: 'error',
      message: 'Error de validación',
      errors: [
        { field: 'fecha', message: 'Debe ser una fecha válida' },
        { field: 'importe', message: 'Debe ser mayor que cero' },
      ],
    })
    const error = await errorDe('/transacciones')

    expect(error.status).toBe(400)
    expect(error.message).toBe('Error de validación. fecha: Debe ser una fecha válida; importe: Debe ser mayor que cero.')
    expect(error.fields).toEqual({ fecha: 'Debe ser una fecha válida', importe: 'Debe ser mayor que cero' })
  })

  it('con más de tres campos resume el resto', async () => {
    responder(400, {
      message: 'Error de validación',
      errors: ['a', 'b', 'c', 'd', 'e'].map((field) => ({ field, message: 'Obligatorio' })),
    })
    const error = await errorDe('/hermanos')

    expect(error.message).toBe('Error de validación. a: Obligatorio; b: Obligatorio; c: Obligatorio (y 2 más).')
  })

  it('sin detalle de campos deja el mensaje del servidor tal cual', async () => {
    responder(409, { message: 'Ese recibo ya está cobrado.' })
    const error = await errorDe('/recibos/1/cobrar')

    expect(error.message).toBe('Ese recibo ya está cobrado.')
  })
})

describe('llamarApi ante un 404 de módulo apagado', () => {
  it('avisa a quien escuche con la clave del módulo, y no ante un 404 cualquiera', async () => {
    const oyente = vi.fn()
    const dejarDeEscuchar = alModuloNoActivado(oyente)
    responder(404, { status: 'error', error: 'MODULO_NO_ACTIVADO', modulo: 'tienda', message: 'El módulo «Tienda» no está activado en esta instalación.' })
    const error = await errorDe('/tienda/productos')
    expect(error.status).toBe(404)
    expect(error.message).toBe('El módulo «Tienda» no está activado en esta instalación.')
    expect(oyente).toHaveBeenCalledWith('tienda')

    responder(404, { message: 'No existe ese producto.' })
    await errorDe('/tienda/productos/9')
    expect(oyente).toHaveBeenCalledTimes(1)

    dejarDeEscuchar()
    responder(404, { status: 'error', error: 'MODULO_NO_ACTIVADO', modulo: 'tienda', message: 'apagado' })
    await errorDe('/tienda/productos')
    expect(oyente).toHaveBeenCalledTimes(1)
  })
})
