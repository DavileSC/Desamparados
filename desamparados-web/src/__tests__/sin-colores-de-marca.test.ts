import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { componentes, PAPELES_DE_IMPRENTA, PAPELES_DE_MARCA } from '../../../shared/colores-de-marca.mjs'

/**
 * La guardiana de la marca: ningún color de la marca de partida (el burdeos y
 * el oro de Desamparados, y todos los tonos que se derivan de ellos) escrito a
 * mano en la web. Cada corporación tiene los suyos, y un oro escrito a mano se
 * quedaría dorado en la web de una corporación azul. Se toman de los papeles
 * de theme/marca.ts (`MARCA.acento`, `alfa(MARCA.principal, 0.2)`…), y en una
 * hoja .css, de las variables `--marca-*`.
 *
 * Mira el hex y también los tres números de su `rgba(r, g, b, …)`, que es como
 * estaban escritos la mitad. Los colores de la lista salen de
 * shared/colores-de-marca.mjs: un papel nuevo queda vigilado sin tocar esto.
 * Lo que no es de marca (neutros, el rojo de error, `dataviz`, los colores de
 * significado) no está en la lista y se escribe donde haga falta; el color de
 * significado que coincide con uno de partida se libra, hex a hex, en
 * `DE_SIGNIFICADO`.
 */
const raiz = join(process.cwd(), 'src')
// Esta misma prueba se libra porque escribe los hex de DE_SIGNIFICADO.
const EXCEPCIONES = new Set(['theme/marca.ts', '__tests__/sin-colores-de-marca.test.ts'])

/**
 * Colores que coinciden con uno de partida pero son de significado, no de
 * marca: se quedan fijos aunque la corporación cambie los suyos. Solo se libra
 * ese hex, en ese fichero; cualquier otro color de la marca allí sigue
 * vigilado. Cada uno, con su porqué.
 */
const DE_SIGNIFICADO: Record<string, { colores: string[]; porque: string }> = {
  'features/inicio/agenda.ts': {
    colores: ['#6e1822', '#ff9fa6'],
    porque: 'el tipo de acto «Culto»: si siguiera a la marca, una corporación morada lo vería igual que Procesión',
  },
  'features/cms/agenda/tiposEvento.ts': {
    colores: ['#b8283d'],
    porque: 'el punto de «Culto» en el CMS claro: el mismo caso que TIPOS.CULTO',
  },
}

const colores = new Map<string, string>()
for (const [papel, { partida }] of [...Object.entries(PAPELES_DE_MARCA), ...Object.entries(PAPELES_DE_IMPRENTA)]) {
  if (!colores.has(partida)) colores.set(partida, papel)
}
const patrones = [...colores].flatMap(([hex, papel]) => {
  const [r, g, b] = componentes(hex).split(', ')
  return [
    { hex, papel, re: new RegExp(`${hex}(?![0-9a-f])`, 'i') },
    { hex, papel, re: new RegExp(`(?<![0-9])${r}\\s*,\\s*${g}\\s*,\\s*${b}(?![0-9])`) },
  ]
})

const ficheros = (carpeta: string): string[] =>
  readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? ficheros(join(carpeta, e.name)) : /\.(ts|tsx|css)$/.test(e.name) ? [join(carpeta, e.name)] : [])

describe('la web no escribe a mano los colores de la marca', () => {
  it('la lista no está vacía (si lo estuviera, esto no vigilaría nada)', () => {
    expect(colores.size).toBeGreaterThan(30)
  })

  it('cada color de significado librado es de partida y sigue en su fichero (si no, sobra la excepción)', () => {
    for (const [ruta, { colores: libres }] of Object.entries(DE_SIGNIFICADO)) {
      const fuente = readFileSync(join(raiz, ruta), 'utf8')
      for (const hex of libres) {
        expect(colores.has(hex), `${hex} no es de partida: no hace falta librarlo`).toBe(true)
        expect(fuente.includes(hex), `${ruta} ya no lleva ${hex}`).toBe(true)
      }
    }
  })

  it('ningún fichero de src/, salvo theme/marca.ts y los colores de significado, lleva un color de la marca de partida', () => {
    const hallados: string[] = []
    for (const fichero of ficheros(raiz)) {
      const ruta = relative(raiz, fichero).replace(/\\/g, '/')
      if (EXCEPCIONES.has(ruta)) continue
      const libres = DE_SIGNIFICADO[ruta]?.colores ?? []
      readFileSync(fichero, 'utf8').split(/\r?\n/).forEach((linea, i) => {
        for (const { hex, papel, re } of patrones) {
          if (libres.includes(hex)) continue
          if (re.test(linea)) hallados.push(`${ruta}:${i + 1} (MARCA.${papel}): ${linea.trim().slice(0, 100)}`)
        }
      })
    }
    expect(hallados).toEqual([])
  })
})
