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
// La denominación jurídica de `config/site.ts` ya no está aquí: desde la etapa
// 1 de la Fase 8 sale de instalacion/datos-entidad.json, y la excepción no
// protegía nada.
// Ni los ejemplos de los campos comunes de usos-de-correo.json: la API los da
// con la identidad de cada instalación (PlantillasCorreoService.listar).
const EXCEPCIONES: { fichero: string; contiene: string; motivo: string }[] = [];

// `desamparados-web/src/test/` son las ayudas de las pruebas (setup, datos de
// prueba): como `__tests__`, no llegan a ninguna pantalla.
const AYUDAS_DE_PRUEBAS = join('desamparados-web', 'src', 'test');

function ficheros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) {
      if (n === '__tests__' || n === 'node_modules' || ruta.endsWith(AYUDAS_DE_PRUEBAS)) return [];
      return ficheros(ruta);
    }
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

// La misma aplicación se instala para otras corporaciones (Fase 8): el código
// de núcleo no puede nombrar a esta. Su nombre, su templo, su ciudad y su
// salida salen de instalacion/datos-entidad.json, de los datos de contacto
// (sede), de la tabla `Salida` o del contenido que cada una escribe en el CMS.
//
// Con mayúscula y como palabra suelta a propósito: el proyecto se llama así y
// aparece en rutas e imports (`desamparados-web`) y en identificadores
// (`DesamparadosPage`, `sabadoDePasion`), que no son texto visible.
const NOMBRES_PROPIOS = /\b(?:Desamparados|Goretti|Málaga|Sábado de Pasión)\b/;

// Las páginas propias de esta corporación (su Titular, su salida, su rosario)
// sí la nombran: son su contenido, y van en un módulo que otra instalación no
// enciende. El contenido de partida (shared/contenido-por-defecto.json) no se
// recorre aquí: no es código, y tiene su propia prueba más abajo.
const PAGINAS_PROPIAS = [
  'desamparados-web/src/features/titular/',
  'desamparados-web/src/features/corporacion/sabado-pasion/',
  'desamparados-web/src/features/corporacion/rosario/',
];

/** Lo que sí puede nombrarla, con su porqué. Fichero relativo a la raíz y un trozo de la línea. */
const EXCEPCIONES_NOMBRES: { fichero: string; contiene: string; motivo: string }[] = [
  {
    fichero: 'desamparados-web/src/lib/provincias.ts',
    contiene: "'29': ['Málaga', 'Andalucía']",
    motivo: 'La provincia de Málaga en la lista de provincias por código postal: un dato geográfico, no esta corporación.',
  },
  ...(['Sábado de Pasión', 'Desamparados'] as const).map((rotulo) => ({
    fichero: 'desamparados-web/src/config/navegacion.ts',
    contiene: `label: '${rotulo}'`,
    motivo: 'Menú del módulo paginas-propias: el rótulo de una página propia, que solo se ve con el módulo encendido.',
  })),
];

test('el código de núcleo no nombra a esta corporación, su templo, su ciudad ni su salida', () => {
  const hallazgos: string[] = [];
  for (const dir of ['backend-desamparados/src', 'desamparados-web/src']) {
    for (const f of ficheros(join(RAIZ, dir))) {
      const rel = relative(RAIZ, f).replace(/\\/g, '/');
      if (PAGINAS_PROPIAS.some((carpeta) => rel.startsWith(carpeta))) continue;
      lineasDe(readFileSync(f, 'utf8')).forEach((l, i) => {
        const texto = sinComentarios(l);
        if (!NOMBRES_PROPIOS.test(texto)) return;
        if (EXCEPCIONES_NOMBRES.some((e) => e.fichero === rel && texto.includes(e.contiene))) return;
        hallazgos.push(`${rel}:${i + 1}: ${texto.trim()}`);
      });
    }
  }
  assert.deepEqual(hallazgos, [], `Nombres propios de esta corporación en el código de núcleo (léelos de la instalación, del contacto o de la tabla Salida):\n${hallazgos.join('\n')}`);
});

// El contenido de partida es neutro (etapa 6 de la Fase 8): con él nace la web
// de cualquier corporación que no traiga su semilla
// (instalacion/contenido-inicial.json). Lo de Desamparados vive en la suya, y
// ninguna foto del repositorio se cita: las fotos son de cada instalación, y
// una ruta a /images/ que no existe sería un hueco roto en la web de otra.
const NO_NEUTRO = /Desamparados|Goretti|Málaga|Pasionistas|Sábado de Pasión|\/images\/|Grupo Parroquial|Hermandad|Cofradía/;

test('el contenido de partida no nombra a ninguna corporación ni cita fotos del repositorio', () => {
  const fichero = join(RAIZ, 'shared/contenido-por-defecto.json');
  const hallazgos = lineasDe(readFileSync(fichero, 'utf8'))
    .map((l, i) => [i + 1, l] as const)
    .filter(([, l]) => NO_NEUTRO.test(l))
    .map(([n, l]) => `shared/contenido-por-defecto.json:${n}: ${l.trim()}`);
  assert.deepEqual(hallazgos, [], `El contenido de partida tiene que ser neutro (lo de una corporación va en su instalacion/contenido-inicial.json):\n${hallazgos.join('\n')}`);
});

// «Cofrade» es el miembro de una cofradía: aquí son «hermanos» en todas las
// instalaciones (la auditoría del 07-10-2026 encontró un «No tienes permisos
// para apuntar a este cofrade» que leía el hermano en su área). Solo el
// backend: sus mensajes de error llegan tal cual a la pantalla.
//
// La única excepción es RAICES_PROHIBIDAS de domain/password-debil.ts: ahí
// 'cofrade' es una raíz de diccionario que se busca dentro de la contraseña
// («cofrade2026» se rechaza) y nunca se enseña. Se quita solo ese elemento
// exacto de la lista, con sus comillas, y solo en ese fichero: un mensaje
// que diga «cofrade» en el mismo fichero (o en la misma línea) sigue cayendo.
// Partir la palabra en el código para esquivar la prueba la dejaría ciega.
const RAIZ_DE_CONTRASENA = { fichero: 'backend-desamparados/src/domain/password-debil.ts', elemento: /'cofrade',/g };

test('los mensajes del backend llaman «hermanos» a los miembros, no «cofrades»', () => {
  const hallazgos: string[] = [];
  for (const f of ficheros(join(RAIZ, 'backend-desamparados/src'))) {
    const rel = relative(RAIZ, f).replace(/\\/g, '/');
    lineasDe(readFileSync(f, 'utf8')).forEach((l, i) => {
      const linea = rel === RAIZ_DE_CONTRASENA.fichero ? l.replace(RAIZ_DE_CONTRASENA.elemento, '') : l;
      const texto = sinComentarios(linea);
      if (/['"`][^'"`]*\bcofrades?\b/i.test(texto)) hallazgos.push(`${rel}:${i + 1}: ${texto.trim()}`);
    });
  }
  assert.deepEqual(hallazgos, [], `«cofrade» en un texto visible:\n${hallazgos.join('\n')}`);
});
