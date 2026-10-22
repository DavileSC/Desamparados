import { expect, test } from '@playwright/test'
import { datos, entrarEnElCms } from './ayudas'

// El constructor de páginas: lo que se guarda sale en la web, y quien tenía la
// misma página abierta no la pisa al guardar después (auditoría del
// 22-10-2026, AUD-004). La recogida devuelve la página a como estaba.

test('una página guardada en el CMS sale en la web, y otra pestaña que la tenía abierta no la pisa', async ({ page, context }) => {
  const { paginas, pagina } = datos()
  await entrarEnElCms(page, paginas)

  // Otra pestaña (la misma sesión) abre la página antes de que la primera guarde.
  const otra = await context.newPage()
  await otra.goto(`/cms/paginas/${pagina.slug}`)
  await expect(otra.getByRole('textbox', { name: 'Subtítulo' })).toBeVisible()

  await page.goto(`/cms/paginas/${pagina.slug}`)
  await page.getByRole('textbox', { name: 'Subtítulo' }).fill(pagina.subtitulo)
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText(/Página guardada y publicada/)).toBeVisible()

  // La otra guarda lo suyo: no pasa, se avisa y se puede recargar.
  await otra.getByRole('textbox', { name: 'Subtítulo' }).fill('Lo de la otra pestaña')
  await otra.getByRole('button', { name: 'Guardar', exact: true }).click()
  await otra.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(otra.getByText(/mientras la editabas/)).toBeVisible()
  await otra.getByRole('button', { name: 'Recargar' }).click()
  await expect(otra.getByRole('textbox', { name: 'Subtítulo' })).toHaveValue(pagina.subtitulo)

  await page.goto(pagina.ruta)
  await expect(page.getByText(pagina.subtitulo)).toBeVisible()
})
