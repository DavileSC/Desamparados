import { describe, it, expect } from 'vitest'
import { crearTemaCms, superficiesCms, graficasCms } from '../cms'
import theme, { designTokens } from '../index'

describe('tema del CMS', () => {
  it('el modo claro es el lienzo de papel de siempre', () => {
    const claro = crearTemaCms('claro')
    expect(claro.palette.mode).toBe('light')
    expect(claro.palette.background.default).toBe('#f4f2ee')
    expect(claro.palette.background.paper).toBe('#ffffff')
    expect(claro.palette.text.primary).toBe(designTokens.colors.onSurface)
  })

  it('el modo oscuro es el de la web pública: mismo lienzo y tarjeta tintada', () => {
    const oscuro = crearTemaCms('oscuro')
    expect(oscuro.palette.mode).toBe('dark')
    expect(oscuro.palette.background.default).toBe(designTokens.colors.primaryContainer) // #262326
    expect(oscuro.palette.background.paper).toBe(designTokens.colors.onPrimaryFixed) // #1d1b1e
    expect(oscuro.palette.text.primary).toBe('#ffffff')
  })

  it('conserva la identidad en los dos: burdeos y Libre Caslon en los títulos', () => {
    for (const modo of ['claro', 'oscuro'] as const) {
      const t = crearTemaCms(modo)
      expect(t.palette.primary.main).toBe(designTokens.colors.secondary)
      expect(t.typography.h1.fontFamily).toContain('Libre Caslon Text')
    }
  })

  it('no altera el tema de la web pública', () => {
    crearTemaCms('claro')
    crearTemaCms('oscuro')
    expect(theme.palette.mode).toBe('dark')
    expect(theme.palette.background.default).toBe(designTokens.colors.primaryContainer)
  })

  it('los estados interactivos del modo claro no se quedan en blanco', () => {
    // Fusionar sobre el tema oscuro deja action y text.disabled en blancos de
    // baja opacidad: invisibles sobre fondo claro.
    const { palette } = crearTemaCms('claro')
    const enBlanco = (valor: string) => valor.includes('255, 255, 255') || valor === '#fff'
    for (const valor of [palette.action.hover, palette.action.selected, palette.action.focus, palette.action.active, palette.text.disabled]) {
      expect(enBlanco(valor)).toBe(false)
    }
  })

  it('la barra lateral es la misma tinta en los dos modos', () => {
    expect(superficiesCms('claro').sidebar).toBe(designTokens.colors.primary) // #100e11
    expect(superficiesCms('oscuro').sidebar).toBe(designTokens.colors.primary)
  })

  it('el bloque destacado va siempre en el tono contrario al tema', () => {
    // Es lo que lo hace destacar en los dos: papel sobre oscuro, tinta sobre claro.
    expect(superficiesCms('oscuro').inverso).toBe('#fbf9f6')
    expect(superficiesCms('claro').inverso).toBe('#1d1b1e')
    expect(superficiesCms('oscuro').inversoTexto).toBe('#1b1c1a')
    expect(superficiesCms('claro').inversoTexto).toBe('#ffffff')
  })

  it('las gráficas tienen su azul por modo y el mismo granate en los dos', () => {
    // Paleta validada con el script de dataviz sobre las superficies reales.
    expect(graficasCms('claro').entrada).toBe('#2a78d6')
    expect(graficasCms('oscuro').entrada).toBe('#3987e5')
    expect(graficasCms('claro').salida).toBe('#b0414a')
    expect(graficasCms('oscuro').salida).toBe('#b0414a')
  })

  it('el año elegido va en tinta y el contexto en gris, nunca al revés', () => {
    for (const modo of ['claro', 'oscuro'] as const) {
      const g = graficasCms(modo)
      expect(g.enfasis).toBe(modo === 'claro' ? '#1b1c1a' : '#ffffff')
      expect(g.enfasis).not.toBe(g.contexto)
    }
  })
})
