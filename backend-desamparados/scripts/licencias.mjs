/**
 * La lista de las librerías de terceros que se instalan en producción, con su
 * versión y su licencia, para la API y para la web: la que acompaña a cada
 * instalación que se vende (docs/venta/licencias-de-terceros.md).
 *
 * Solo las de producción y lo que arrastran: las de desarrollo (Vitest,
 * TypeScript…) no llegan al servidor ni al navegador. Avisa de las que no
 * son permisivas o no declaran licencia, que son las que hay que mirar.
 *
 * Las binarias de sharp dependen de la plataforma (en el servidor, las de
 * Linux): por eso se cuentan todas las de @img que estén instaladas aquí.
 *
 *   npm run licencias            # escribe el fichero
 *   npm run licencias -- --ver   # solo lo enseña
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROYECTOS = [['La API', 'backend-desamparados'], ['La web', 'desamparados-web']];
const PERMISIVAS = /^\(?(MIT|ISC|BSD-[23]-Clause|Apache-2\.0|0BSD|MIT-0|BlueOak-1\.0\.0|Unlicense|CC0-1\.0|Zlib|Python-2\.0)\b/;
const SALIDA = path.join(raiz, 'docs/venta/licencias-de-terceros.md');

const leer = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const licenciaDe = (p) => (typeof p.license === 'string' ? p.license : p.license?.type ?? (Array.isArray(p.licenses) ? p.licenses.map((l) => l.type ?? l).join(' OR ') : null));

/** Sin campo en package.json, la de su fichero LICENSE si se reconoce (png-js lo trae así). */
function licenciaDelFichero(dir) {
  const f = fs.readdirSync(dir).find((n) => /^licen[cs]e/i.test(n));
  const texto = f ? fs.readFileSync(path.join(dir, f), 'utf8').slice(0, 400) : '';
  if (/MIT License|Permission is hereby granted, free of charge/i.test(texto)) return 'MIT (por su fichero LICENSE)';
  return null;
}

/**
 * Las que hay que mirar: sin licencia, no permisivas o con una parte GPL que no
 * se puede esquivar. «MIT OR GPL» no: se elige la MIT. «Apache AND LGPL» sí.
 */
const aMirarLa = (l) => !l || !PERMISIVAS.test(l) || (/GPL/.test(l) && !/\bOR\b/.test(l));

/** Dónde está instalado `nombre` visto desde `desde`: como lo busca Node, subiendo de node_modules en node_modules. */
function resolver(nombre, desde, tope) {
  for (let d = desde; d.startsWith(tope); d = path.dirname(d)) {
    const f = path.join(d, 'node_modules', nombre, 'package.json');
    if (fs.existsSync(f)) return path.dirname(f);
    if (d === tope) break;
  }
  return null;
}

function inventario(carpeta) {
  const tope = path.join(raiz, carpeta);
  const propio = leer(path.join(tope, 'package.json'));
  const vistos = new Map();
  const cola = Object.keys(propio.dependencies ?? {}).map((n) => [n, tope]);
  while (cola.length) {
    const [nombre, desde] = cola.shift();
    const dir = resolver(nombre, desde, tope);
    if (!dir || vistos.has(dir)) continue;
    const p = leer(path.join(dir, 'package.json'));
    vistos.set(dir, { nombre: p.name, version: p.version, licencia: licenciaDe(p) ?? licenciaDelFichero(dir) });
    for (const n of [...Object.keys(p.dependencies ?? {}), ...Object.keys(p.optionalDependencies ?? {})]) cola.push([n, dir]);
  }
  return [...vistos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre) || a.version.localeCompare(b.version));
}

const partes = [
  '# Licencias de terceros',
  '',
  'Generado con `npm run licencias` (en backend-desamparados): no se edita a mano.',
  'Las librerías de producción de la API y de la web, con su licencia. El texto',
  'completo de cada una va dentro de su paquete, en `node_modules`. Las que hay',
  'que mirar están explicadas en [licencias.md](licencias.md).',
];
for (const [titulo, carpeta] of PROYECTOS) {
  const lista = inventario(carpeta);
  const cuenta = Object.entries(lista.reduce((c, l) => ({ ...c, [l.licencia ?? 'Sin licencia']: (c[l.licencia ?? 'Sin licencia'] ?? 0) + 1 }), {}))
    .sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l} (${n})`).join(', ');
  const aMirar = lista.filter((l) => aMirarLa(l.licencia));
  partes.push('', `## ${titulo}: ${lista.length} paquetes`, '', cuenta, '');
  if (aMirar.length) partes.push(`**A mirar:** ${aMirar.map((l) => `${l.nombre} ${l.version} (${l.licencia ?? 'sin licencia'})`).join('; ')}.`, '');
  partes.push('| Paquete | Versión | Licencia |', '|---|---|---|', ...lista.map((l) => `| ${l.nombre} | ${l.version} | ${l.licencia ?? '**sin licencia declarada**'} |`));
}
const texto = `${partes.join('\n')}\n`;

if (process.argv.includes('--ver')) console.log(texto);
else {
  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  fs.writeFileSync(SALIDA, texto);
  console.log(`Escrito ${path.relative(raiz, SALIDA)}`);
}
