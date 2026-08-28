import { describe, it, expect } from 'vitest'
import { cmsTheme } from '../cms'
import theme, { designTokens } from '../index'

describe('tema del CMS', () => {
  it('es claro, al contrario que el de la web pública', () => {
    expect(cmsTheme.palette.mode).toBe('light')
    expect(cmsTheme.palette.background.default).toBe('#f4f2ee')
    expect(cmsTheme.palette.background.paper).toBe('#ffffff')
  })

  it('el texto es oscuro sobre el lienzo claro', () => {
    expect(cmsTheme.palette.text.primary).toBe(designTokens.colors.onSurface)
  })

  it('conserva la identidad: burdeos y Libre Caslon en los títulos', () => {
    expect(cmsTheme.palette.primary.main).toBe(designTokens.colors.secondary)
    expect(cmsTheme.typography.h1.fontFamily).toContain('Libre Caslon Text')
  })

  it('no altera el tema de la web pública', () => {
    // El CMS deriva del tema base; si lo mutara, la web se volvería clara.
    expect(theme.palette.mode).toBe('dark')
    expect(theme.palette.background.default).toBe(designTokens.colors.primaryContainer)
  })
})
