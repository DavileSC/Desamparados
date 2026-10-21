import { expect, test } from '@playwright/test'
import { datos, entrarEnElCms } from './ayudas'

// Publicar desde el CMS y verlo en la web pública: una noticia nueva, que no
// toca nada de lo que ya hay (una página de bloques sí lo haría) y que la
// recogida borra al terminar.

test('una noticia publicada en el CMS sale en la web', async ({ page }) => {
  const { redaccion, noticia } = datos()

  await entrarEnElCms(page, redaccion)
  await page.goto('/cms/noticias')
  await page.getByRole('link', { name: 'Nueva noticia' }).click()
  await expect(page.getByRole('heading', { name: 'Nueva noticia', level: 1 })).toBeVisible()

  await page.getByRole('textbox', { name: 'Título', exact: true }).fill(noticia)
  await page.getByRole('textbox', { name: 'Extracto', exact: true }).fill('Extracto de la noticia que publica la prueba de punta a punta.')
  await page.getByRole('textbox', { name: 'Contenido de la noticia' }).fill('Texto de la noticia de prueba.')
  await page.getByRole('button', { name: 'Publicar' }).click()
  // Publicar se confirma: desde ese momento la ve cualquiera.
  const confirmar = page.getByRole('dialog', { name: '¿Publicar la noticia?' })
  await confirmar.getByRole('button', { name: 'Publicar' }).click()
  await expect(confirmar).toBeHidden()
  await expect(page.getByText('Sin guardar todavía')).toBeHidden()

  await page.goto('/noticias')
  await page.getByRole('link', { name: new RegExp(noticia) }).first().click()
  await expect(page.getByRole('heading', { name: noticia, level: 1 })).toBeVisible()
  await expect(page.getByText('Texto de la noticia de prueba.')).toBeVisible()
})
