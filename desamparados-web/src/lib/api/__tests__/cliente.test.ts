import { describe, it, expect, vi, afterEach } from 'vitest'
import { llamarApi, ErrorDeApi } from '../cliente'

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
