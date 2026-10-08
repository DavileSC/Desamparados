// Fija que el rojo de los avisos de formulario se lee en la web pública
// (oscura) sin cambiar el del CMS en claro, que va sobre papel.
import { describe, it, expect } from 'vitest'
import { crearTemaCms } from '../cms'
import theme, { designTokens } from '../index'

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

describe('contraste del rojo de error', () => {
  it('cumple AA (4,5:1) sobre los fondos oscuros de la web pública', () => {
    for (const fondo of [designTokens.colors.primaryContainer, '#262326', designTokens.colors.footer]) {
      expect(contraste(theme.palette.error.main, fondo)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('su contrastText también se lee sobre el rojo', () => {
    expect(contraste(theme.palette.error.contrastText, theme.palette.error.main)).toBeGreaterThanOrEqual(4.5)
  })

  it('el CMS en claro conserva el rojo de serie, que sobre papel sí cumple', () => {
    const claro = crearTemaCms('claro')
    expect(claro.palette.error.main).toBe(designTokens.colors.error)
    expect(contraste(claro.palette.error.main, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })
})
