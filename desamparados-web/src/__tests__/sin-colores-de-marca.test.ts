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
 * significado) no está en la lista y se escribe donde haga falta.
 */
const raiz = join(process.cwd(), 'src')
const EXCEPCIONES = new Set(['theme/marca.ts'])

const colores = new Map<string, string>()
for (const [papel, { partida }] of [...Object.entries(PAPELES_DE_MARCA), ...Object.entries(PAPELES_DE_IMPRENTA)]) {
  if (!colores.has(partida)) colores.set(partida, papel)
}
const patrones = [...colores].flatMap(([hex, papel]) => {
  const [r, g, b] = componentes(hex).split(', ')
  return [
    { papel, re: new RegExp(`${hex}(?![0-9a-f])`, 'i') },
    { papel, re: new RegExp(`(?<![0-9])${r}\\s*,\\s*${g}\\s*,\\s*${b}(?![0-9])`) },
  ]
})

const ficheros = (carpeta: string): string[] =>
  readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? ficheros(join(carpeta, e.name)) : /\.(ts|tsx|css)$/.test(e.name) ? [join(carpeta, e.name)] : [])

describe('la web no escribe a mano los colores de la marca', () => {
  it('la lista no está vacía (si lo estuviera, esto no vigilaría nada)', () => {
    expect(colores.size).toBeGreaterThan(30)
  })

  it('ningún fichero de src/, salvo theme/marca.ts, lleva un color de la marca de partida', () => {
    const hallados: string[] = []
    for (const fichero of ficheros(raiz)) {
      const ruta = relative(raiz, fichero).replace(/\\/g, '/')
      if (EXCEPCIONES.has(ruta)) continue
      readFileSync(fichero, 'utf8').split(/\r?\n/).forEach((linea, i) => {
        for (const { papel, re } of patrones) {
          if (re.test(linea)) hallados.push(`${ruta}:${i + 1} (MARCA.${papel}): ${linea.trim().slice(0, 100)}`)
        }
      })
    }
    expect(hallados).toEqual([])
  })
})
