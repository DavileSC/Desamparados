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
// patrón de arriba no lo ve. En TypeScript interpola con `${…}`.
const CORPORACION_INTERPOLADA_TS = /\b(?:el|del|al|El|Del|Al)\s+\$\{\s*identidad\.(?:nombre|tipo|tipoCorto)\b/;
// La misma frase en JSX interpola con `{…}` (sin el `$`) y lee `site.…` en la
// web o `identidad.…` en el backend.
const CORPORACION_INTERPOLADA_JSX = /\b(?:el|del|al|El|Del|Al)\s+\{\s*(?:site|identidad)\.(?:nombre|tipo|tipoCorto)\s*\}/;
// Solo la salida, no cualquier «{…nombre…}»: un `nombre` suelto sin punto no
// cae aquí (lo usan cosas ajenas a una salida, como el mes de PanelDelDia.tsx o
// el parámetro genérico de deArticulo/aArticulo en el propio domain/articulos.ts),
// y «del {hermano.nombre}» tampoco, porque se exige uno de los nombres con los
// que el código llama a una instancia de Salida (ver los barridos de las
// Tareas 4 y 5: `salida`, `s`, `otra`, `principal`, `sola`), no cualquier `X.nombre`.
const SALIDA_EN_CODIGO = /\b(?:del|al|en el)\s+(?:\$\{|\{)\s*(?:salida|s|otra|principal|sola)\.nombre\b[^}]*\}/;
const SALIDA_EN_PLANTILLA = /\b(?:del|al|en el)\s+\{\{\s*salida\s*\}\}/;

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
