import { describe, it, expect } from 'vitest'
import { DESTINOS_FIJOS, PREFIJO_NOTICIA, destinosActivos, esDestinoValido, esEnlaceVivo } from '../destinos'
// El fuente del router como texto, como en config/__tests__/navegacion.test.ts.
import fuente from '../../routes/index.tsx?raw'
import { paginasPublicasActivas } from '../../app/cmsNavegacion'

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

  it('una dirección antigua que redirige vale, pero el selector no la ofrece', () => {
    // /parroquia-pasionistas pasó a /parroquia (12-10-2026): un enlace ya guardado no impide guardar.
    expect(esDestinoValido('/parroquia-pasionistas#como-llegar')).toBe(true)
    expect(DESTINOS_FIJOS.map((d) => d.ruta)).not.toContain('/parroquia-pasionistas')
    expect(DESTINOS_FIJOS.map((d) => d.ruta)).toContain('/parroquia')
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

  it('el selector no ofrece las páginas de un módulo apagado: agenda, noticias, hazte hermano', () => {
    const rutas = (activos: string[]) => destinosActivos(new Set(activos)).map((d) => d.ruta)
    for (const [ruta, modulo] of [['/agenda', 'agenda'], ['/noticias', 'noticias'], ['/publicaciones', 'publicaciones'], ['/hazte-hermano', 'alta-web']]) {
      expect(rutas([]), ruta).not.toContain(ruta)
      expect(rutas([modulo]), ruta).toContain(ruta)
    }
  })

  it('un enlace vivo es válido y de un módulo encendido; una noticia es de Noticias', () => {
    expect(esEnlaceVivo('/agenda', new Set())).toBe(false)
    expect(esEnlaceVivo('/agenda', new Set(['agenda']))).toBe(true)
    expect(esEnlaceVivo('/hazte-hermano', new Set(['agenda']))).toBe(false)
    expect(esEnlaceVivo(`${PREFIJO_NOTICIA}apertura-del-curso`, new Set())).toBe(false)
    expect(esEnlaceVivo(`${PREFIJO_NOTICIA}apertura-del-curso`, new Set(['noticias']))).toBe(true)
    // Lo del núcleo vale siempre, también antes de saber qué módulos hay.
    expect(esEnlaceVivo('/historia#fundacion', null)).toBe(true)
    expect(esEnlaceVivo('/hola', new Set(['agenda']))).toBe(false)
  })

  it('el índice de Páginas del CMS tampoco ofrece las de un módulo apagado', () => {
    const rutas = (activos: string[]) => paginasPublicasActivas(new Set(activos)).map((p) => p.ruta)
    for (const [ruta, modulo] of [['/agenda', 'agenda'], ['/noticias', 'noticias'], ['/publicaciones', 'publicaciones']]) {
      expect(rutas([]), ruta).not.toContain(ruta)
      expect(rutas([modulo]), ruta).toContain(ruta)
    }
  })
})

