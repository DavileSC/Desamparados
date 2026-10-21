import { expect, test } from '@playwright/test'
import { datos } from './ayudas'

// El área de hermanos: entrar con la contraseña (aquí no hay doble factor) y
// encontrar la papeleta de este año con su QR para la puerta.

test('un hermano entra, ve su ficha y la papeleta de este año con el QR', async ({ page }) => {
  const { hermano, password } = datos()

  await page.goto('/acceso')
  await page.getByLabel('Email').fill(hermano.email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/area-hermano\/perfil/)
  await expect(page.getByRole('heading', { name: 'Mi perfil', level: 1 })).toBeVisible()
  await expect(page.getByRole('main').getByText('Prueba Punta a Punta').first()).toBeVisible()

  await page.getByRole('link', { name: 'Procesión' }).click()
  await expect(page.getByRole('heading', { name: 'Papeleta de sitio', level: 1 })).toBeVisible()
  const papeleta = page.getByRole('article', { name: 'Papeleta de Prueba Punta a Punta' })
  await expect(papeleta).toBeVisible()
  await expect(papeleta.getByText(hermano.salida, { exact: false })).toBeVisible()
  await expect(papeleta.getByText('Cirio')).toBeVisible()
  await expect(papeleta.getByRole('img', { name: /^Código QR de la papeleta/ })).toBeVisible()
})

test('con la contraseña mal no entra', async ({ page }) => {
  const { hermano } = datos()

  await page.goto('/acceso')
  await page.getByLabel('Email').fill(hermano.email)
  await page.getByLabel('Contraseña', { exact: true }).fill('No-Es-La-Buena-2026')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page).toHaveURL(/\/acceso/)
})
