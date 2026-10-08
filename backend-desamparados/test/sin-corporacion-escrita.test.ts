// La guardiana: que nadie vuelva a escribir la corporación a mano. «del Grupo
// Parroquial» solo vale para un Grupo Parroquial, y la aplicación se instala
// también para Hermandades y Cofradías. Las frases salen de domain/articulos.ts
// y de los campos {{la_corporacion}}… de las plantillas. Recorre el código de
// los dos paquetes (sin pruebas ni comentarios) y los textos de las plantillas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const CORPORACION = /Grupo Parroquial|\b(?:el|del|al|nuestro|El|Del|Al|Nuestro)\s+Grupo\b/;
// «del ${identidad.nombre}», «el ${identidad.tipo}»…: la Tarea 4 encontró este
// fallo de concordancia (un artículo escrito a mano delante del nombre propio
// de la corporación interpolado) porque no contiene la palabra «Grupo» y el
// patrón de arriba no lo ve. En TypeScript interpola con `${…}`. `identidad\w*`
// y no solo `identidad`: la ronda 1 de arreglos encontró que `plantilla.ts` y
// `componer.ts` reciben la identidad en un parámetro `identidadInstalacion`
// (para poder probar con otra instalación), y el literal `identidad` a secas
// no lo veía.
const CORPORACION_INTERPOLADA_TS = /\b(?:el|del|al|El|Del|Al)\s+\$\{\s*identidad\w*\.(?:nombre|tipo|tipoCorto)\b/;
// La misma frase en JSX interpola con `{…}` (sin el `$`) y lee `site.…` en la
// web o `identidad.…`/`identidadInstalacion.…` en el backend. `site` se deja
// sin `\w*` a propósito: en la web hay identificadores que empiezan por
// «site» sin ser la identidad (`site_name`, `sitemap`), y ninguno de ellos
// lleva otro sufijo para este dato.
const CORPORACION_INTERPOLADA_JSX = /\b(?:el|del|al|El|Del|Al)\s+\{\s*(?:site|identidad\w*)\.(?:nombre|tipo|tipoCorto)\s*\}/;
// Solo la salida, no cualquier «{…nombre…}» suelto: un `nombre` sin punto
// delante no cae aquí (lo usan cosas ajenas a una salida, como el mes de
// PanelDelDia.tsx o el parámetro genérico de deArticulo/aArticulo en el propio
// domain/articulos.ts), porque siempre exige un objeto.
//
// La ronda 1 de arreglos encontró que una lista cerrada de nombres de variable
// (`salida`, `s`, `otra`…) deja sin protección a cualquier salida que se llame
// de otra forma (`sal`, `item`, `datos.salida`, `otraSalida`, `salida?.nombre`
// con encadenado opcional…): renombrar la variable bastaba para colarse. Por
// eso ahora el patrón casa cualquier cadena de propiedades que acabe en
// `.nombre` (con `?.` opcional). Lo que no sea una salida de verdad («del
// {hermano.nombre}», por ejemplo) no se descarta acotando por nombre de
// variable: se apunta en `EXCEPCIONES`, con fichero y motivo, igual que
// cualquier otro hallazgo justificado (comprobado al ejecutar la prueba: hoy
// no hay ninguno, ver el informe de esta ronda).
//
// `el`/`El` también, y no solo «en el» (que queda dentro): la revisión final
// recordó que la Tarea 4 había dejado un «El ${s.nombre}» fijo al empezar
// frase, que con «del» y «al» solos no se veía.
const SALIDA_EN_CODIGO = /\b(?:del|al|el|El)\s+(?:\$\{|\{)\s*[\w$]+(?:\??\.[\w$]+)*\??\.nombre\b[^}]*\}/;
const SALIDA_EN_PLANTILLA = /\b(?:del|al|el|El)\s+\{\{\s*salida\s*\}\}/;

/** Lo que sí puede llevarlo escrito, con su porqué. Fichero relativo a la raíz y un trozo de la línea. */
const EXCEPCIONES: { fichero: string; contiene: string; motivo: string }[] = [
  {
    fichero: 'desamparados-web/src/config/site.ts',
    contiene: 'Grupo Parroquial Nuestra Señora de los Desamparados',
    motivo:
      'Denominación jurídica exacta inscrita (art. 10 LSSI-CE y art. 13 RGPD): un hecho legal de ' +
      'esta instalación, no una frase calculable con artículo. Pendiente de pasar a ' +
      'shared/datos-entidad.json (hoja de ruta).',
  },
  // El catálogo "comunes" de usos-de-correo.json documenta, para quien edite una
  // plantilla desde el CMS, lo que hoy escriben los campos {{la_corporacion}}…
  // (domain/articulos.ts) con la identidad de esta instalación: un "ejemplo" de
  // ayuda, no una plantilla con la corporación escrita a mano. Cambia solo si
  // cambia shared/datos-entidad.json, igual que la denominación jurídica de arriba.
  ...(['el Grupo Parroquial', 'del Grupo Parroquial', 'al Grupo Parroquial', 'nuestro Grupo Parroquial', 'el Grupo', 'del Grupo'] as const)
    .map((ejemplo) => ({
      fichero: 'shared/usos-de-correo.json',
      contiene: `"ejemplo": "${ejemplo}"`,
      motivo: 'Ejemplo de ayuda del catálogo "comunes": lo que hoy produce domain/articulos.ts para esta instalación.',
    })),
];

function ficheros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return n === '__tests__' || n === 'node_modules' ? [] : ficheros(ruta);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [ruta] : [];
  });
}

