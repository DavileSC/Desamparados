// La guardiana de los módulos: toda ruta montada en app.ts, toda entrada de
// los tres menús de la web, toda ruta de routes/index.tsx y todo tipo de
// bloque dicen de qué módulo son (una clave del catálogo o «nucleo»). Lo que
// no, sale aquí con su línea. Lee los ficheros como texto porque la web no
// se puede importar desde node:test; por eso cada lista tiene una forma fija
// (`modulo:` en la misma línea que `label:`; cada ruta en una línea) y este
// test es quien la exige.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import catalogo from '../../shared/tipos-de-bloque.json' with { type: 'json' };
import { CLAVES_MODULO, esClaveDeModulo } from '../src/domain/modulos.js';

const RAIZ = new URL('../../', import.meta.url);
const leer = (ruta: string) => readFileSync(fileURLToPath(new URL(ruta, RAIZ)), 'utf8').split(/\r?\n/);
const esModulo = (valor: string) => valor === 'nucleo' || esClaveDeModulo(valor);

/** `'tienda'` → ['tienda']; `['inventario', 'procesion']` → las dos. */
function clavesDe(literal: string): string[] {
  return [...literal.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
}

/** Las líneas de `fichero` entre la que contiene `desde` y la primera que empieza por `hasta`. */
function bloque(fichero: string, desde: string, hasta: RegExp): { linea: string; numero: number }[] {
  const lineas = leer(fichero);
  const inicio = lineas.findIndex((l) => l.includes(desde));
  assert.notEqual(inicio, -1, `${fichero}: no encuentro «${desde}»`);
  const salida: { linea: string; numero: number }[] = [];
  for (let i = inicio + 1; i < lineas.length && !hasta.test(lineas[i]); i++) salida.push({ linea: lineas[i], numero: i + 1 });
  return salida;
}

/** Cada línea con `label:` debe llevar `modulo:` con claves válidas. */
function menuEtiquetado(fichero: string, desde: string, hasta: RegExp): string[] {
  const fallos: string[] = [];
  for (const { linea, numero } of bloque(fichero, desde, hasta)) {
    if (!/\blabel:/.test(linea) || /^\s*\/\//.test(linea)) continue;
    const modulo = /\bmodulo:\s*('[a-z0-9-]+'|\[[^\]]*\])/.exec(linea);
    if (!modulo) { fallos.push(`${fichero}:${numero}: sin modulo → ${linea.trim()}`); continue; }
    for (const c of clavesDe(modulo[1])) if (!esModulo(c)) fallos.push(`${fichero}:${numero}: «${c}» no es del catálogo`);
  }
  return fallos;
}

describe('la guardiana de los módulos', () => {
  test('toda ruta montada en app.ts lleva conModulo(…) o nucleo', () => {
    const fallos: string[] = [];
    leer('backend-desamparados/src/app.ts').forEach((linea, i) => {
      if (!/^\s*app\.use\('\/api\//.test(linea)) return;
      const guarda = /app\.use\('[^']+',\s*(conModulo\('([a-z0-9-]+)'\)|nucleo),/.exec(linea);
      if (!guarda) { fallos.push(`app.ts:${i + 1}: sin conModulo(…) ni nucleo → ${linea.trim()}`); return; }
      if (guarda[2] && !esClaveDeModulo(guarda[2])) fallos.push(`app.ts:${i + 1}: «${guarda[2]}» no es del catálogo`);
    });
    assert.deepEqual(fallos, [], fallos.join('\n'));
  });

  test('las entradas del menú del CMS, del menú público y del área de hermanos llevan su módulo', () => {
    const fallos = [
      ...menuEtiquetado('desamparados-web/src/app/cmsNavegacion.ts', 'export const itemsMenu', /^\]/),
      ...menuEtiquetado('desamparados-web/src/config/navegacion.ts', 'export const menuPublico', /^\]/),
      ...menuEtiquetado('desamparados-web/src/app/areaHermanoNavegacion.ts', 'export const entradasDelArea', /^\]/),
    ];
    assert.deepEqual(fallos, [], fallos.join('\n'));
  });

  test('toda ruta de routes/index.tsx pasa por pagina(…, modulo) o es una redirección', () => {
    const fallos: string[] = [];
    const comprobadas: string[] = [];
    leer('desamparados-web/src/routes/index.tsx').forEach((linea, i) => {
      // Una ruta en una línea: `{ path: '…', element: … }` o `{ index: true, element: … }`.
      // El `\b` de cierre tiene que ir solo tras «true» (que acaba en letra): tras la
      // comilla de `path: '…'` nunca hay límite de palabra (comilla y coma son las
      // dos «no palabra»), así que un `\b` común a las dos alternativas dejaba sin
      // comprobar casi todas las rutas del fichero sin que la prueba lo notara
      // (hallazgo de la revisión de la ronda 1 de esta tarea).
      if (!/\bpath:\s*'[^']*'|\bindex:\s*true\b/.test(linea) || !/\belement:/.test(linea)) return;
      if (/<Navigate\b|<DireccionAntigua\b/.test(linea)) return;
      comprobadas.push(linea);
      const pagina = /\bpagina\(\w+,\s*('[a-z0-9-]+'|\[[^\]]*\])\)/.exec(linea);
      if (!pagina) { fallos.push(`routes/index.tsx:${i + 1}: sin pagina(…, modulo) → ${linea.trim()}`); return; }
      for (const c of clavesDe(pagina[1])) if (!esModulo(c)) fallos.push(`routes/index.tsx:${i + 1}: «${c}» no es del catálogo`);
    });
    assert.deepEqual(fallos, [], fallos.join('\n'));
    // Y que de verdad hay rutas: si el fichero cambia de forma, esto avisa en vez de pasar en vacío.
    assert.ok(leer('desamparados-web/src/routes/index.tsx').filter((l) => /\bpagina\(/.test(l)).length > 60);
    // Estas dos tenían `path:` y `element:` en líneas distintas (hallazgo de la
    // revisión de esta tarea): la guardiana no las veía y nadie lo garantizaba.
    // Si alguien vuelve a partirlas, que lo diga aquí y no en silencio.
    assert.ok(comprobadas.some((l) => l.includes("path: '/cms/acceso'")), 'no veo /cms/acceso en una sola línea');
    assert.ok(comprobadas.some((l) => l.includes("path: '/cms/vista-previa/:slug'")), 'no veo /cms/vista-previa/:slug en una sola línea');
  });

  test('todo tipo de bloque dice de qué módulo es', () => {
    const modulo = catalogo.modulo as Record<string, string | { porFuente: Record<string, string> }>;
    const fallos: string[] = [];
    for (const tipo of catalogo.tipos) {
      const m = modulo[tipo];
      if (m === undefined) { fallos.push(`tipos-de-bloque.json: ${tipo} sin modulo`); continue; }
      const claves = typeof m === 'string' ? [m] : Object.values(m.porFuente);
      for (const c of claves) if (!esModulo(c)) fallos.push(`tipos-de-bloque.json: ${tipo} → «${c}» no es del catálogo`);
    }
    assert.deepEqual(fallos, [], fallos.join('\n'));
  });

  test('las dos copias de las claves (backend y web) son las del catálogo', () => {
    const web = leer('desamparados-web/src/domain/modulos.ts').join('\n');
    const lista = /CLAVES_MODULO = \[([\s\S]*?)\] as const/.exec(web);
    assert.ok(lista, 'la web no declara CLAVES_MODULO');
    assert.deepEqual(clavesDe(lista[1]), [...CLAVES_MODULO]);
  });
});
