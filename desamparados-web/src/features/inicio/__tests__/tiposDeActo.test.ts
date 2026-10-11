import { describe, it, expect, vi } from 'vitest'
import { PAPELES_DE_MARCA, paletaDeMarca } from '../../../../../shared/colores-de-marca.mjs'

/**
 * El color de «Culto» es de significado, como el de los demás tipos de acto:
 * no sigue a la marca. Si la siguiera, una corporación morada (#5b2a86) vería
 * Culto y Procesión del mismo color en la agenda. Se prueba con la marca
 * cambiada a ese morado: los tres tonos de Culto tienen que ser los de hoy,
 * que son los valores de partida de tres papeles (de ahí se toman, para no
 * escribirlos aquí y que la guardiana sin-colores-de-marca no salte).
 */
const DE_HOY = {
  color: PAPELES_DE_MARCA.principal.partida,
  oscuro: PAPELES_DE_MARCA.principalPuntoOscuro.partida,
  claroCms: PAPELES_DE_MARCA.principalPuntoClaro.partida,
}
vi.mock('../../../theme/marca', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../theme/marca')>()),
  MARCA: paletaDeMarca({ colorPrincipal: '#5b2a86', colorAcento: null }),
}))

describe('el color de los tipos de acto no sigue a la marca', () => {
  it('Culto conserva sus tres tonos con otra marca', async () => {
    const { TIPOS } = await import('../agenda')
    const { colorDelTipo } = await import('../../cms/agenda/tiposEvento')
    expect(TIPOS.CULTO.color).toBe(DE_HOY.color)
    expect(TIPOS.CULTO.oscuro).toBe(DE_HOY.oscuro)
    expect(colorDelTipo('CULTO')).toBe(`light-dark(${DE_HOY.claroCms}, ${DE_HOY.oscuro})`)
  })

  it('y no coincide con el de ningún otro tipo', async () => {
    const { TIPOS } = await import('../agenda')
    const colores = Object.values(TIPOS).map((t) => t.color)
    expect(new Set(colores).size).toBe(colores.length)
  })
})
