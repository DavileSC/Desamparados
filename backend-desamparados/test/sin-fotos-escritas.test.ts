// La guardiana de las fotos (y del mapa del barrio, al final): que ningún
// fichero de código escriba una foto concreta de /images/. Esas fotos son de una corporación y viven fuera de git,
// en instalacion/imagenes/ (nginx las sirve en /images/ desde el montaje):
// otra instalación no las tiene y una ruta escrita en el código le daría 404.
// Las fotos las pone el contenido (páginas, portada, carteles), que sí es de
// cada una. Hermana de sin-corporacion-escrita.test.ts, con su misma forma de
// recorrer el código (sin pruebas ni comentarios).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));

// «/images/» seguido de un nombre: una foto o una subcarpeta concreta. También
// dentro de una expresión regular (`\/images\/cabeceras\/`). «/images/…» (en
// una descripción) o «/images/${x}» no son una foto concreta y no caen.
const FOTO_ESCRITA = /\\?\/images\\?\/[\w-]/;

/** Lo que sí puede escribirlas, con su porqué. Fichero relativo a la raíz. */
const EXCEPCIONES: { fichero: string; motivo: string }[] = [
  {
    fichero: 'desamparados-web/src/config/fotosDeLaInstalacion.ts',
    motivo: 'El catálogo de las fotos fijas que el código usa por defecto (la de siempre, las de los carteles, '
      + 'las copias reducidas y el convenio de las cabeceras). Un solo sitio, y quien las pinta las quita si dan 404 '
      + '(hooks/useFotoQueFalla.ts).',
  },
];

const AYUDAS_DE_PRUEBAS = join('desamparados-web', 'src', 'test');

function ficheros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) {
      if (n === '__tests__' || n === 'node_modules' || ruta.endsWith(AYUDAS_DE_PRUEBAS)) return [];
      return ficheros(ruta);
    }
    // También las hojas de estilo: un `url(/images/…)` es la misma foto escrita.
    return /\.(ts|tsx|css)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [ruta] : [];
  });
}

// Los comentarios pueden nombrar una foto para explicar el porqué.
const sinComentarios = (linea: string) => (/^\s*(\{\/\*|\/\/|\*|\/\*)/.test(linea) ? '' : linea.replace(/\s\/\/.*$/, ''));
const sinComentariosHtml = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');

test('el patrón ve una foto escrita, también en una expresión regular, y deja pasar lo que no lo es', () => {
  assert.ok(FOTO_ESCRITA.test(`const FOTO = '/images/hero-1920.webp'`));
  assert.ok(FOTO_ESCRITA.test('const m = /^(\\/images\\/cabeceras\\/[\\w-]+)\\.webp$/.exec(url)'));
  assert.ok(FOTO_ESCRITA.test(`background: 'url(/images/fondo.jpg)'`));
  assert.ok(!FOTO_ESCRITA.test(`.describe('una ruta de imagen del propio sitio (/storage/public/… o /images/…)')`));
  assert.ok(!FOTO_ESCRITA.test('/^\\/(?:storage\\/public|images)\\/(?:[A-Za-z0-9_-]+\\/)*/'));
});

test('ningún fichero de código escribe una foto de /images/: son de la instalación, no del código', () => {
  const hallazgos: string[] = [];
  for (const dir of ['backend-desamparados/src', 'desamparados-web/src']) {
    for (const f of ficheros(join(RAIZ, dir))) {
      const rel = relative(RAIZ, f).replace(/\\/g, '/');
      if (EXCEPCIONES.some((e) => e.fichero === rel)) continue;
      readFileSync(f, 'utf8').split(/\r?\n/).forEach((l, i) => {
        const texto = sinComentarios(l);
        if (FOTO_ESCRITA.test(texto)) hallazgos.push(`${rel}:${i + 1}: ${texto.trim()}`);
      });
    }
  }
  const index = join(RAIZ, 'desamparados-web/index.html');
  sinComentariosHtml(readFileSync(index, 'utf8')).split(/\r?\n/).forEach((l, i) => {
    if (FOTO_ESCRITA.test(l)) hallazgos.push(`desamparados-web/index.html:${i + 1}: ${l.trim()}`);
  });
  assert.deepEqual(hallazgos, [], `Fotos de /images/ escritas en el código (que salgan del contenido, o al catálogo de ${EXCEPCIONES[0].fichero} con su respaldo si falta):\n${hallazgos.join('\n')}`);
});

// El mapa del barrio es de cada instalación (instalacion/mapas/barrio.json,
// servido en /mapas/barrio.json). El nombre de antes, con la corporación
// dentro, no puede volver: ni en el código ni en lo que sirve o despliega.
test('nada nombra el mapa del barrio de antes («barrio-desamparados»)', () => {
  const hallazgos: string[] = [];
  const recorrer = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return ['node_modules', '__tests__', 'dist'].includes(n) ? [] : recorrer(ruta);
    return /\.(ts|tsx|mjs|js|css|html|json|conf|sh|ya?ml)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [ruta] : [];
  });
  for (const dir of ['backend-desamparados/src', 'desamparados-web/src', 'desamparados-web/scripts', 'desamparados-web/public', 'docker', '.github', 'shared']) {
    for (const f of recorrer(join(RAIZ, dir))) {
      readFileSync(f, 'utf8').split(/\r?\n/).forEach((l, i) => {
        if (l.includes('barrio-desamparados')) hallazgos.push(`${relative(RAIZ, f).replace(/\\/g, '/')}:${i + 1}: ${l.trim()}`);
      });
    }
  }
  assert.deepEqual(hallazgos, [], `El mapa del barrio es /mapas/barrio.json, de la instalación:\n${hallazgos.join('\n')}`);
});

test('las excepciones existen: una que ya no está no protege nada', () => {
  for (const e of EXCEPCIONES) assert.ok(existsSync(join(RAIZ, e.fichero)), `${e.fichero} ya no existe: quítala de EXCEPCIONES`);
});
