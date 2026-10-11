// Los colores de la marca en la web: con la de partida (la de Desamparados),
// el tema es el de siempre; con otra, los pares que se usan de verdad siguen
// cumpliendo AA (docs/notas-del-proyecto.md §11).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { contraste, PAPELES_DE_IMPRENTA, PAPELES_DE_MARCA, PARTIDA } from '../../../../shared/colores-de-marca.mjs'
import { INSTALACION } from '../../test/instalacion'
import { IMPRENTA, MARCA } from '../marca'

/** El tema y el CMS calculados de nuevo con otra marca en window.__INSTALACION__. */
async function temasCon(colorPrincipal: string | null, colorAcento: string | null) {
  vi.resetModules()
  window.__INSTALACION__ = { ...INSTALACION, marca: { ...INSTALACION.marca, colorPrincipal, colorAcento } }
  const { default: theme, designTokens } = await import('../index')
  const cms = await import('../cms')
  const { MARCA: marca } = await import('../marca')
  return { theme, designTokens, cms, marca }
}

afterEach(() => {
  window.__INSTALACION__ = INSTALACION
  vi.resetModules()
})

describe('la marca de la web', () => {
  it('con la marca de las pruebas (null) cada papel es exactamente el de partida', () => {
    expect(INSTALACION.marca.colorPrincipal).toBeNull()
    for (const [papel, { partida }] of Object.entries(PAPELES_DE_MARCA)) expect(MARCA[papel as keyof typeof MARCA], papel).toBe(partida)
    for (const [papel, { partida }] of Object.entries(PAPELES_DE_IMPRENTA)) expect(IMPRENTA[papel as keyof typeof IMPRENTA], papel).toBe(partida)
  })

  it('con los dos colores de partida escritos, el tema y el CMS son los mismos que con null', async () => {
    const conNull = await temasCon(null, null)
    const escritos = await temasCon(PARTIDA.colorPrincipal, PARTIDA.colorAcento)
    const valores = (t: typeof conNull) => JSON.stringify({
      tema: t.theme.palette, tokens: t.designTokens, claro: t.cms.crearTemaCms('claro').palette, oscuro: t.cms.crearTemaCms('oscuro').palette,
      superficies: [t.cms.superficiesCms('claro'), t.cms.superficiesCms('oscuro')], graficas: [t.cms.graficasCms('claro'), t.cms.graficasCms('oscuro')],
    })
    expect(valores(escritos)).toBe(valores(conNull))
  })

  it.each([
    ['#1f4e79', '#c0c0c0'], ['#0b6e4f', '#ffd400'], ['#5b2a86', '#00c8ff'], ['#000000', '#ffffff'],
    ['#ffffff', '#000000'], ['#808080', '#808080'], ['#e8a0a0', '#e8a0a0'],
  ])('con %s y %s, el tema y el CMS cumplen AA en los pares de §11', async (principal, acento) => {
    const { theme, cms, marca } = await temasCon(principal, acento)
    // Que de verdad se ha recalculado: si no, todo esto miraría la de partida.
    expect(marca.principal).not.toBe(PAPELES_DE_MARCA.principal.partida)
    expect(theme.palette.primary.main).toBe(marca.principalMedio)
    const FONDO = '#262326'
    const LIENZO = '#121113'
    const blanco = '#ffffff'
    // Blanco sobre el relleno de los botones y sobre primary.main.
    expect(contraste(blanco, String(theme.components?.MuiButton?.styleOverrides?.contained &&
      (theme.components.MuiButton.styleOverrides.contained as { backgroundColor: string }).backgroundColor))).toBeGreaterThanOrEqual(4.5)
    expect(contraste(theme.palette.primary.contrastText, theme.palette.primary.main)).toBeGreaterThanOrEqual(4.5)
    // Lo que se escribe sobre el fondo oscuro: el acento de los enlaces activos y el granate claro.
    for (const fondo of [FONDO, LIENZO]) {
      expect(contraste(theme.palette.secondary.main, fondo), 'secondary.main').toBeGreaterThanOrEqual(4.5)
      expect(contraste(marca.acento, fondo), 'acento').toBeGreaterThanOrEqual(4.5)
      expect(contraste(theme.palette.primary.light, fondo), 'primary.light').toBeGreaterThanOrEqual(4.5)
      expect(contraste(marca.acentoApagado, fondo), 'acentoApagado').toBeGreaterThanOrEqual(4.5)
    }
    // El CMS: el texto de acción y los enlaces sobre la tarjeta y el lienzo de cada modo.
    for (const modo of ['claro', 'oscuro'] as const) {
      const s = cms.superficiesCms(modo)
      for (const fondo of [s.card, s.canvas]) {
        expect(contraste(s.accionTexto, fondo), `${modo}: accionTexto sobre ${fondo}`).toBeGreaterThanOrEqual(4.5)
        expect(contraste(s.enlace, fondo), `${modo}: enlace sobre ${fondo}`).toBeGreaterThanOrEqual(4.5)
      }
      expect(contraste(cms.graficasCms(modo).acento, s.card), `${modo}: acento de las gráficas`).toBeGreaterThanOrEqual(3)
      const tema = cms.crearTemaCms(modo)
      expect(contraste(tema.palette.primary.contrastText, tema.palette.primary.main)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
