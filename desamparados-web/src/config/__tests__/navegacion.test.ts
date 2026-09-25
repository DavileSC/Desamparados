import { describe, it, expect } from 'vitest'
import { menuPublico, aplanarMenu, type EntradaMenu } from '../navegacion'
// El fuente del router como texto (`?raw` de Vite): así el test no necesita los
// tipos de Node, que `tsconfig.app.json` no incluye para `src/`.
import fuente from '../../routes/index.tsx?raw'

/**
 * Rutas reales del router, leídas del fuente como hace `scripts/generar-sitemap.mjs`:
 * el bloque público (lo que cuelga de <MarcoPublico />) más las rutas absolutas
 * que viven fuera de él, como `/hermanos/acceso`.
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
        '  Historia /corporacion/historia',
        '    Órganos de Gobierno /corporacion/historia/organos-de-gobierno',
        '  Parroquia - Pasionistas /corporacion/parroquia-pasionistas',
        '  Nuestros fines /corporacion/nuestros-fines',
        '    Caridad /corporacion/nuestros-fines/caridad',
        '    Formación /corporacion/nuestros-fines/formacion',
        '  Cultos /corporacion/cultos',
        '  Sábado de Pasión /corporacion/sabado-de-pasion',
        '    Recorrido /corporacion/sabado-de-pasion/recorrido',
        '    Trono /corporacion/sabado-de-pasion/trono',
        '    Enseres /corporacion/sabado-de-pasion/enseres',
        'Sagrada titular /sagrada-titular',
        '  Desamparados /sagrada-titular/desamparados',
        '  Ajuar /sagrada-titular/ajuar',
        'Actualidad /actualidad',
        '  Agenda /actualidad/agenda',
        '  Noticias /actualidad/noticias',
        'Publicaciones /publicaciones',
        '  Todas las publicaciones /publicaciones',
        '  Boletines /publicaciones/boletines',
        '  Dossier prensa /publicaciones/dossier-prensa',
        'Hermanos /hermanos',
        '  Hazte hermano /hermanos/hazte-hermano',
        '  Login hermanos /hermanos/acceso',
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
      { label: 'A', href: '/a', hijos: [{ label: 'A1', href: '/a/1', hijos: [{ label: 'A1a', href: '/a/1/a' }] }] },
      { label: 'B', href: '/b' },
    ]
    expect(aplanarMenu(arbol).map((e) => e.label)).toEqual(['A', 'A1', 'A1a', 'B'])
  })
})
