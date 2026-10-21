import { expect, test } from '@playwright/test'
import { codigoTotp, credencialesDelCms, datos } from './ayudas'

// La entrada al CMS con el segundo factor, de punta a punta: la contraseña, el
// código que daría el móvil y la cookie de sesión que deja pasar al panel.

test('un cargo sin doble factor lo activa al entrar y después entra con su código', async ({ page, browser }) => {
  const { sinDobleFactor, password } = datos()

  await credencialesDelCms(page, sinDobleFactor.email, password)
  await expect(page.getByRole('heading', { name: 'Activa el doble factor' })).toBeVisible()
  await page.getByRole('button', { name: 'Empezar' }).click()

  // La clave que se enseña para quien no puede escanear el QR.
  const clave = page.locator('span').filter({ hasText: /^[A-Z2-7]{32}$/ })
  const secreto = (await clave.textContent())!.trim()
  await page.getByLabel('Código de 6 dígitos').fill(codigoTotp(secreto))
  await page.getByRole('button', { name: 'Activar' }).click()

  await expect(page.getByText('Guarda ahora estos códigos de respaldo')).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(8)
  await page.getByRole('button', { name: 'Los he guardado' }).click()
  await expect(page).toHaveURL(/\/cms\/?$/)

  // Otra vez desde un navegador limpio: ahora pide el código.
  const otra = await (await browser.newContext()).newPage()
  await credencialesDelCms(otra, sinDobleFactor.email, password)
  await otra.getByLabel('Código de verificación').fill(codigoTotp(secreto, 1))
  await otra.getByRole('button', { name: 'Verificar' }).click()
  await expect(otra).toHaveURL(/\/cms\/?$/)
})

test('un cargo con doble factor no pasa con un código malo y sí con el bueno', async ({ page }) => {
  const { admin, password } = datos()

  await credencialesDelCms(page, admin.email, password)
  const campo = page.getByLabel('Código de verificación')
  await expect(campo).toBeVisible()

  // Un código que no es el de ahora: el del paso de hace diez minutos.
  await campo.fill(codigoTotp(admin.secreto, -20))
  await page.getByRole('button', { name: 'Verificar' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/cms\/acceso/)

  await campo.fill(codigoTotp(admin.secreto))
  await page.getByRole('button', { name: 'Verificar' }).click()
  await expect(page).toHaveURL(/\/cms\/?$/)
})

test('sin sesión, el CMS manda al acceso', async ({ page }) => {
  await page.goto('/cms/paginas')
  await expect(page).toHaveURL(/\/cms\/acceso/)
})