// Quita los comentarios, que pueden nombrar a este Grupo (explican el porqué de
// su código): `//` y `/**`/`*` de JSDoc, como en el encargo, y además `{/*`, el
// comentario de JSX (p. ej. un pie de foto), que el patrón original no veía.
const sinComentarios = (linea: string) => (/^\s*(\{\/\*|\/\/|\*|\/\*)/.test(linea) ? '' : linea.replace(/\s\/\/.*$/, ''));

// Este checkout está en Windows con `core.autocrlf=true`: los ficheros llevan
// CRLF. Partir solo por `\n` deja un `\r` colgando al final de cada línea, que
// rompe el `$` de `sinComentarios` (un comentario de cola ya no se recorta) y
// ensucia el texto de cada hallazgo.
const lineasDe = (contenido: string) => contenido.split(/\r?\n/);

// `_comentario` en usos-de-correo.json es un array de varias líneas (explica el
// formato a quien edite el fichero) y una de ellas cita «Grupo Parroquial» como
// ejemplo de lo que escribiría un correo a mano, justo lo que esta prueba
// persigue. Filtrar solo la línea con la clave (como hacía el encargo) no basta
// porque dejaba las líneas de contenido del array; aquí se descarta el bloque
// entero, de `"_comentario": [` a su `]` de cierre.
function sinBloqueDeComentario(lineas: string[]): string[] {
  let dentro = false;
  return lineas.filter((l) => {
    if (/^\s*"_comentario"\s*:\s*\[/.test(l)) { dentro = true; return false; }
    if (!dentro) return true;
    if (/^\s*\]/.test(l)) dentro = false;
    return false;
  });
}

test('ni el código ni las plantillas escriben la corporación ni la salida a mano', () => {
  const hallazgos: string[] = [];
  const mirar = (fichero: string, lineas: string[], patrones: RegExp[]) => lineas.forEach((l, i) => {
    const texto = sinComentarios(l);
    if (!patrones.some((p) => p.test(texto))) return;
    const rel = relative(RAIZ, fichero).replace(/\\/g, '/');
    if (EXCEPCIONES.some((e) => e.fichero === rel && texto.includes(e.contiene))) return;
    hallazgos.push(`${rel}:${i + 1}: ${texto.trim()}`);
  });
  for (const dir of ['backend-desamparados/src', 'desamparados-web/src']) {
    for (const f of ficheros(join(RAIZ, dir))) {
      mirar(f, lineasDe(readFileSync(f, 'utf8')), [
        CORPORACION,
        CORPORACION_INTERPOLADA_TS,
        CORPORACION_INTERPOLADA_JSX,
        SALIDA_EN_CODIGO,
      ]);
    }
  }
  const plantillas = join(RAIZ, 'shared/usos-de-correo.json');
  mirar(plantillas, sinBloqueDeComentario(lineasDe(readFileSync(plantillas, 'utf8'))), [CORPORACION, SALIDA_EN_PLANTILLA]);
  assert.deepEqual(hallazgos, [], `Escritas a mano (usa domain/articulos.ts o los campos {{la_corporacion}}…):\n${hallazgos.join('\n')}`);
});

// «Cofrade» es el miembro de una cofradía: aquí son «hermanos» en todas las
// instalaciones (la auditoría del 07-10-2026 encontró un «No tienes permisos
// para apuntar a este cofrade» que leía el hermano en su área). Solo el
// backend: sus mensajes de error llegan tal cual a la pantalla.
test('los mensajes del backend llaman «hermanos» a los miembros, no «cofrades»', () => {
  const hallazgos: string[] = [];
  for (const f of ficheros(join(RAIZ, 'backend-desamparados/src'))) {
    lineasDe(readFileSync(f, 'utf8')).forEach((l, i) => {
      const texto = sinComentarios(l);
      if (/['"`][^'"`]*\bcofrades?\b/i.test(texto)) hallazgos.push(`${relative(RAIZ, f).replace(/\\/g, '/')}:${i + 1}: ${texto.trim()}`);
    });
  }
  assert.deepEqual(hallazgos, [], `«cofrade» en un texto visible:\n${hallazgos.join('\n')}`);
});
