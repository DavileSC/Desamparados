import { expect, test } from '@playwright/test'
import { datos, entrarEnElCms } from './ayudas'

// La puerta del templo en la salida: quien llega sin la papeleta se busca en
// el listado y se apunta a mano. La papeleta es la del hermano de la prueba.

test('en la puerta se busca a quien llega sin papeleta y se apunta que ha entrado', async ({ page }) => {
  const { puerta } = datos()
  await entrarEnElCms(page, puerta)
  await page.goto('/cms/procesion/puerta')

  const listado = page.getByRole('region', { name: 'Listado de la puerta' })
  const buscar = listado.getByLabel('Buscar por nombre, número o tramo')
  await buscar.fill('Punta a Punta')
  await listado.getByRole('listitem').filter({ hasText: 'Prueba Punta a Punta' }).getByRole('button', { name: 'Ha entrado' }).click()

  const resultado = page.getByRole('status')
  await expect(resultado).toContainText('Adelante')
  await expect(resultado).toContainText('Prueba Punta a Punta')

  // Ya no falta: el buscador se vació para el siguiente, y buscándolo otra vez no sale.
  await expect(buscar).toHaveValue('')
  await buscar.fill('Punta a Punta')
  await expect(listado.getByText('Nadie con ese nombre por entrar.')).toBeVisible()
})
