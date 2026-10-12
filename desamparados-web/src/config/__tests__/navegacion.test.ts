import { describe, it, expect } from 'vitest'
import { menuPublico, aplanarMenu, menuVisible, enlacesDelMenu, ponerNombres, type EntradaMenu } from '../navegacion'
import CATALOGO from '../../../../shared/entradas-del-menu.json'
// El fuente del router como texto (`?raw` de Vite): así el test no necesita los
// tipos de Node, que `tsconfig.app.json` no incluye para `src/`.
import fuente from '../../routes/index.tsx?raw'

/**
 * Rutas reales del router, leídas del fuente como hace `scripts/generar-sitemap.mjs`:
 * el bloque público (lo que cuelga de <MarcoPublico />) más las rutas absolutas
 * que viven fuera de él, como `/acceso`.
 */
function rutasDelRouter(): Set<string> {
  const inicio = fuente.indexOf('<MarcoPublico />')
  const fin = fuente.indexOf("path: '*'", inicio)
  const publicas = [...fuente.slice(inicio, fin).matchAll(/path:\s*'([^']+)'/g)].map((m) => `/${m[1]}`)
  const absolutas = [...fuente.matchAll(/path:\s*'(\/[^']+)'/g)].map((m) => m[1])
  return new Set(['/', ...publicas, ...absolutas])
}

/** Pinta el árbol como texto indentado para compararlo de un vistazo con el mapa del sitio. */
function dibujar(entradas: EntradaMenu[], nivel = 0): string[] {
  return entradas.flatMap((e) => [
    `${'  '.repeat(nivel)}${e.label} ${e.href}`,
    ...dibujar(e.hijos ?? [], nivel + 1),
  ])
}

