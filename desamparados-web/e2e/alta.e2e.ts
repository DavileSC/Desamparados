import { expect, test, type Page } from '@playwright/test'
import { datos, entrarEnElCms, sinAvisoDeCookies } from './ayudas'

// Pedir el alta por la web, con la foto y el certificado de bautismo, y que la
// solicitud le llegue a Secretaría en el CMS.

/** Un DNI que pasa el validador: la letra es la que le toca al número. */
function dniValido(): string {
  const numero = Math.floor(10_000_000 + Math.random() * 89_999_999)
  return `${numero}${'TRWAGMYFPDXBNJZSQVHLCKE'[numero % 23]}`
}

/**
 * El paso que se está viendo. Todos los pasos están en la página a la vez y
 * los demás van `inert`: «Nombre» sale una vez por paso que lo pide.
 */
const pasoActivo = (page: Page) => page.locator('fieldset:not([inert] fieldset):not([inert])').first()

async function escoger(page: Page, etiqueta: string, opcion: RegExp) {
  await pasoActivo(page).getByRole('combobox', { name: etiqueta }).click()
  await page.getByRole('option', { name: opcion }).click()
}

test('una solicitud de alta llega a Secretaría', async ({ page }) => {
  const { alta, password, secretaria, correoDeVerdad } = datos()
  // El alta avisa al buzón de Secretaría: con la cuenta de correo de verdad,
  // ese aviso saldría. Contra un backend así se salta (el CI no la tiene).
  test.skip(correoDeVerdad, 'la API envía correos de verdad: arráncala con EMAIL_BUZON_PRUEBAS=true para probar el alta')

  const dni = dniValido()
  // Otro correo en cada intento: con el mismo, el reintento del CI sería un
  // alta repetida, que la API no tramita. Sigue acabando en el sufijo de la
  // ejecución, y la recogida lo encuentra.
  const email = alta.replace(/^e2e-alta-/, `e2e-alta${test.info().retry}-`)
  // Una foto de verdad, que la API pueda pasar a WebP: un trozo de la propia página.
  await page.goto('/hazte-hermano')
  await sinAvisoDeCookies(page)
  const foto = await page.screenshot({ clip: { x: 0, y: 0, width: 300, height: 400 } })

  await page.getByRole('radio', { name: 'Quiero ser hermano' }).click()
  const paso = pasoActivo(page)
  await paso.getByLabel('Nombre').fill('Alta')
  await paso.getByLabel('Primer apellido').fill('Punta')
  await paso.getByLabel('Segundo apellido').fill('Prueba')
  await paso.getByLabel('DNI/NIE').fill(dni)
  await paso.getByLabel('Fecha de nacimiento').fill('1990-04-12')
  await escoger(page, 'Sexo', /^Hombre$/)
  await escoger(page, 'Estado civil', /^Soltero/)
  await page.getByRole('button', { name: 'Continuar' }).click()

  await pasoActivo(page).getByLabel('Fecha de bautismo').fill('1990-06-10')
  await pasoActivo(page).getByLabel('Certificado de bautismo').setInputFiles({
    name: 'certificado.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n'),
  })
  await page.getByRole('button', { name: 'Continuar' }).click()

  const contacto = pasoActivo(page)
  await contacto.getByLabel('Email').fill(email)
  await contacto.getByLabel('Teléfono').fill('600123456')
  await contacto.getByLabel('Dirección').fill('Calle Real 14')
  await contacto.getByLabel('Código postal').fill('29013')
  await contacto.getByLabel('Localidad').fill('Málaga')
  await page.getByRole('button', { name: 'Continuar' }).click()

  await escoger(page, 'Forma de pago', /^En Secretaría$/)
  await page.getByRole('button', { name: 'Continuar' }).click()

  await pasoActivo(page).getByLabel('Fotografía').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: foto })
  await pasoActivo(page).getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByLabel('Acepto la política de privacidad').check()
  await page.getByRole('button', { name: 'Enviar solicitud' }).click()
  await expect(page.getByRole('status').getByRole('heading', { name: /^Gracias, Alta\./ })).toBeVisible({ timeout: 20_000 })

  // Secretaría la ve entre las solicitudes del censo.
  await entrarEnElCms(page, secretaria)
  await page.goto('/cms/hermanos?vista=solicitudes')
  await expect(page.getByText(email)).toBeVisible()
})
