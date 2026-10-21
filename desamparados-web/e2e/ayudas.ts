import * as OTPAuth from 'otpauth'
import { expect, type Page } from '@playwright/test'

interface CuentaDelCms { email: string; secreto: string }

/** Lo que crea `scripts/e2e-datos.ts preparar` en la API. */
interface DatosDePrueba {
  password: string
  sinDobleFactor: { email: string }
  /** Cuentas del equipo con el doble factor ya puesto, una por prueba. */
  admin: CuentaDelCms
  redaccion: CuentaDelCms
  secretaria: CuentaDelCms
  hermano: { email: string; salida: string }
  producto: { id: number; nombre: string }
  /** Correos libres para lo que la prueba crea: el comprador y quien pide el alta. */
  comprador: string
  alta: string
  noticia: string
  /** El backend manda los correos de verdad: los avisos a Secretaría saldrían. */
  correoDeVerdad: boolean
}

export function datos(): DatosDePrueba {
  const crudo = process.env.E2E_DATOS
  if (!crudo) throw new Error('Faltan los datos de prueba: las pruebas se lanzan con `npx playwright test`.')
  return JSON.parse(crudo) as DatosDePrueba
}

/**
 * El código del doble factor, como lo daría la app del móvil.
 *
 * La API no acepta dos veces el mismo paso de 30 s (ni uno anterior al último
 * usado). Para entrar otra vez justo después de activarlo, `pasos: 1` da el
 * código del paso siguiente, que el servidor admite por su margen de ±1.
 */
export function codigoTotp(secreto: string, pasos = 0): string {
  const totp = new OTPAuth.TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secreto) })
  return totp.generate({ timestamp: Date.now() + pasos * 30_000 })
}

/** El aviso de cookies tapa el pie y se queda hasta que se contesta: se rechaza, como haría quien no quiere más. */
export async function sinAvisoDeCookies(page: Page) {
  await page.getByRole('dialog', { name: 'Aviso de cookies' }).getByRole('button', { name: 'Rechazar' }).click()
}

/** Entra en el CMS con una cuenta que ya tiene el doble factor. */
export async function entrarEnElCms(page: Page, cuenta: CuentaDelCms) {
  await credencialesDelCms(page, cuenta.email, datos().password)
  await page.getByLabel('Código de verificación').fill(codigoTotp(cuenta.secreto))
  await page.getByRole('button', { name: 'Verificar' }).click()
  await expect(page).toHaveURL(/\/cms\/?$/)
}

/** Rellena el acceso del CMS y pulsa Entrar. */
export async function credencialesDelCms(page: Page, email: string, password: string) {
  await page.goto('/cms/acceso')
  await expect(page.getByRole('heading', { name: 'Acceso a la administración' })).toBeVisible()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}
