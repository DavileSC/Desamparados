import { expect, test, type Request } from '@playwright/test'
import { datos, sinAvisoDeCookies } from './ayudas'
import { avisoDeCobro, firmaRedsys } from './redsys'

// Comprar en la tienda sin cuenta, de la ficha del producto al pedido pagado.
//
// Con PAGO_EN_LINEA=redsys (el CI) la web lleva al banco: la prueba no sale a
// Redsys, se queda con el formulario firmado que se le iba a mandar, comprueba
// la firma y hace de banco avisando del cobro. Con el pago simulado (el de
// desarrollo) el pedido queda pagado en el acto y esa parte no se prueba.

test('se compra un producto y el pedido queda pagado', async ({ page }) => {
  const { producto, comprador } = datos()

  let alBanco: Request | null = null
  await page.route('https://sis-t.redsys.es:25443/**', async (ruta) => {
    alBanco = ruta.request()
    await ruta.fulfill({ contentType: 'text/html', body: '<h1>Banco de pruebas</h1>' })
  })

  await page.goto(`/tienda/producto/${producto.id}`)
  await sinAvisoDeCookies(page)
  await expect(page.getByRole('heading', { name: producto.nombre, level: 1 })).toBeVisible()
  await page.getByRole('button', { name: `Añadir una unidad de ${producto.nombre}` }).click()
  await page.getByRole('button', { name: 'Añadir · 25,00 €' }).click()
  await page.getByRole('button', { name: /^Ver la cesta/ }).click()

  const cesta = page.getByRole('complementary', { name: 'Tu cesta' })
  await expect(cesta.getByText('25,00 €').first()).toBeVisible()
  await cesta.getByRole('button', { name: 'Seguir con el pago' }).click()
  await cesta.getByLabel('Nombre y apellidos').fill('Prueba Punta a Punta')
  await cesta.getByLabel('Correo').fill(comprador)
  await cesta.getByLabel('Teléfono').fill('600 00 00 00')
  await cesta.getByRole('button', { name: 'Pagar 25,00 €' }).click()

  await expect.poll(() => alBanco !== null || /\/tienda\/pedido\//.test(page.url()), { timeout: 15_000 }).toBe(true)

  // En el CI la API va con Redsys: si no se pasara por el banco, la prueba
  // estaría en verde sin haber mirado lo que más importa.
  if (process.env.PAGO_EN_LINEA === 'redsys') expect(alBanco, 'la compra tenía que pasar por Redsys').not.toBeNull()

  if (alBanco) {
    const enviado = new URLSearchParams((alBanco as Request).postData() ?? '')
    const parametros = enviado.get('Ds_MerchantParameters')!
    const pedido = JSON.parse(Buffer.from(parametros, 'base64').toString('utf8')) as Record<string, string>
    expect(pedido.DS_MERCHANT_AMOUNT).toBe('2500')
    expect(enviado.get('Ds_Signature')).toBe(firmaRedsys(parametros, pedido.DS_MERCHANT_ORDER))

    // El banco avisa a la API del cobro y devuelve al comprador a la web.
    const aviso = await page.request.post(pedido.DS_MERCHANT_MERCHANTURL, { form: avisoDeCobro(pedido.DS_MERCHANT_ORDER, 2500) })
    expect(aviso.ok()).toBe(true)
    await page.goto(pedido.DS_MERCHANT_URLOK)
  } else {
    test.info().annotations.push({ type: 'aviso', description: 'Pago simulado: no se ha probado el paso por Redsys.' })
  }

  await expect(page.getByText(/^Pedido pagado, Prueba Punta a Punta\./)).toBeVisible({ timeout: 15_000 })
})
