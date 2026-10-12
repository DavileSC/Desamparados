import { describe, it, expect } from 'vitest'
import { DESTINOS_FIJOS, PREFIJO_NOTICIA, destinosActivos, esDestinoValido } from '../destinos'
// El fuente del router como texto, como en config/__tests__/navegacion.test.ts.
import fuente from '../../routes/index.tsx?raw'

/** Las rutas reales del router: el bloque público y las absolutas de fuera de él. */
function rutasDelRouter(): Set<string> {
  const inicio = fuente.indexOf('<MarcoPublico />')
  const fin = fuente.indexOf("path: '*'", inicio)
  const publicas = [...fuente.slice(inicio, fin).matchAll(/path:\s*'([^']+)'/g)].map((m) => `/${m[1]}`)
  const absolutas = [...fuente.matchAll(/path:\s*'(\/[^']+)'/g)].map((m) => m[1])
  return new Set(['/', ...publicas, ...absolutas])
}

describe('destinos de los enlaces del CMS', () => {
  it('cada destino que ofrece el selector existe en el router: ninguno lleva a «página no encontrada»', () => {
    const rutas = rutasDelRouter()
    for (const destino of DESTINOS_FIJOS) expect(rutas, destino.ruta).toContain(destino.ruta)
  })

  it('la ruta de una noticia existe en el router', () => {
    expect(rutasDelRouter()).toContain(`${PREFIJO_NOTICIA}:slug`)
  })

  it('una ruta inventada no vale; una noticia, sí', () => {
    expect(esDestinoValido('/hola')).toBe(false)
    expect(esDestinoValido('//otro.test')).toBe(false)
    expect(esDestinoValido('/historia')).toBe(true)
    expect(esDestinoValido(`${PREFIJO_NOTICIA}apertura-del-curso`)).toBe(true)
  })

  it('el selector no ofrece las páginas propias si su módulo está apagado, pero un enlace ya guardado a ellas sigue valiendo', () => {
    const rutas = (activos: string[]) => destinosActivos(new Set(activos)).map((d) => d.ruta)
    for (const propia of ['/desamparados', '/rosario', '/sabado-de-pasion', '/sabado-de-pasion/trono']) {
      expect(rutas([]), propia).not.toContain(propia)
      expect(rutas(['paginas-propias']), propia).toContain(propia)
      // Si no, una página que enlazara a ella ya no se podría volver a guardar.
      expect(esDestinoValido(propia)).toBe(true)
    }
    expect(rutas([])).toContain('/ajuar')
    expect(rutas([])).toContain('/historia')
  })
})
