import { createCipheriv, createHmac } from 'node:crypto'

/**
 * La firma de Redsys hecha aparte, sin el código de la API: si las dos
 * coinciden, la API firma como pide el banco, y no solo como ella misma espera.
 *
 * La clave es la pública del entorno de pruebas de Redsys (la que usa la API
 * sin claves propias, domain/redsys.ts): no cobra nada.
 */
export const CLAVE_DE_PRUEBAS = 'sq7HjrUOBfKmC576ILgskD5srU870gJ7'

export function firmaRedsys(parametros: string, pedido: string, clave = CLAVE_DE_PRUEBAS): string {
  const cifrado = createCipheriv('des-ede3-cbc', Buffer.from(clave, 'base64'), Buffer.alloc(8, 0))
  cifrado.setAutoPadding(false)
  // Redsys rellena el número de pedido con ceros hasta múltiplo de 8.
  const relleno = Buffer.alloc(Math.ceil(pedido.length / 8) * 8, 0)
  relleno.write(pedido, 'utf8')
  const claveDelPedido = Buffer.concat([cifrado.update(relleno), cifrado.final()])
  return createHmac('sha256', claveDelPedido).update(parametros).digest('base64')
}

/** Lo que el banco manda a la web al cobrar: los parámetros en base64 y su firma. */
export function avisoDeCobro(pedido: string, centimos: number) {
  const parametros = Buffer.from(JSON.stringify({
    Ds_Order: pedido,
    Ds_Amount: String(centimos),
    Ds_Currency: '978',
    Ds_Response: '0000',
    Ds_AuthorisationCode: '123456',
  })).toString('base64')
  return { Ds_SignatureVersion: 'HMAC_SHA256_V1', Ds_MerchantParameters: parametros, Ds_Signature: firmaRedsys(parametros, pedido) }
}