describe('menuPublico', () => {
  it('reproduce el mapa de la web pública, nivel a nivel', () => {
    expect(dibujar(menuPublico).join('\n')).toBe(
      [
        'Inicio /',
        'Corporación /corporacion',
        '  Historia /historia',
        '    Órganos de Gobierno /historia/organos-de-gobierno',
        '  Parroquia /parroquia',
        '  Nuestros fines /nuestros-fines',
        '    Caridad /nuestros-fines/caridad',
        '    Formación /nuestros-fines/formacion',
        '  Cultos /cultos',
        '  Sábado de Pasión /sabado-de-pasion',
        '    Recorrido /sabado-de-pasion/recorrido',
        '    Trono /sabado-de-pasion/trono',
        '    Enseres /sabado-de-pasion/enseres',
        '  Rosario /rosario',
        'Sagrada titular /sagrada-titular',
        '  Desamparados /desamparados',
        '  Ajuar /ajuar',
        '  Apadrina /apadrina',
        'Actualidad /actualidad',
        '  Agenda /agenda',
        '  Noticias /noticias',
        '  Tienda /tienda',
        'Publicaciones /publicaciones',
        '  Todas las publicaciones /publicaciones',
        '  Boletines /publicaciones/boletines',
        '  Dossier prensa /publicaciones/dossier-prensa',
        'Hermanos /hermanos',
        '  Hazte hermano /hazte-hermano',
        '  Acceso hermanos /acceso',
        'Contacto /contacto',
      ].join('\n'),
    )
  })

  it('cada enlace del menú es una ruta declarada en el router', () => {
    const rutas = rutasDelRouter()
    // Las secciones con subpáginas no enlazan: su `href` es solo el prefijo.
    const enlaces = aplanarMenu(menuPublico).filter((e) => !menuPublico.includes(e) || !e.hijos?.length)
    const rotos = enlaces
      .map((e) => e.href)
      .filter((href) => !rutas.has(href))
    expect(rotos, 'llevarían al visitante al 404').toEqual([])
  })

  it('las portadas de sección ya no existen: el título solo despliega', () => {
    const rutas = rutasDelRouter()
    for (const seccion of menuPublico.filter((e) => e.hijos?.length && e.href !== '/publicaciones')) {
      expect(rutas.has(seccion.href), seccion.href).toBe(false)
    }
  })

  it('aplanarMenu devuelve todas las entradas, en orden de lectura', () => {
    const arbol: EntradaMenu[] = [
      { label: 'A', href: '/a', modulo: 'nucleo', hijos: [{ label: 'A1', href: '/a/1', modulo: 'nucleo', hijos: [{ label: 'A1a', href: '/a/1/a', modulo: 'nucleo' }] }] },
      { label: 'B', href: '/b', modulo: 'nucleo' },
    ]
    expect(aplanarMenu(arbol).map((e) => e.label)).toEqual(['A', 'A1', 'A1a', 'B'])
  })

  it('menuVisible quita las entradas de módulos apagados y una sección que se queda sin hijos', () => {
    const dibujo = (activos: string[]) => dibujar(menuVisible(menuPublico, new Set(activos))).join('\n')
    expect(dibujo(['agenda', 'noticias', 'publicaciones', 'area-hermanos', 'alta-web', 'apadrinamientos', 'tienda-web', 'paginas-propias'])).toBe(dibujar(menuPublico).join('\n'))
    const sinTienda = dibujo(['agenda', 'noticias', 'publicaciones', 'area-hermanos', 'alta-web', 'apadrinamientos'])
    expect(sinTienda).not.toContain('Tienda /tienda')
    expect(sinTienda).toContain('Noticias /noticias')
    const sinActualidad = dibujo(['publicaciones', 'area-hermanos'])
    expect(sinActualidad).not.toContain('Actualidad')
    expect(sinActualidad).toContain('Corporación /corporacion')
    expect(sinActualidad).not.toContain('Hazte hermano')
    expect(sinActualidad).toContain('Acceso hermanos /acceso')
  })

  it('sin las páginas propias se va el grupo Sábado de Pasión entero, Rosario y Desamparados; Ajuar se queda', () => {
    const sinPropias = dibujar(menuVisible(menuPublico, new Set(['apadrinamientos']))).join('\n')
    for (const fuera of ['Sábado de Pasión', 'Recorrido', 'Trono', 'Enseres', 'Rosario', 'Desamparados /desamparados']) {
      expect(sinPropias).not.toContain(fuera)
    }
    expect(sinPropias).toContain('Cultos /cultos')
    expect(sinPropias).toContain('Sagrada titular /sagrada-titular\n  Ajuar /ajuar\n  Apadrina /apadrina')
    // Sin Apadrina tampoco, a «Sagrada titular» le queda el Ajuar: no desaparece.
    expect(dibujar(menuVisible(menuPublico, new Set())).join('\n')).toContain('Sagrada titular /sagrada-titular\n  Ajuar /ajuar')
    const conPropias = dibujar(menuVisible(menuPublico, new Set(['paginas-propias']))).join('\n')
    expect(conPropias).toContain('Sábado de Pasión /sabado-de-pasion\n    Recorrido')
    expect(conPropias).toContain('Desamparados /desamparados')
  })

  it('el catálogo compartido de nombres es el de los enlaces del menú, con su nombre de siempre', () => {
    // El servidor solo deja renombrar lo que está en shared/entradas-del-menu.json:
    // si el menú cambia y el catálogo no, una página nueva no se podría renombrar
    // (o se aceptaría una que ya no está).
    expect(CATALOGO.entradas).toEqual(enlacesDelMenu(menuPublico).map((e) => ({ ruta: e.href, nombre: e.label })))
    expect(new Set(CATALOGO.entradas.map((e) => e.ruta)).size, 'una ruta repetida').toBe(CATALOGO.entradas.length)
    for (const e of CATALOGO.entradas) expect(e.nombre.length, e.ruta).toBeLessThanOrEqual(CATALOGO.tope)
  })

  it('ponerNombres cambia el nombre de las páginas, no el de los títulos que solo despliegan', () => {
    const nombres = { '/parroquia': 'Parroquia · Pasionistas', '/historia': 'Nuestra historia', '/publicaciones': 'Archivo', '/corporacion': 'No vale' }
    const dibujo = dibujar(ponerNombres(menuPublico, nombres)).join('\n')
    expect(dibujo).toContain('  Parroquia · Pasionistas /parroquia')
    // Una subsección con páginas dentro sí es un enlace: cambia.
    expect(dibujo).toContain('  Nuestra historia /historia\n    Órganos de Gobierno')
    // «Publicaciones» despliega y comparte ruta con «Todas las publicaciones»: cambia solo la página.
    expect(dibujo).toContain('Publicaciones /publicaciones\n  Archivo /publicaciones')
    expect(dibujo).toContain('Corporación /corporacion')
    expect(ponerNombres(menuPublico, {})).toBe(menuPublico)
  })

  it('todas las entradas llevan su módulo', () => {
    for (const e of aplanarMenu(menuPublico)) expect(e.modulo, e.label).toBeDefined()
  })
})
