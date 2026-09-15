# Portada y Recorrido editables — plan de implementación

> **Para quien lo ejecute:** SUB-SKILL OBLIGATORIA: usa `superpowers:subagent-driven-development` (recomendada) o `superpowers:executing-plans` para implementarlo tarea a tarea. Los pasos llevan casilla (`- [ ]`) para ir marcándolos.

**Objetivo:** que los textos de los seis bloques de la portada, la foto de «Sábado de Pasión» y la página del Recorrido se editen desde el CMS, sin tocar código ni desplegar.

**Arquitectura:** un documento JSON por página en la tabla `ContenidoPagina` (filas `portada` y `recorrido`). Los textos de hoy viven en `shared/contenido-por-defecto.json`, que leen la siembra del backend y el frontend. El servidor mezcla lo guardado sobre los valores por defecto antes de servirlo, así que un campo que falte nunca deja un hueco. La portada no hace ninguna petición más que ahora: la llamada que el hero ya espera pasa a devolver imágenes y textos juntos.

**Tecnología:** Node 22 + Express + Prisma 7.10 (MariaDB 11.8) + arktype en el backend; React 19 + TypeScript + Vite + MUI + react-query en el frontend. Tests: `node:test` en backend, Vitest + Testing Library en frontend.

**Spec:** [`docs/superpowers/specs/2026-09-15-portada-y-recorrido-editables-design.md`](../specs/2026-09-15-portada-y-recorrido-editables-design.md)

## Restricciones globales

Se aplican a todas las tareas:

- **La corporación es el «Grupo Parroquial»**, con concordancia masculina. Nunca «Hermandad» ni «Cofradía» en texto visible. Los miembros sí son «hermanos».
- **MariaDB tiene que estar levantada** para la batería del backend: `docker start desamparados-mariadb`. Sin ella los tests que la necesitan se **omiten**, y en este proyecto **omitido no es pasado**.
- **Las migraciones no se crean con `prisma migrate dev`** (el usuario de la base no puede crear la base sombra). Se escribe el SQL con `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, se guarda en `prisma/migrations/<fecha>_<nombre>/migration.sql` y se aplica con `npx prisma migrate deploy`.
- **Typecheck del frontend: `npx tsc -b`**, nunca `tsc --noEmit` a secas (el proyecto usa *project references*).
- **Los tests del backend van en serie** (`--test-concurrency=1`). No quitar el flag.
- **Toda ruta protegida se comprueba sondeando el servidor**, no leyendo el router: 401 = protegida, 500 = llegó a la base de datos sin sesión.
- **Todo `orderBy` paginado lleva desempate** por `{ id: 'asc' }`. (Aquí no hay listados nuevos paginados, pero la regla sigue en pie.)
- **No hay usuarios en producción**: no se planean avisos de compatibilidad ni rutas de transición.
- Cada tarea termina con **commit propio**, con la atribución que use la sesión.

## Estructura de ficheros

**Compartido**
- Crear `shared/contenido-por-defecto.json` — los textos de hoy, para los dos lados. Única fuente de verdad.

**Backend** (`backend-desamparados/`)
- Crear `src/domain/contenido.ts` — mezcla pura con los valores por defecto (sin base de datos). Aquí viven las reglas raras: objetos se mezclan, listas se sustituyen, teselas se casan por clave.
- Crear `src/schemas/contenido.schema.ts` — esquemas arktype de los dos documentos.
- Crear `src/services/contenido.service.ts` — leer y guardar el documento; borrado de fotos que dejan de usarse.
- Crear `src/controllers/contenido.controller.ts`, `src/routes/contenido.routes.ts`.
- Modificar `prisma/schema.prisma` (modelo nuevo), `prisma/seed-contenido.ts` (siembra).
- Modificar `src/utils/ficheros-publicos.ts` — que el limpiador conozca la tabla nueva.
- Modificar `src/controllers/portada.controller.ts`, `src/routes/portada.routes.ts` — `GET /api/portada` con imágenes y textos.
- Crear `test/contenido-mezcla.test.ts` (puro), `test/contenido-api.test.ts` (con base de datos), y modificar `test/ficheros-huerfanos.test.ts`.

**Frontend** (`desamparados-web/`)
- Crear `src/lib/api/contenido.ts` — tipos y llamadas.
- Crear `src/features/home/useContenidoPortada.ts` — la consulta compartida por los seis bloques.
- Modificar `src/lib/api/portada.ts`, los seis componentes de `src/features/home/`, y `src/features/corporation/sabado-pasion/RecorridoPage.tsx`.
- Crear `src/features/cms/contenido/SeccionPlegable.tsx` y `CampoTexto.tsx` — piezas de las dos pantallas.
- Reescribir `src/features/cms/PortadaAdminPage.tsx`; crear `src/features/cms/RecorridoAdminPage.tsx`.
- Modificar `src/app/cmsNavegacion.ts` y `src/routes/index.tsx`.

---

## Tarea 1: Los textos de hoy, en un solo fichero, y la mezcla

Todo lo demás se apoya en esto. La mezcla es pura (no toca base de datos ni HTTP), así que se prueba sola y rápido.

**Ficheros:**
- Crear: `shared/contenido-por-defecto.json`
- Crear: `backend-desamparados/src/domain/contenido.ts`
- Test: `backend-desamparados/test/contenido-mezcla.test.ts`

**Interfaces:**
- Produce: `SLUGS_CONTENIDO: readonly ['portada','recorrido']`, `type SlugContenido`, `porDefecto(slug): unknown`, `mezclarConDefectos(slug: SlugContenido, guardado: unknown): unknown`.
- Consume: nada.

- [ ] **Paso 1: escribir el fichero de textos por defecto**

`shared/contenido-por-defecto.json`. Son los textos que hoy están escritos a mano en los componentes; copiarlos **literalmente**, tildes incluidas.

```json
{
  "portada": {
    "hero": {
      "ceja": "Grupo Parroquial · Málaga",
      "titulo": "Desamparados Málaga",
      "parrafo": "Devoción, historia y patrimonio en el corazón de Málaga. Acompáñanos en nuestro solemne caminar.",
      "botonPrincipal": "Conoce el Grupo Parroquial",
      "enlaceSecundario": "Agenda y cultos"
    },
    "actualidad": {
      "ceja": "Actualidad",
      "titulo": "Últimas noticias",
      "enlace": "Ver todas"
    },
    "agenda": {
      "ceja": "Cultos",
      "titulo": "Agenda y Cultos",
      "parrafo": "La vida de oración del Grupo Parroquial a lo largo del año litúrgico: cultos, formación y convivencia.",
      "enlace": "Calendario completo",
      "directoTitulo": "Ver en directo",
      "directoTexto": "Retransmisión desde la sede"
    },
    "accesos": {
      "placa": {
        "ceja": "Hazte hermano",
        "titulo": "Forma parte de nuestra historia",
        "texto": "Una comunidad de fe que vive la devoción a nuestra Sagrada Titular y trabaja por el bien común.",
        "boton": "Quiero ser hermano"
      },
      "teselas": [
        { "clave": "sede", "titulo": "Nuestra sede", "descripcion": "Parroquia de los Pasionistas" },
        { "clave": "caridad", "titulo": "Caridad", "descripcion": "Ayuda social y obra asistencial" },
        { "clave": "historia", "titulo": "Historia", "descripcion": "Orígenes y evolución del Grupo Parroquial" },
        { "clave": "boletines", "titulo": "Boletines", "descripcion": "Boletín informativo y anuarios" },
        { "clave": "youtube", "titulo": "Canal de YouTube", "descripcion": "Vídeos y retransmisiones" },
        { "clave": "contacto", "titulo": "Contacto", "descripcion": "Estamos a tu disposición" }
      ]
    },
    "sabadoDePasion": {
      "ceja": "Sábado de Pasión",
      "titulo": "Una devoción que\ncamina con nosotros.",
      "parrafo": "La fe compartida, el encuentro y la emoción de acompañar a Nuestra Señora por las calles de Málaga.",
      "enlace": "Vive el Sábado de Pasión",
      "imagenUrl": "/images/nazarenos-1280.webp",
      "imagenAlt": "Nazarenos de capirote blanco durante la procesión"
    },
    "publicaciones": {
      "boton": "Archivo de publicaciones",
      "marcaDeAgua": "DESAMPARADOS"
    }
  },
  "recorrido": {
    "titulo": "Recorrido",
    "subtitulo": "Itinerario oficial de la estación de penitencia.",
    "introduccion": "El itinerario de la procesión del Sábado de Pasión recorre algunas de las calles más emblemáticas de Málaga. Los horarios son orientativos y pueden sufrir ligeras modificaciones en función del ritmo de la cofradía y de las circunstancias del momento.",
    "tituloItinerario": "Itinerario y horarios aproximados",
    "plano": { "url": "", "alt": "" },
    "paradas": [
      { "hora": "17:30", "lugar": "Salida desde la Parroquia de los Desamparados" },
      { "hora": "18:00", "lugar": "Plaza de la Constitución" },
      { "hora": "18:30", "lugar": "Calle Marqués de Larios" },
      { "hora": "19:00", "lugar": "Plaza de la Marina" },
      { "hora": "19:30", "lugar": "Paseo del Parque" },
      { "hora": "20:00", "lugar": "Plaza del Obispo" },
      { "hora": "20:30", "lugar": "Calle Molina Lario" },
      { "hora": "21:00", "lugar": "Plaza de la Constitución" },
      { "hora": "21:30", "lugar": "Entrada en la Parroquia de los Desamparados" }
    ]
  }
}
```

- [ ] **Paso 2: escribir el test de la mezcla, que falla**

`backend-desamparados/test/contenido-mezcla.test.ts`:

```ts
// La mezcla con los valores por defecto. Tres reglas que no son evidentes y
// que, mal hechas, fallan en silencio: los objetos se mezclan campo a campo,
// las listas se sustituyen enteras, y las teselas se casan por su clave.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mezclarConDefectos, porDefecto } from '../src/domain/contenido.js';

test('un campo que no está guardado sale del valor por defecto', () => {
  const mezclado = mezclarConDefectos('portada', { hero: { titulo: 'Otro título' } }) as any;

  assert.equal(mezclado.hero.titulo, 'Otro título');
  assert.equal(mezclado.hero.ceja, 'Grupo Parroquial · Málaga', 'lo no tocado conserva el texto de siempre');
  assert.equal(mezclado.publicaciones.boton, 'Archivo de publicaciones', 'un bloque entero que falta, también');
});

test('una lista guardada sustituye a la de por defecto, no se mezcla con ella', () => {
  const mezclado = mezclarConDefectos('recorrido', { paradas: [{ hora: '18:00', lugar: 'Plaza nueva' }] }) as any;

  assert.equal(mezclado.paradas.length, 1, 'si se mezclaran, quedarían las nueve de por defecto');
  assert.deepEqual(mezclado.paradas[0], { hora: '18:00', lugar: 'Plaza nueva' });
});

test('borrar todas las paradas las deja borradas', () => {
  // Si la lista vacía se tratara como «no hay nada guardado», el CMS parecería
  // no guardar: se borran las nueve, se guarda, y vuelven las nueve.
  const mezclado = mezclarConDefectos('recorrido', { paradas: [] }) as any;

  assert.deepEqual(mezclado.paradas, []);
});

test('las teselas se casan por clave y no por posición', () => {
  // Solo se guarda la de contacto, que por defecto es la SEXTA. Por posición,
  // su texto acabaría en «Nuestra sede» y todas las demás correrían.
  const mezclado = mezclarConDefectos('portada', {
    accesos: { teselas: [{ clave: 'contacto', titulo: 'Escríbenos', descripcion: 'Te contestamos' }] },
  }) as any;

  const porClave = Object.fromEntries(mezclado.accesos.teselas.map((t: any) => [t.clave, t]));
  assert.equal(porClave.contacto.titulo, 'Escríbenos');
  assert.equal(porClave.sede.titulo, 'Nuestra sede', 'la que no se guardó conserva su texto');
  assert.equal(mezclado.accesos.teselas.length, 6, 'siguen siendo las seis, en su orden');
  assert.equal(mezclado.accesos.teselas[0].clave, 'sede', 'y en el orden del código, no en el del documento');
});

test('una tesela con una clave que el código no conoce se descarta', () => {
  const mezclado = mezclarConDefectos('portada', {
    accesos: { teselas: [{ clave: 'inventada', titulo: 'No existe', descripcion: 'x' }] },
  }) as any;

  assert.ok(!mezclado.accesos.teselas.some((t: any) => t.clave === 'inventada'));
  assert.equal(mezclado.accesos.teselas.length, 6);
});

test('lo guardado no puede alterar el objeto de por defecto', () => {
  // `porDefecto` devuelve el mismo objeto en cada llamada si no se copia, y una
  // mezcla que escriba encima lo dejaría contaminado para la siguiente petición.
  mezclarConDefectos('portada', { hero: { titulo: 'Contaminado' } });

  assert.equal((porDefecto('portada') as any).hero.titulo, 'Desamparados Málaga');
});

test('un documento que no es un objeto se ignora entero', () => {
  // Una fila corrupta o un null no pueden tumbar la portada.
  for (const basura of [null, 'texto', 42, []]) {
    const mezclado = mezclarConDefectos('portada', basura) as any;
    assert.equal(mezclado.hero.titulo, 'Desamparados Málaga');
  }
});
```

- [ ] **Paso 3: ver que falla**

```bash
cd backend-desamparados && npx tsx --test test/contenido-mezcla.test.ts
```

Esperado: falla al importar, «Cannot find module '../src/domain/contenido.js'».

- [ ] **Paso 4: escribir la mezcla**

`backend-desamparados/src/domain/contenido.ts`:

```ts
import defectos from '../../../shared/contenido-por-defecto.json' with { type: 'json' };

export const SLUGS_CONTENIDO = ['portada', 'recorrido'] as const;
export type SlugContenido = (typeof SLUGS_CONTENIDO)[number];

export const esSlugContenido = (valor: unknown): valor is SlugContenido =>
  typeof valor === 'string' && (SLUGS_CONTENIDO as readonly string[]).includes(valor);

/** Copia nueva de los textos de siempre. Nunca se devuelve el objeto original. */
export const porDefecto = (slug: SlugContenido): unknown =>
  structuredClone((defectos as Record<string, unknown>)[slug]);

const esObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Mezcla lo guardado sobre los valores por defecto.
 *
 * Profunda en los objetos y **no** en las listas, y esto es de corrección:
 *
 * - Una lista guardada sustituye entera a la de por defecto. Si se mezclara
 *   elemento a elemento, borrar las nueve paradas del recorrido dejaría las
 *   nueve de por defecto de vuelta y el CMS parecería no guardar.
 * - Las teselas son la excepción, y por eso tienen su propia función: se casan
 *   por `clave`. Por posición, quitar una del documento correría todas las
 *   demás y cada tesela quedaría con el texto de otra.
 */
function mezclar(defecto: unknown, guardado: unknown): unknown {
  if (!esObjeto(defecto) || !esObjeto(guardado)) return defecto;

  const salida: Record<string, unknown> = { ...defecto };
  for (const [clave, valor] of Object.entries(guardado)) {
    if (!(clave in defecto)) continue; // Campos que el código no conoce: fuera.
    if (clave === 'teselas' && Array.isArray(defecto[clave]) && Array.isArray(valor)) {
      salida[clave] = mezclarTeselas(defecto[clave] as Record<string, unknown>[], valor);
    } else if (Array.isArray(defecto[clave])) {
      if (Array.isArray(valor)) salida[clave] = valor;
    } else if (esObjeto(defecto[clave])) {
      salida[clave] = mezclar(defecto[clave], valor);
    } else if (typeof valor === typeof defecto[clave]) {
      salida[clave] = valor;
    }
  }
  return salida;
}

/** El orden y el número de teselas los manda el código; el documento solo pone textos. */
function mezclarTeselas(defecto: Record<string, unknown>[], guardadas: unknown[]): unknown[] {
  const porClave = new Map(
    guardadas.filter(esObjeto).map((t) => [t.clave, t] as const)
  );
  return defecto.map((tesela) => mezclar(tesela, porClave.get(tesela.clave) ?? {}));
}

export const mezclarConDefectos = (slug: SlugContenido, guardado: unknown): unknown =>
  mezclar(porDefecto(slug), guardado);
```

- [ ] **Paso 5: ver que pasa**

```bash
cd backend-desamparados && npx tsx --test test/contenido-mezcla.test.ts
```

Esperado: los 7 tests en verde.

Si el import del JSON con `with { type: 'json' }` diera problemas con la versión de Node o el `tsconfig`, la alternativa es leerlo con `readFileSync` + `JSON.parse` desde `new URL('../../../shared/contenido-por-defecto.json', import.meta.url)`, que es como ya lo hace `test/identidad-paridad.test.ts`. **No** duplicar los textos en un `.ts`.

- [ ] **Paso 6: comprometer**

```bash
git add shared/contenido-por-defecto.json backend-desamparados/src/domain/contenido.ts backend-desamparados/test/contenido-mezcla.test.ts
git commit -m "Textos de la portada y el recorrido en un fichero compartido, con su mezcla"
```

---

## Tarea 2: La tabla y su siembra

**Ficheros:**
- Modificar: `backend-desamparados/prisma/schema.prisma`
- Crear: `backend-desamparados/prisma/migrations/20260915120000_contenido_pagina/migration.sql`
- Modificar: `backend-desamparados/prisma/seed-contenido.ts`
- Test: `backend-desamparados/test/contenido-api.test.ts` (solo la parte de siembra; la API llega en la tarea 4)

**Interfaces:**
- Consume: `SLUGS_CONTENIDO`, `porDefecto` de la tarea 1.
- Produce: modelo `ContenidoPagina { slug, datos, updatedAt }`; `sembrarContenidoPaginas()` exportada desde `seed-contenido.ts`.

- [ ] **Paso 1: escribir el test de la siembra, que falla**

`backend-desamparados/test/contenido-api.test.ts`:

```ts
// El contenido editable de la portada y el recorrido contra MariaDB.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import db from '../src/config/db.js';
import { sembrarContenidoPaginas } from '../prisma/seed-contenido.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let dbDisponible = false;

before(async () => {
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => { await db.$disconnect(); });

test('la siembra deja las dos páginas con los textos de siempre', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  await sembrarContenidoPaginas();
  const filas = await db.contenidoPagina.findMany({ orderBy: { slug: 'asc' } });

  assert.deepEqual(filas.map((f) => f.slug), ['portada', 'recorrido']);
  assert.equal((filas[0].datos as any).hero.titulo, 'Desamparados Málaga');
  assert.equal((filas[1].datos as any).paradas.length, 9);
});

test('sembrar dos veces no pisa lo que se haya editado', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  await sembrarContenidoPaginas();
  const antes = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });
  await db.contenidoPagina.update({
    where: { slug: 'portada' },
    data: { datos: { ...(antes!.datos as object), hero: { titulo: 'Editado a mano' } } },
  });

  await sembrarContenidoPaginas();

  const despues = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });
  assert.equal((despues!.datos as any).hero.titulo, 'Editado a mano', 'la siembra no puede deshacer una edición');

  // Se deja como estaba para no ensuciar la base de desarrollo.
  await db.contenidoPagina.update({ where: { slug: 'portada' }, data: { datos: antes!.datos as object } });
});
```

- [ ] **Paso 2: ver que falla**

```bash
cd backend-desamparados && docker start desamparados-mariadb && npx tsx --test test/contenido-api.test.ts
```

Esperado: falla porque `db.contenidoPagina` no existe (`Cannot read properties of undefined`) y porque `sembrarContenidoPaginas` no está exportada.

- [ ] **Paso 3: añadir el modelo**

Al final de `prisma/schema.prisma`, junto a `ImagenPortada`:

```prisma
// Contenido editable de una página: un documento por página, validado contra su
// esquema antes de escribirse. La ESTRUCTURA la fija el código (qué bloques hay
// y en qué orden); esto guarda solo lo que dentro de ella se puede cambiar,
// textos e imágenes. Dos filas: 'portada' y 'recorrido'.
//
// OJO: si un campo de `datos` apunta a /storage/public, tiene que contar en
// `utils/ficheros-publicos.ts` o el limpiador de huérfanos borrará la foto
// estando publicada.
model ContenidoPagina {
  slug      String   @id
  datos     Json
  updatedAt DateTime @updatedAt
}
```

- [ ] **Paso 4: generar y aplicar la migración**

```bash
cd backend-desamparados
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > /tmp/contenido.sql
mkdir -p prisma/migrations/20260915120000_contenido_pagina
mv /tmp/contenido.sql prisma/migrations/20260915120000_contenido_pagina/migration.sql
npx prisma migrate deploy
npx prisma generate
```

Revisar el SQL antes de aplicarlo: tiene que ser **solo** un `CREATE TABLE ContenidoPagina`. Si trae `DROP` o `ALTER` de otras tablas, el esquema local ha derivado y hay que arreglar eso primero.

- [ ] **Paso 5: escribir la siembra**

En `prisma/seed-contenido.ts`, antes de `sembrarContenido`:

```ts
import { porDefecto, SLUGS_CONTENIDO } from '../src/domain/contenido.js';

/**
 * Deja las dos páginas con los textos de siempre. Idempotente y **sin `update`**:
 * volver a sembrar no puede deshacer lo que alguien haya editado desde el CMS.
 */
export async function sembrarContenidoPaginas() {
  for (const slug of SLUGS_CONTENIDO) {
    await db.contenidoPagina.upsert({
      where: { slug },
      update: {},
      create: { slug, datos: porDefecto(slug) as object },
    });
  }
  console.log(`   ${SLUGS_CONTENIDO.length} páginas de contenido editable`);
}
```

Y añadir `await sembrarContenidoPaginas();` dentro de `sembrarContenido()`, justo después de `sembrarImagenesPortada()`.

- [ ] **Paso 6: ver que pasa**

```bash
cd backend-desamparados && npx tsx --test test/contenido-api.test.ts
```

Esperado: los 2 tests en verde, ninguno omitido.

- [ ] **Paso 7: comprometer**

```bash
git add backend-desamparados/prisma backend-desamparados/test/contenido-api.test.ts
git commit -m "Tabla ContenidoPagina y su siembra con los textos de hoy"
```

---

## Tarea 3: Los esquemas de validación

Sin esto, el `PUT` aceptaría cualquier JSON y la portada podría acabar con un número donde va un título.

**Ficheros:**
- Crear: `backend-desamparados/src/schemas/contenido.schema.ts`
- Test: `backend-desamparados/test/contenido-esquemas.test.ts`

**Interfaces:**
- Consume: `rutaImagenPublica` de `src/schemas/portada.schema.ts`; `SlugContenido` de `src/domain/contenido.ts`.
- Produce: `esquemaDeSlug(slug: SlugContenido)` que devuelve el tipo arktype del cuerpo, y `guardarContenidoSchema(slug)` para el middleware `validate`.

- [ ] **Paso 1: escribir el test, que falla**

`backend-desamparados/test/contenido-esquemas.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArkErrors } from 'arktype';
import { esquemaDeSlug } from '../src/schemas/contenido.schema.js';
import { porDefecto } from '../src/domain/contenido.js';

const valida = (slug: 'portada' | 'recorrido', datos: unknown) =>
  !(esquemaDeSlug(slug)(datos) instanceof ArkErrors);

test('los valores por defecto pasan su propio esquema', () => {
  // Si no pasaran, la siembra escribiría algo que el CMS no podría volver a guardar.
  assert.ok(valida('portada', porDefecto('portada')));
  assert.ok(valida('recorrido', porDefecto('recorrido')));
});

test('un título que no es texto se rechaza', () => {
  const datos = porDefecto('portada') as any;
  datos.hero.titulo = 42;
  assert.ok(!valida('portada', datos));
});

test('el texto no puede llevar etiquetas HTML', () => {
  // Acaba dentro de un <Typography>: sin esto, un <img onerror> guardado desde
  // el CMS sería XSS almacenado el día que alguien lo pinte con dangerouslySetInnerHTML.
  const datos = porDefecto('portada') as any;
  datos.hero.titulo = '<img src=x onerror=alert(1)>';
  assert.ok(!valida('portada', datos));
});

test('la foto tiene que ser una ruta del propio sitio', () => {
  const datos = porDefecto('portada') as any;
  datos.sabadoDePasion.imagenUrl = 'https://otro-sitio.example/foto.jpg';
  assert.ok(!valida('portada', datos), 'una URL externa acabaría en el src de una <img> de la portada');

  datos.sabadoDePasion.imagenUrl = '/storage/public/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.webp';
  assert.ok(valida('portada', datos));
});

test('un plano sin descripción no se guarda', () => {
  const datos = porDefecto('recorrido') as any;
  datos.plano = { url: '/storage/public/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.webp', alt: '' };
  assert.ok(!valida('recorrido', datos), 'un plano sin alt deja sin recorrido a quien use lector de pantalla');

  datos.plano.alt = 'Plano del recorrido por el centro de Málaga';
  assert.ok(valida('recorrido', datos));
});

test('sin plano, la descripción vacía es correcta', () => {
  const datos = porDefecto('recorrido') as any;
  datos.plano = { url: '', alt: '' };
  assert.ok(valida('recorrido', datos));
});

test('la hora de una parada tiene que parecer una hora', () => {
  const datos = porDefecto('recorrido') as any;
  datos.paradas = [{ hora: 'por la tarde', lugar: 'Plaza' }];
  assert.ok(!valida('recorrido', datos));

  datos.paradas = [{ hora: '17:30', lugar: 'Plaza' }];
  assert.ok(valida('recorrido', datos));
});

test('una lista de paradas vacía es correcta', () => {
  const datos = porDefecto('recorrido') as any;
  datos.paradas = [];
  assert.ok(valida('recorrido', datos), 'la página puede estar en preparación');
});
```

- [ ] **Paso 2: ver que falla**

```bash
cd backend-desamparados && npx tsx --test test/contenido-esquemas.test.ts
```

Esperado: «Cannot find module '../src/schemas/contenido.schema.js'».

- [ ] **Paso 3: escribir los esquemas**

`backend-desamparados/src/schemas/contenido.schema.ts`:

```ts
import { type } from 'arktype';
import { rutaImagenPublica } from './portada.schema.js';
import type { SlugContenido } from '../domain/contenido.js';

/**
 * Un texto visible de la web. Sin `<` ni `>`: estos campos se pintan como texto
 * plano dentro de componentes de MUI, y prohibir las etiquetas aquí evita que
 * el día que alguien los pinte como HTML se convierta en XSS almacenado.
 */
const texto = (max: number) => type(`0 <= string <= ${max}`)
  .matching(/^[^<>]*$/)
  .describe(`un texto de hasta ${max} caracteres, sin < ni >`);

const TITULO = texto(120);
const PARRAFO = texto(600);
const ETIQUETA = texto(60);

const heroSchema = type({
  ceja: ETIQUETA, titulo: TITULO, parrafo: PARRAFO,
  botonPrincipal: ETIQUETA, enlaceSecundario: ETIQUETA,
});

const portadaSchema = type({
  hero: heroSchema,
  actualidad: { ceja: ETIQUETA, titulo: TITULO, enlace: ETIQUETA },
  agenda: {
    ceja: ETIQUETA, titulo: TITULO, parrafo: PARRAFO, enlace: ETIQUETA,
    directoTitulo: ETIQUETA, directoTexto: ETIQUETA,
  },
  accesos: {
    placa: { ceja: ETIQUETA, titulo: TITULO, texto: PARRAFO, boton: ETIQUETA },
    teselas: type({ clave: ETIQUETA, titulo: TITULO, descripcion: PARRAFO }).array().atMostLength(12),
  },
  sabadoDePasion: {
    ceja: ETIQUETA, titulo: TITULO, parrafo: PARRAFO, enlace: ETIQUETA,
    imagenUrl: rutaImagenPublica,
    imagenAlt: texto(200),
  },
  publicaciones: { boton: ETIQUETA, marcaDeAgua: ETIQUETA },
});

// La hora se enseña tal cual dentro de la pastilla del itinerario: se exige que
// lo parezca para que nadie meta un párrafo donde caben cinco caracteres.
const hora = type('string').matching(/^([01]\d|2[0-3]):[0-5]\d$/)
  .describe('una hora en formato 24 h, como 17:30');

const recorridoSchema = type({
  titulo: TITULO,
  subtitulo: PARRAFO,
  introduccion: PARRAFO,
  tituloItinerario: TITULO,
  // Cadena vacía = no hay plano. Con plano, el alt es obligatorio: se comprueba
  // debajo, porque arktype no cruza dos campos dentro del propio tipo.
  plano: { url: type('string').matching(/^$/).or(rutaImagenPublica), alt: texto(200) },
  paradas: type({ hora, lugar: texto(200) }).array().atMostLength(60),
}).narrow((datos, ctx) =>
  datos.plano.url === '' || datos.plano.alt.trim() !== ''
    ? true
    : ctx.reject({ expected: 'una descripción para el plano', path: ['plano', 'alt'] })
);

const ESQUEMAS = { portada: portadaSchema, recorrido: recorridoSchema } as const;

/** El esquema del documento de una página, para validarlo suelto. */
export const esquemaDeSlug = (slug: SlugContenido) => ESQUEMAS[slug];

/** Para el middleware `validate`: el documento viaja en `body.datos`. */
export const guardarContenidoSchema = (slug: SlugContenido) =>
  type({ body: { datos: ESQUEMAS[slug] } });
```

- [ ] **Paso 4: ver que pasa**

```bash
cd backend-desamparados && npx tsx --test test/contenido-esquemas.test.ts
```

Esperado: los 8 tests en verde. Si `narrow` no acepta esa firma en la versión de arktype instalada, consultar `src/schemas/` para ver cómo se hacen ahí las validaciones entre campos y replicar ese patrón; el requisito («plano sin alt no se guarda») no se negocia.

- [ ] **Paso 5: comprometer**

```bash
git add backend-desamparados/src/schemas/contenido.schema.ts backend-desamparados/test/contenido-esquemas.test.ts
git commit -m "Esquemas de validación del contenido de portada y recorrido"
```

---

## Tarea 4: El limpiador de huérfanos tiene que conocer la tabla nueva

**Va antes que el guardado a propósito.** Si se hace después, hay una ventana en la que guardar la portada borra del disco una foto publicada. Es el fallo silencioso que avisa el comentario de `contarReferencias`.

**Ficheros:**
- Modificar: `backend-desamparados/src/utils/ficheros-publicos.ts:74-109`
- Modificar: `backend-desamparados/scripts/limpiar-huerfanos.ts`
- Test: `backend-desamparados/test/ficheros-huerfanos.test.ts`

**Interfaces:**
- Consume: la tabla `ContenidoPagina` de la tarea 2.
- Produce: `contarReferencias` y `subidasReferenciadas` cuentan también lo que menciona `ContenidoPagina.datos`.

- [ ] **Paso 1: escribir el test, que falla**

Añadir al final de `backend-desamparados/test/ficheros-huerfanos.test.ts` (usa el `dbDisponible`/`SIN_DB` que ese fichero ya tenga; si no lo tuviera, copiar el bloque `before` de `test/contenido-api.test.ts`):

```ts
test('una foto que solo menciona ContenidoPagina cuenta como en uso', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  // Nombre con la forma exacta de una subida del CMS: 32 hex + extensión.
  const nombre = 'ab12cd34ef56ab78cd90ef12ab34cd56.webp';
  const ruta = `/storage/public/${nombre}`;
  const antes = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });

  try {
    await db.contenidoPagina.upsert({
      where: { slug: 'portada' },
      update: { datos: { sabadoDePasion: { imagenUrl: ruta } } },
      create: { slug: 'portada', datos: { sabadoDePasion: { imagenUrl: ruta } } },
    });

    assert.equal(
      await contarReferencias(nombre), 1,
      'sin esto, guardar la portada borraría del disco la foto que acaba de publicarse',
    );
    assert.ok(
      (await subidasReferenciadas()).has(nombre),
      'sin esto, limpiar:huerfanos --borrar la borraría estando en la web',
    );
  } finally {
    if (antes) await db.contenidoPagina.update({ where: { slug: 'portada' }, data: { datos: antes.datos as object } });
    else await db.contenidoPagina.deleteMany({ where: { slug: 'portada' } });
  }
});
```

Asegurarse de que el fichero importa `contarReferencias` y `subidasReferenciadas` de `../src/utils/ficheros-publicos.js` y `db` de `../src/config/db.js`.

- [ ] **Paso 2: ver que falla**

```bash
cd backend-desamparados && npx tsx --test test/ficheros-huerfanos.test.ts
```

Esperado: falla con `0 !== 1`. **Este fallo es el valor del test**: demuestra que hoy la foto se daría por huérfana.

- [ ] **Paso 3: añadir la tabla a las dos funciones**

En `src/utils/ficheros-publicos.ts`, dentro de `contarReferencias`, añadir a la lista de `cuentas`:

```ts
    // El contenido editable guarda rutas de foto dentro de un JSON (la de
    // «Sábado de Pasión», el plano del recorrido). Son dos filas: se leen
    // enteras y se busca el nombre en su texto, porque el filtro JSON de Prisma
    // sobre MariaDB no es de fiar para un `contains` dentro de un objeto.
    contarEnContenido(nombre),
```

Y fuera de la clase, en el mismo fichero:

```ts
async function contarEnContenido(nombre: string): Promise<number> {
  const paginas = await db.contenidoPagina.findMany({ select: { datos: true } });
  return subidasEnTexto(...paginas.map((p) => JSON.stringify(p.datos))).has(nombre) ? 1 : 0;
}
```

En `subidasReferenciadas`, añadir `db.contenidoPagina.findMany({ select: { datos: true } })` al `Promise.all` y sus datos a `textos`:

```ts
    ...contenido.map((p) => JSON.stringify(p.datos)),
```

`subidasEnTexto` busca con una expresión regular dentro de un texto cualquiera, así que el `JSON.stringify` del documento le vale igual que el HTML de una noticia: no hay que saber en qué campo está la ruta.

- [ ] **Paso 4: actualizar el comentario del fichero**

En el bloque de `contarReferencias` que dice «Es la lista de todos los sitios donde el CMS guarda rutas», dejar constancia de que el contenido editable ya está contemplado, para que el siguiente que lea no crea que falta.

- [ ] **Paso 5: ver que pasa**

```bash
cd backend-desamparados && npx tsx --test test/ficheros-huerfanos.test.ts
```

Esperado: todos en verde, ninguno omitido.

- [ ] **Paso 6: comprometer**

```bash
git add backend-desamparados/src/utils/ficheros-publicos.ts backend-desamparados/test/ficheros-huerfanos.test.ts
git commit -m "Que el limpiador de huérfanos cuente las fotos del contenido editable"
```

---

## Tarea 5: La API del contenido

**Ficheros:**
- Crear: `backend-desamparados/src/services/contenido.service.ts`
- Crear: `backend-desamparados/src/controllers/contenido.controller.ts`
- Crear: `backend-desamparados/src/routes/contenido.routes.ts`
- Modificar: `backend-desamparados/src/app.ts` (montar el router)
- Modificar: `backend-desamparados/src/services/audit.service.ts` (acción nueva)
- Test: `backend-desamparados/test/contenido-api.test.ts`

**Interfaces:**
- Consume: `mezclarConDefectos`, `esSlugContenido`, `SlugContenido` (tarea 1); `esquemaDeSlug` (tarea 3); `borrarSubidasHuerfanas`, `subidasEnTexto` (tarea 4).
- Produce: `ContenidoService.leer(slug)`, `ContenidoService.guardar(slug, datos)`; rutas `GET /api/contenido/:slug` y `PUT /api/contenido/:slug`.

- [ ] **Paso 1: escribir los tests, que fallan**

Añadir a `backend-desamparados/test/contenido-api.test.ts`. Hace falta levantar `app` en un puerto efímero, igual que `test/recibo-detalle.test.ts`:

```ts
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS, COOKIE_HERMANO } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';

let server: Server;
let baseUrl: string;
// (añadir al `before` existente)
//   server = app.listen(0);
//   await new Promise<void>((resolve) => server.once('listening', resolve));
//   baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
// (y al `after`)
//   await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve()));

const cookieCms = (id: number, role: Role) => `${COOKIE_CMS}=${generateToken(id, role, false, 'cms')}`;

test('GET /api/contenido/portada devuelve el documento mezclado, sin sesión', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  await sembrarContenidoPaginas();

  const respuesta = await fetch(`${baseUrl}/api/contenido/portada`);
  assert.equal(respuesta.status, 200);

  const datos = await respuesta.json() as any;
  assert.equal(datos.hero.titulo, 'Desamparados Málaga');
  assert.equal(datos.accesos.teselas.length, 6);
});

test('un campo que falta en la fila sale del valor por defecto', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const antes = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });
  try {
    // Una fila a la que solo le queda el hero: simula un documento guardado
    // antes de que existiera un campo nuevo.
    await db.contenidoPagina.update({
      where: { slug: 'portada' }, data: { datos: { hero: { titulo: 'Solo esto' } } },
    });

    const datos = await (await fetch(`${baseUrl}/api/contenido/portada`)).json() as any;
    assert.equal(datos.hero.titulo, 'Solo esto');
    assert.equal(datos.publicaciones.boton, 'Archivo de publicaciones', 'el resto no puede quedar en blanco');
  } finally {
    await db.contenidoPagina.update({ where: { slug: 'portada' }, data: { datos: antes!.datos as object } });
  }
});

test('un slug que no existe responde 404 y no crea fila', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const respuesta = await fetch(`${baseUrl}/api/contenido/inventada`);
  assert.equal(respuesta.status, 404);
  assert.equal(await db.contenidoPagina.count({ where: { slug: 'inventada' } }), 0);
});

test('sin sesión no se puede guardar', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  // Se sondea el servidor, no se lee el router: un 500 aquí querría decir que la
  // petición llegó a la base de datos sin sesión.
  const respuesta = await fetch(`${baseUrl}/api/contenido/portada`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ datos: porDefecto('portada') }),
  });
  assert.equal(respuesta.status, 401);
});

test('un hermano sin cargo no puede guardar', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const usuario = await crearUsuarioPrueba(Role.USER);
  try {
    const respuesta = await fetch(`${baseUrl}/api/contenido/portada`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `${COOKIE_HERMANO}=${generateToken(usuario.id, Role.USER, false, 'hermanos')}`,
      },
      body: JSON.stringify({ datos: porDefecto('portada') }),
    });
    assert.ok(respuesta.status === 401 || respuesta.status === 403, `esperaba 401 o 403, llegó ${respuesta.status}`);
  } finally {
    await borrarUsuarioPrueba(usuario.id);
  }
});

test('un documento mal formado responde 400 y NO escribe', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const redes = await crearUsuarioPrueba(Role.REDES);
  const antes = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });
  try {
    const roto = porDefecto('portada') as any;
    roto.hero.titulo = 42;

    const respuesta = await fetch(`${baseUrl}/api/contenido/portada`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieCms(redes.id, Role.REDES) },
      body: JSON.stringify({ datos: roto }),
    });
    assert.equal(respuesta.status, 400);

    const despues = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });
    assert.deepEqual(despues!.datos, antes!.datos, 'un 400 no puede dejar la fila a medias');
  } finally {
    await borrarUsuarioPrueba(redes.id);
  }
});

test('REDES guarda y lo guardado se lee', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const redes = await crearUsuarioPrueba(Role.REDES);
  const antes = await db.contenidoPagina.findUnique({ where: { slug: 'portada' } });
  try {
    const nuevo = porDefecto('portada') as any;
    nuevo.hero.titulo = 'Desamparados de Málaga';

    const respuesta = await fetch(`${baseUrl}/api/contenido/portada`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieCms(redes.id, Role.REDES) },
      body: JSON.stringify({ datos: nuevo }),
    });
    assert.equal(respuesta.status, 200);

    const leido = await (await fetch(`${baseUrl}/api/contenido/portada`)).json() as any;
    assert.equal(leido.hero.titulo, 'Desamparados de Málaga');
  } finally {
    await db.contenidoPagina.update({ where: { slug: 'portada' }, data: { datos: antes!.datos as object } });
    await borrarUsuarioPrueba(redes.id);
  }
});
```

- [ ] **Paso 2: ver que fallan**

```bash
cd backend-desamparados && npx tsx --test test/contenido-api.test.ts
```

Esperado: los siete nuevos fallan con 404 («Endpoint no encontrado»), salvo el del slug inventado, que pasa en vacío. Ese se vuelve honesto en cuanto la ruta existe.

- [ ] **Paso 3: escribir el servicio**

`backend-desamparados/src/services/contenido.service.ts`:

```ts
import db from '../config/db.js';
import { mezclarConDefectos, porDefecto, type SlugContenido } from '../domain/contenido.js';
import { borrarSubidasHuerfanas, subidasEnTexto } from '../utils/ficheros-publicos.js';

export class ContenidoService {
  /**
   * El documento de una página, ya mezclado con los textos de siempre. Si la
   * fila no existe (base recién creada, siembra no ejecutada), se devuelven los
   * valores por defecto en vez de un 404: la web pública no puede quedarse en
   * blanco porque falte una fila.
   */
  static async leer(slug: SlugContenido): Promise<unknown> {
    const fila = await db.contenidoPagina.findUnique({ where: { slug }, select: { datos: true } });
    return fila ? mezclarConDefectos(slug, fila.datos) : porDefecto(slug);
  }

  /**
   * Sustituye el documento entero. Ya viene validado por el esquema de su slug.
   *
   * Las fotos que salen del documento se borran del disco si ningún otro
   * registro las usa, igual que hace `PortadaService.guardarImagenes`. Sin
   * esto, cambiar la foto de «Sábado de Pasión» dejaría la anterior publicada
   * para siempre en /storage/public.
   */
  static async guardar(slug: SlugContenido, datos: object): Promise<unknown> {
    const anterior = await db.contenidoPagina.findUnique({ where: { slug }, select: { datos: true } });

    await db.contenidoPagina.upsert({
      where: { slug },
      update: { datos },
      create: { slug, datos },
    });

    await borrarSubidasHuerfanas(subidasEnTexto(JSON.stringify(anterior?.datos ?? {})), {
      conservar: subidasEnTexto(JSON.stringify(datos)),
    });

    return this.leer(slug);
  }
}
```

- [ ] **Paso 4: escribir el controlador**

`backend-desamparados/src/controllers/contenido.controller.ts`:

```ts
import { Request, Response } from 'express';
import { ContenidoService } from '../services/contenido.service.js';
import { esSlugContenido } from '../domain/contenido.js';
import { handleHttp, NotFoundError } from '../utils/error.handle.js';
import { AuditService, AUDIT_ACTIONS } from '../services/audit.service.js';

export class ContenidoController {
  /** GET /api/contenido/:slug (pública: la lee la web). */
  static async leer(req: Request, res: Response) {
    try {
      const slug = req.params.slug;
      if (!esSlugContenido(slug)) throw new NotFoundError('Página no encontrada');
      res.status(200).json(await ContenidoService.leer(slug));
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo el contenido de la página');
    }
  }

  /** PUT /api/contenido/:slug (CMS): sustituye el documento entero. */
  static async guardar(req: Request, res: Response) {
    try {
      const slug = req.params.slug;
      if (!esSlugContenido(slug)) throw new NotFoundError('Página no encontrada');
      const datos = await ContenidoService.guardar(slug, req.body.datos);
      AuditService.log(AUDIT_ACTIONS.CONTENIDO_ACTUALIZAR, AuditService.metaFromReq(req), 'contenido', slug);
      res.status(200).json({ message: 'Contenido guardado', data: datos });
    } catch (e) {
      handleHttp(res, e, 'Error guardando el contenido de la página');
    }
  }
}
```

Y añadir a `AUDIT_ACTIONS` en `src/services/audit.service.ts`, junto a `PORTADA_ACTUALIZAR`:

```ts
  CONTENIDO_ACTUALIZAR: 'CONTENIDO_ACTUALIZAR',
```

- [ ] **Paso 5: escribir el router**

`backend-desamparados/src/routes/contenido.routes.ts`:

```ts
import { Router } from 'express';
import { Role } from '@prisma/client';
import { ContenidoController } from '../controllers/contenido.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { esSlugContenido } from '../domain/contenido.js';
import { guardarContenidoSchema } from '../schemas/contenido.schema.js';

const contenidoRoutes = Router();

// Gestión de contenido, como la portada y las noticias.
const rolesCMS = [Role.ADMIN, Role.REDES, Role.HERMANO_MAYOR];

// La web la lee sin sesión.
contenidoRoutes.get('/:slug', ContenidoController.leer);

/**
 * El esquema depende del slug, así que el `validate` se elige en tiempo de
 * petición. El slug se comprueba ANTES de validar: con uno desconocido no hay
 * esquema que aplicar, y responder 404 aquí evita que `guardarContenidoSchema`
 * reciba un índice que no existe.
 *
 * Los middlewares van en línea y no colgados de un `.use()` porque esta ruta
 * comparte camino con la pública de arriba: el orden de declaración manda, y un
 * `.use(authenticateToken)` entre las dos cerraría también la lectura pública.
 */
contenidoRoutes.put(
  '/:slug',
  authenticateToken,
  checkRole(rolesCMS),
  (req, res, next) => {
    const slug = req.params.slug;
    if (!esSlugContenido(slug)) return res.status(404).json({ message: 'Página no encontrada' });
    return validate(guardarContenidoSchema(slug))(req, res, next);
  },
  ContenidoController.guardar,
);

export { contenidoRoutes };
```

Y montarlo en `src/app.ts`, junto a los demás: `app.use('/api/contenido', contenidoRoutes);`

- [ ] **Paso 6: ver que pasan**

```bash
cd backend-desamparados && npx tsx --test test/contenido-api.test.ts
```

Esperado: los 9 tests del fichero en verde, ninguno omitido.

- [ ] **Paso 7: comprobar que el test del 404 dice algo de verdad**

Cambiar a mano `esSlugContenido` del controlador por `() => true` y volver a correr: el test del slug inventado tiene que **fallar** (crearía o buscaría una fila «inventada»). Deshacer el cambio y volver a verde.

- [ ] **Paso 8: comprometer**

```bash
git add backend-desamparados/src
git add backend-desamparados/test/contenido-api.test.ts
git commit -m "API del contenido editable: leer sin sesión, guardar desde el CMS"
```

---

## Tarea 6: `GET /api/portada` con imágenes y textos juntos

Para que la portada no haga ni una petición más que hoy.

**Ficheros:**
- Modificar: `backend-desamparados/src/controllers/portada.controller.ts`
- Modificar: `backend-desamparados/src/routes/portada.routes.ts`
- Modificar: `backend-desamparados/test/portada.test.ts`
- Modificar: `desamparados-web/src/lib/api/portada.ts`

**Interfaces:**
- Consume: `ContenidoService.leer` (tarea 5), `PortadaService.listarImagenes` (ya existe).
- Produce: `GET /api/portada` → `{ imagenes: ApiImagenPortada[], textos: <documento de portada> }`. `GET /api/portada/imagenes` **desaparece**.

- [ ] **Paso 1: escribir el test, que falla**

Añadir a `backend-desamparados/test/portada.test.ts`:

```ts
test('GET /api/portada trae las fotos y los textos en la misma respuesta', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  const respuesta = await fetch(`${baseUrl}/api/portada`);
  assert.equal(respuesta.status, 200);

  const cuerpo = await respuesta.json() as any;
  assert.ok(Array.isArray(cuerpo.imagenes), 'el hero necesita las fotos');
  assert.equal(typeof cuerpo.textos?.hero?.titulo, 'string', 'y los textos, para no pedirlos aparte');
});

test('la ruta vieja de solo imágenes ya no existe', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);

  // No hay usuarios en producción a los que mantener compatibilidad: la
  // absorbe GET /api/portada y se retira para no dejar dos caminos vivos.
  assert.equal((await fetch(`${baseUrl}/api/portada/imagenes`)).status, 404);
});
```

- [ ] **Paso 2: ver que falla**

```bash
cd backend-desamparados && npx tsx --test test/portada.test.ts
```

Esperado: el primero falla con 404; el segundo falla con 200 (la ruta vieja sigue viva).

- [ ] **Paso 3: implementar**

En `src/controllers/portada.controller.ts`, sustituir `listar` por:

```ts
  /**
   * GET /api/portada (pública). Devuelve fotos y textos juntos porque el hero
   * ya espera a esta llamada antes de pintar: así la portada entera no cuesta
   * ni una petición más de las que ya hacía.
   */
  static async listar(_req: Request, res: Response) {
    try {
      const [imagenes, textos] = await Promise.all([
        PortadaService.listarImagenes(),
        ContenidoService.leer('portada'),
      ]);
      res.status(200).json({ imagenes, textos });
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo la portada');
    }
  }
```

Importando `ContenidoService`. En `src/routes/portada.routes.ts`, cambiar la ruta pública:

```ts
// La portada de la web la lee sin sesión: fotos y textos de una vez.
portadaRoutes.get('/', PortadaController.listar);
```

El `PUT /imagenes` se queda exactamente como está.

- [ ] **Paso 4: actualizar el cliente del frontend**

En `desamparados-web/src/lib/api/portada.ts`, sustituir `getImagenesPortada` por:

```ts
export interface TextosPortada {
  hero: { ceja: string; titulo: string; parrafo: string; botonPrincipal: string; enlaceSecundario: string }
  actualidad: { ceja: string; titulo: string; enlace: string }
  agenda: { ceja: string; titulo: string; parrafo: string; enlace: string; directoTitulo: string; directoTexto: string }
  accesos: {
    placa: { ceja: string; titulo: string; texto: string; boton: string }
    teselas: { clave: string; titulo: string; descripcion: string }[]
  }
  sabadoDePasion: { ceja: string; titulo: string; parrafo: string; enlace: string; imagenUrl: string; imagenAlt: string }
  publicaciones: { boton: string; marcaDeAgua: string }
}

export interface Portada {
  imagenes: ImagenPortada[]
  textos: TextosPortada
}

/** Fotos y textos de la portada, de una sola petición. Se leen sin sesión. */
export async function getPortada(): Promise<Portada> {
  const { imagenes, textos } = await apiFetch<{ imagenes: ApiImagenPortada[]; textos: TextosPortada }>('/portada')
  return {
    imagenes: imagenes.map((i) => ({ id: i.id, url: i.url, descripcion: i.descripcion ?? '' })),
    textos,
  }
}
```

`guardarImagenesPortada` no se toca.

- [ ] **Paso 5: dejar el frontend compilando**

`Hero.tsx` y `PortadaAdminPage.tsx` llaman a `getImagenesPortada`, que ya no existe. Cambiarlos a `getPortada` quedándose de momento solo con `.imagenes`:

```ts
// Hero.tsx
const { data, status } = useQuery({
  queryKey: ['home', 'portada'],
  queryFn: getPortada,
  retry: false,
  staleTime: 5 * 60_000,
})
const imagenes = status === 'pending' ? null : data && data.imagenes.length > 0 ? data.imagenes : IMAGENES_POR_DEFECTO
```

Ojo: la clave de react-query pasa de `['home','portada-imagenes']` a `['home','portada']`. **Hay que cambiarla también** en la `invalidateQueries` de `PortadaAdminPage.tsx`, o guardar las fotos dejará de refrescar la portada.

- [ ] **Paso 6: ver que pasa todo**

```bash
cd backend-desamparados && npx tsx --test test/portada.test.ts
cd ../desamparados-web && npx tsc -b && npx vitest run src/features/home src/features/cms
```

Esperado: backend en verde; frontend compila y los tests que tocaban `/portada/imagenes` se han actualizado a `/portada`.

- [ ] **Paso 7: comprometer**

```bash
git add backend-desamparados/src backend-desamparados/test/portada.test.ts desamparados-web/src
git commit -m "GET /api/portada: fotos y textos en la misma respuesta"
```

---

## Tarea 7: La consulta compartida y los textos del hero

**Ficheros:**
- Crear: `desamparados-web/src/features/home/useContenidoPortada.ts`
- Modificar: `desamparados-web/src/features/home/Hero.tsx`
- Test: `desamparados-web/src/features/home/__tests__/Hero.test.tsx`

**Interfaces:**
- Consume: `getPortada`, `TextosPortada` (tarea 6).
- Produce: `useTextosPortada(): TextosPortada` — siempre devuelve un documento completo, nunca `undefined`. Y el ayudante de tests `responderPortada`, que usan las tareas 8, 9 y 10.

- [ ] **Paso 0: el ayudante de tests que usarán los seis bloques**

Crear `desamparados-web/src/features/home/__tests__/ayudas.ts`. Los bloques de la portada piden **más de una cosa** (la portada y, según el bloque, noticias, eventos o publicaciones), así que un `fetch` simulado que devuelva siempre lo mismo hace pasar tests por el motivo equivocado:

```ts
import { vi } from 'vitest'
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'
import type { TextosPortada } from '../../../lib/api/portada'

export const textosDePrueba = () => structuredClone(POR_DEFECTO.portada) as TextosPortada

const json = (cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } })

/**
 * Simula la API de la portada. `/portada` devuelve los textos que se le pasen;
 * cualquier otra ruta, una lista vacía con su `meta`, que es lo que esperan los
 * bloques que además piden noticias, agenda o publicaciones.
 *
 * Una instancia de `Response` NUEVA por llamada: `apiFetch` lee el cuerpo con
 * `res.text()` y reutilizar la misma la dejaría consumida en la segunda.
 */
export function responderPortada(textos: TextosPortada, imagenes: unknown[] = []) {
  const simulado = vi.fn().mockImplementation((url: unknown) =>
    Promise.resolve(String(url).includes('/portada')
      ? json({ imagenes, textos })
      : json({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } })))
  vi.stubGlobal('fetch', simulado)
  return simulado
}
```

- [ ] **Paso 1: escribir el test, que falla**

En `desamparados-web/src/features/home/__tests__/Hero.test.tsx` (si no existe, crearlo con el patrón de `ReceiptsPage.test.tsx`: `renderWithProviders` y `vi.stubGlobal('fetch', …)`):

```ts
const respuestaPortada = (textos: unknown) => vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
  Promise.resolve(new Response(JSON.stringify({ imagenes: [], textos }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }))))

it('enseña los textos que llegan del servidor', async () => {
  const textos = structuredClone(POR_DEFECTO.portada)
  textos.hero.titulo = 'Desamparados de Málaga'
  textos.hero.parrafo = 'Un párrafo distinto.'
  respuestaPortada(textos)

  renderWithProviders(<Hero />)

  expect(await screen.findByRole('heading', { name: 'Desamparados de Málaga', level: 1 })).toBeInTheDocument()
  expect(screen.getByText('Un párrafo distinto.')).toBeInTheDocument()
})

it('si la API falla, enseña los textos de siempre en vez de un hueco', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')))

  renderWithProviders(<Hero />)

  expect(await screen.findByRole('heading', { name: 'Desamparados Málaga', level: 1 })).toBeInTheDocument()
  expect(screen.getByText(/Devoción, historia y patrimonio/)).toBeInTheDocument()
})
```

Con `POR_DEFECTO` importado del fichero compartido:

```ts
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'
```

- [ ] **Paso 2: ver que falla**

```bash
cd desamparados-web && npx vitest run src/features/home/__tests__/Hero.test.tsx
```

Esperado: el primero falla («Unable to find role heading with name Desamparados de Málaga»): hoy el título está escrito a mano y no cambia con la respuesta. El segundo pasa en vacío, y se vuelve honesto en cuanto el primero se implementa.

- [ ] **Paso 3: escribir el hook**

`desamparados-web/src/features/home/useContenidoPortada.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import POR_DEFECTO from '../../../../shared/contenido-por-defecto.json'
import { getPortada, type Portada, type TextosPortada } from '../../lib/api/portada'

/** Los textos de siempre: lo que se enseña mientras carga y si la API falla. */
export const TEXTOS_POR_DEFECTO = POR_DEFECTO.portada as TextosPortada

/**
 * La consulta que comparten los seis bloques de la portada. Una sola petición
 * para toda la pantalla: react-query la deduplica por su clave, así que da
 * igual cuántos bloques la llamen.
 */
export function usePortada() {
  return useQuery<Portada>({
    queryKey: ['home', 'portada'],
    queryFn: getPortada,
    retry: false,
    staleTime: 5 * 60_000,
  })
}

/**
 * Los textos, siempre completos. Mientras carga y si la petición falla se
 * devuelven los de siempre: un bloque de la portada no puede quedarse en blanco
 * porque la API esté caída. El servidor ya mezcla lo guardado sobre estos
 * mismos valores, así que aquí no hace falta mezclar nada.
 */
export function useTextosPortada(): TextosPortada {
  const { data } = usePortada()
  return data?.textos ?? TEXTOS_POR_DEFECTO
}
```

- [ ] **Paso 4: usarlo en el hero**

En `Hero.tsx`, sustituir el `useQuery` propio por `usePortada()` y leer los textos:

```tsx
  const { data, status } = usePortada()
  const textos = data?.textos ?? TEXTOS_POR_DEFECTO
  const imagenes = status === 'pending' ? null : data && data.imagenes.length > 0 ? data.imagenes : IMAGENES_POR_DEFECTO
```

Y cambiar los cuatro literales por `textos.hero.ceja`, `textos.hero.titulo`, `textos.hero.parrafo`, `textos.hero.botonPrincipal` y `textos.hero.enlaceSecundario`. **Los `to=` de los enlaces no se tocan**: los destinos siguen en el código.

- [ ] **Paso 5: ver que pasa**

```bash
cd desamparados-web && npx vitest run src/features/home && npx tsc -b
```

- [ ] **Paso 6: comprometer**

```bash
git add desamparados-web/src/features/home
git commit -m "El hero lee sus textos del CMS, con los de siempre de respaldo"
```

---

## Tarea 8: Actualidad, Agenda y Publicaciones

Los tres bloques de sustitución directa, sin listas ni imágenes.

**Ficheros:**
- Modificar: `desamparados-web/src/features/home/FeaturedNews.tsx`
- Modificar: `desamparados-web/src/features/home/EventsAndLive.tsx`
- Modificar: `desamparados-web/src/features/home/FeaturedPublications.tsx`
- Test: los `__tests__` de cada uno en `desamparados-web/src/features/home/__tests__/`

**Interfaces:**
- Consume: `useTextosPortada`, `TEXTOS_POR_DEFECTO` (tarea 7).
- Produce: nada nuevo.

- [ ] **Paso 1: escribir un test por bloque, que fallan**

Para cada uno, con la respuesta simulada de `/portada` devolviendo textos cambiados. Ejemplo de Actualidad:

```ts
it('enseña la ceja, el título y el enlace que vienen del CMS', async () => {
  const textos = structuredClone(POR_DEFECTO.portada)
  textos.actualidad = { ceja: 'Lo último', titulo: 'Novedades', enlace: 'Ver el archivo' }
  responderPortada(textos)   // helper local que simula GET /portada y GET /news

  renderWithProviders(<FeaturedNews />)

  expect(await screen.findByText('Lo último')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Novedades' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /ver el archivo/i })).toBeInTheDocument()
})
```

El de Agenda comprueba además los dos textos del aviso de directo (`directoTitulo`, `directoTexto`); el de Publicaciones, el botón «Archivo de publicaciones» y la marca de agua.

Ojo con Agenda y Publicaciones: sus componentes hacen sus propias peticiones (eventos, publicaciones). El `fetch` simulado tiene que responder según la URL, no devolver siempre lo mismo:

```ts
vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
  const cuerpo = String(url).includes('/portada') ? { imagenes: [], textos } : { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }
  return Promise.resolve(new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } }))
}))
```

- [ ] **Paso 2: ver que fallan**

```bash
cd desamparados-web && npx vitest run src/features/home
```

Esperado: los tres nuevos fallan por no encontrar los textos cambiados.

- [ ] **Paso 3: cambiar los literales por los del documento**

En cada componente, `const textos = useTextosPortada()` y sustituir:

- `FeaturedNews.tsx`: `Actualidad` → `textos.actualidad.ceja`; `Últimas noticias` → `textos.actualidad.titulo`; `Ver todas` → `textos.actualidad.enlace`. El `<span className="home-visually-hidden">las noticias</span>` que va detrás se queda: es la aclaración para lectores de pantalla y no depende del texto visible.
- `EventsAndLive.tsx`: `Cultos`, `Agenda y Cultos`, el párrafo y `Calendario completo` → los campos de `textos.agenda`. `AvisoDirecto` recibe los dos textos por props (`titulo`, `texto`) en vez de tenerlos escritos dentro.
- `FeaturedPublications.tsx`: `Archivo de publicaciones` → `textos.publicaciones.boton`; `DESAMPARADOS` (la marca de agua) → `textos.publicaciones.marcaDeAgua`. La ceja `Publicaciones · mes año` **no se toca**: se calcula de la publicación destacada.

- [ ] **Paso 4: ver que pasan**

```bash
cd desamparados-web && npx vitest run src/features/home && npx tsc -b
```

- [ ] **Paso 5: comprometer**

```bash
git add desamparados-web/src/features/home
git commit -m "Actualidad, Agenda y Publicaciones leen sus textos del CMS"
```

---

## Tarea 9: Accesos directos

El bloque con lista: aquí se comprueba de verdad el casado por clave.

**Ficheros:**
- Modificar: `desamparados-web/src/features/home/QuickAccess.tsx:26-52,215-222`
- Test: `desamparados-web/src/features/home/__tests__/QuickAccess.test.tsx`

**Interfaces:**
- Consume: `useTextosPortada` (tarea 7).
- Produce: nada nuevo.

- [ ] **Paso 1: escribir el test, que falla**

```ts
it('enseña los textos de la placa y de cada tesela', async () => {
  const textos = structuredClone(POR_DEFECTO.portada)
  textos.accesos.placa.titulo = 'Únete a nosotros'
  textos.accesos.teselas.find((t) => t.clave === 'caridad')!.descripcion = 'Nuestra obra social'
  responderPortada(textos)

  renderWithProviders(<QuickAccess />)

  expect(await screen.findByText('Únete a nosotros')).toBeInTheDocument()
  expect(screen.getByText('Nuestra obra social')).toBeInTheDocument()
})

it('el destino de cada tesela no depende del documento', async () => {
  // Los destinos siguen en el código: el CMS cambia el rótulo, no adónde lleva.
  const textos = structuredClone(POR_DEFECTO.portada)
  textos.accesos.teselas.find((t) => t.clave === 'historia')!.titulo = 'Nuestros orígenes'
  responderPortada(textos)

  renderWithProviders(<QuickAccess />)

  const enlace = await screen.findByRole('link', { name: /nuestros orígenes/i })
  expect(enlace).toHaveAttribute('href', '/corporacion/historia')
})

it('una tesela que el documento no trae conserva su texto de siempre', async () => {
  const textos = structuredClone(POR_DEFECTO.portada)
  textos.accesos.teselas = textos.accesos.teselas.filter((t) => t.clave !== 'sede')
  responderPortada(textos)

  renderWithProviders(<QuickAccess />)

  expect(await screen.findByText('Nuestra sede')).toBeInTheDocument()
  expect(screen.getByText('Parroquia de los Pasionistas')).toBeInTheDocument()
})
```

- [ ] **Paso 2: ver que falla**

```bash
cd desamparados-web && npx vitest run src/features/home/__tests__/QuickAccess.test.tsx
```

- [ ] **Paso 3: implementar**

En `QuickAccess.tsx`, `ACCESOS` deja de llevar `title` y `description` y pasa a llevar `clave`, icono y destino. El texto sale del documento:

```tsx
// Lo que NO se edita desde el CMS: qué teselas hay, su icono, su destino y su
// orden. El documento solo pone título y descripción, casados por `clave`.
const ACCESOS: { clave: string; icon: ReactNode; href: string }[] = [
  { clave: 'sede', icon: <ChurchOutlinedIcon fontSize="inherit" />, href: '/corporacion/parroquia-pasionistas' },
  { clave: 'caridad', icon: <VolunteerActivismOutlinedIcon fontSize="inherit" />, href: '/corporacion/nuestros-fines/caridad' },
  { clave: 'historia', icon: <HistoryEduOutlinedIcon fontSize="inherit" />, href: '/corporacion/historia' },
  { clave: 'boletines', icon: <ArticleOutlinedIcon fontSize="inherit" />, href: '/publicaciones/boletines' },
]
```

Y dentro del componente:

```tsx
  const textos = useTextosPortada()
  // El servidor ya mezcla, pero un documento viejo en caché podría no traer una
  // tesela: se cae en el texto de siempre para no pintar una tesela en blanco.
  const textoDe = (clave: string) =>
    textos.accesos.teselas.find((t) => t.clave === clave)
    ?? TEXTOS_POR_DEFECTO.accesos.teselas.find((t) => t.clave === clave)!
```

`PlacaHazteHermano` recibe `textos.accesos.placa` por props en vez de leer la constante `HAZTE_HERMANO`, que se queda solo con `href`. La tesela de YouTube y la de Contacto usan `textoDe('youtube')` y `textoDe('contacto')`.

- [ ] **Paso 4: ver que pasa**

```bash
cd desamparados-web && npx vitest run src/features/home && npx tsc -b
```

- [ ] **Paso 5: comprometer**

```bash
git add desamparados-web/src/features/home/QuickAccess.tsx desamparados-web/src/features/home/__tests__
git commit -m "Accesos directos: los textos del CMS, los destinos en el código"
```

---

## Tarea 10: Sábado de Pasión, con su foto

**Ficheros:**
- Modificar: `desamparados-web/src/features/home/ProcessionScene.tsx`
- Test: `desamparados-web/src/features/home/__tests__/ProcessionScene.test.tsx`

**Interfaces:**
- Consume: `useTextosPortada` (tarea 7).
- Produce: nada nuevo.

- [ ] **Paso 1: escribir el test, que falla**

```ts
it('enseña el texto y la foto que vienen del CMS', async () => {
  const textos = structuredClone(POR_DEFECTO.portada)
  textos.sabadoDePasion.titulo = 'Una noche\ncon Ella'
  textos.sabadoDePasion.imagenUrl = '/storage/public/ab12cd34ef56ab78cd90ef12ab34cd56.webp'
  textos.sabadoDePasion.imagenAlt = 'La Virgen por la calle Larios'
  responderPortada(textos)

  renderWithProviders(<ProcessionScene />)

  const foto = await screen.findByRole('img', { name: 'La Virgen por la calle Larios' })
  expect(foto).toHaveAttribute('src', '/storage/public/ab12cd34ef56ab78cd90ef12ab34cd56.webp')
})

it('el título conserva el corte a dos líneas', async () => {
  // Hoy es un <br /> dentro del JSX. Guardado como texto solo puede ser un \n,
  // y la única forma de que se vea es white-space: pre-line.
  const textos = structuredClone(POR_DEFECTO.portada)
  responderPortada(textos)

  renderWithProviders(<ProcessionScene />)

  const titulo = await screen.findByRole('heading', { name: /camina con nosotros/i })
  expect(titulo).toHaveStyle({ whiteSpace: 'pre-line' })
  expect(titulo.textContent).toContain('\n')
})

it('con la foto de siempre mantiene los cuatro tamaños', async () => {
  // Mientras nadie suba otra, la del repositorio sigue sirviéndose con srcset:
  // sería una pena perder los cuatro tamaños sin que nadie haya cambiado nada.
  responderPortada(structuredClone(POR_DEFECTO.portada))

  renderWithProviders(<ProcessionScene />)

  const foto = await screen.findByRole('img', { name: /nazarenos/i })
  expect(foto).toHaveAttribute('srcset', expect.stringContaining('nazarenos-1920.webp'))
})

it('una foto subida se sirve sin srcset', async () => {
  const textos = structuredClone(POR_DEFECTO.portada)
  textos.sabadoDePasion.imagenUrl = '/storage/public/ab12cd34ef56ab78cd90ef12ab34cd56.webp'
  responderPortada(textos)

  renderWithProviders(<ProcessionScene />)

  const foto = await screen.findByRole('img', { name: /nazarenos/i })
  expect(foto).not.toHaveAttribute('srcset')
})
```

- [ ] **Paso 2: ver que falla**

```bash
cd desamparados-web && npx vitest run src/features/home/__tests__/ProcessionScene.test.tsx
```

- [ ] **Paso 3: implementar**

```tsx
// El srcset solo vale para la foto que viene en el repositorio, que existe en
// cuatro tamaños. Una foto subida desde el CMS es un solo fichero: darle este
// srcset pediría al navegador rutas que no existen.
const FOTO_DEL_REPOSITORIO = '/images/nazarenos-1280.webp'
const SRCSET_DEL_REPOSITORIO =
  '/images/nazarenos-1200.webp 1200w, /images/nazarenos-1280.webp 1280w, /images/nazarenos-1600.webp 1600w, /images/nazarenos-1920.webp 1920w'
```

y dentro del componente:

```tsx
  const { sabadoDePasion } = useTextosPortada()
  const esLaDelRepositorio = sabadoDePasion.imagenUrl === FOTO_DEL_REPOSITORIO

  <img
    src={sabadoDePasion.imagenUrl}
    srcSet={esLaDelRepositorio ? SRCSET_DEL_REPOSITORIO : undefined}
    sizes={esLaDelRepositorio ? '100vw' : undefined}
    alt={sabadoDePasion.imagenAlt}
    loading="lazy"
    decoding="async"
  />
```

El `<h2>` pasa a llevar `style={{ whiteSpace: 'pre-line' }}` y `{sabadoDePasion.titulo}` sin `<br />`. La ceja, el párrafo y el texto del enlace salen también del documento; el `to` no.

- [ ] **Paso 4: ver que pasa**

```bash
cd desamparados-web && npx vitest run src/features/home && npx tsc -b
```

- [ ] **Paso 5: comprometer**

```bash
git add desamparados-web/src/features/home
git commit -m "Sábado de Pasión: textos y foto editables desde el CMS"
```

---

## Tarea 11: La página del Recorrido

**Ficheros:**
- Modificar: `desamparados-web/src/features/corporation/sabado-pasion/RecorridoPage.tsx`
- Crear: `desamparados-web/src/lib/api/contenido.ts`
- Test: `desamparados-web/src/features/corporation/sabado-pasion/__tests__/RecorridoPage.test.tsx`

**Interfaces:**
- Consume: `GET /api/contenido/recorrido` (tarea 5).
- Produce: `getContenido<T>(slug)`, `guardarContenido(slug, datos)`, `type ContenidoRecorrido`.

- [ ] **Paso 1: escribir el test, que falla**

Los cuatro casos de la spec. El fichero va en `src/features/corporation/sabado-pasion/__tests__/`, así que el import de los valores por defecto sube **seis** niveles:

```ts
import POR_DEFECTO from '../../../../../../shared/contenido-por-defecto.json'

const responder = (recorrido: unknown) => vi.stubGlobal('fetch', vi.fn().mockImplementation(() =>
  Promise.resolve(new Response(JSON.stringify(recorrido), { status: 200, headers: { 'Content-Type': 'application/json' } }))))

it('enseña las paradas que vienen del CMS', async () => {
  responder({ ...POR_DEFECTO.recorrido, paradas: [{ hora: '18:15', lugar: 'Plaza nueva' }] })
  renderWithProviders(<RecorridoPage />)

  expect(await screen.findByText('Plaza nueva')).toBeInTheDocument()
  expect(screen.getByText('18:15')).toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})

it('enseña el plano cuando lo hay', async () => {
  responder({
    ...POR_DEFECTO.recorrido,
    plano: { url: '/storage/public/ab12cd34ef56ab78cd90ef12ab34cd56.webp', alt: 'Plano del recorrido' },
  })
  renderWithProviders(<RecorridoPage />)

  expect(await screen.findByRole('img', { name: 'Plano del recorrido' })).toBeInTheDocument()
  expect(screen.getByText('Plaza de la Marina')).toBeInTheDocument()
})

it('sin paradas no pinta ni la rejilla ni su título', async () => {
  responder({ ...POR_DEFECTO.recorrido, paradas: [] })
  renderWithProviders(<RecorridoPage />)

  expect(await screen.findByRole('heading', { name: 'Recorrido' })).toBeInTheDocument()
  expect(screen.queryByText('Itinerario y horarios aproximados')).not.toBeInTheDocument()
})

it('sin plano ni paradas quedan la cabecera y la introducción', async () => {
  responder({ ...POR_DEFECTO.recorrido, paradas: [], plano: { url: '', alt: '' } })
  renderWithProviders(<RecorridoPage />)

  expect(await screen.findByRole('heading', { name: 'Recorrido' })).toBeInTheDocument()
  expect(screen.getByText(/El itinerario de la procesión/)).toBeInTheDocument()
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})

it('si la API falla, enseña el itinerario de siempre', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')))
  renderWithProviders(<RecorridoPage />)

  expect(await screen.findByText('Salida desde la Parroquia de los Desamparados')).toBeInTheDocument()
})
```

- [ ] **Paso 2: ver que falla**

```bash
cd desamparados-web && npx vitest run src/features/corporation
```

- [ ] **Paso 3: escribir el cliente**

`desamparados-web/src/lib/api/contenido.ts`:

```ts
import { apiFetch } from './client'

export interface ParadaRecorrido { hora: string; lugar: string }

export interface ContenidoRecorrido {
  titulo: string
  subtitulo: string
  introduccion: string
  tituloItinerario: string
  plano: { url: string; alt: string }
  paradas: ParadaRecorrido[]
}

/** El contenido de una página, ya mezclado por el servidor. Se lee sin sesión. */
export const getContenido = <T,>(slug: 'portada' | 'recorrido') => apiFetch<T>(`/contenido/${slug}`)

/** Sustituye el documento entero (CMS). */
export const guardarContenido = (slug: 'portada' | 'recorrido', datos: unknown) =>
  apiFetch<{ message: string; data: unknown }>(`/contenido/${slug}`, { method: 'PUT', json: { datos } })
```

- [ ] **Paso 4: implementar la página**

`RecorridoPage.tsx` sustituye el array literal `itinerary` por:

```tsx
  const { data } = useQuery({
    queryKey: ['contenido', 'recorrido'],
    queryFn: () => getContenido<ContenidoRecorrido>('recorrido'),
    retry: false,
    staleTime: 5 * 60_000,
  })
  // Mientras carga y si falla, el itinerario de siempre: esta página es
  // información práctica y un hueco es peor que un dato de hace un año.
  const recorrido = data ?? (POR_DEFECTO.recorrido as ContenidoRecorrido)
```

El `PageHeader` usa `recorrido.titulo` y `recorrido.subtitulo`; la introducción, `recorrido.introduccion`. Después:

```tsx
  {recorrido.plano.url && (
    <Box sx={{ maxWidth: 900, mx: 'auto', mb: 6 }}>
      <Box component="img" src={recorrido.plano.url} alt={recorrido.plano.alt}
        sx={{ width: '100%', height: 'auto', borderRadius: '8px' }} loading="lazy" decoding="async" />
    </Box>
  )}

  {recorrido.paradas.length > 0 && (
    <>
      <SectionTitle title={recorrido.tituloItinerario} centered />
      <Grid container spacing={2}>
        {recorrido.paradas.map((parada, i) => (
          <Grid key={`${parada.hora}-${parada.lugar}-${i}`} size={{ xs: 12, md: 6 }}>
            {/* … la GlassCard de hoy, con parada.hora y parada.lugar … */}
          </Grid>
        ))}
      </Grid>
    </>
  )}
```

Ojo con la `key`: hoy es `item.place`, y el itinerario **repite** «Plaza de la Constitución» (pasa dos veces). Con claves repetidas React se lía al reordenar desde el CMS; de ahí el índice en la clave.

- [ ] **Paso 5: ver que pasa**

```bash
cd desamparados-web && npx vitest run src/features/corporation && npx tsc -b
```

- [ ] **Paso 6: comprometer**

```bash
git add desamparados-web/src
git commit -m "El recorrido lee su itinerario y su plano del CMS"
```

---

## Tarea 12: Las dos piezas de las pantallas del CMS

Se sacan aparte porque las usan las dos pantallas y porque así se prueban solas.

**Ficheros:**
- Crear: `desamparados-web/src/features/cms/contenido/SeccionPlegable.tsx`
- Crear: `desamparados-web/src/features/cms/contenido/CampoTexto.tsx`
- Test: `desamparados-web/src/features/cms/contenido/__tests__/SeccionPlegable.test.tsx`

**Interfaces:**
- Produce:
  - `SeccionPlegable({ titulo, abiertaPorDefecto?, children })`
  - `CampoTexto({ etiqueta, valor, onCambio, ayuda, maxLength, multilinea? })`

- [ ] **Paso 1: escribir el test, que falla**

```tsx
describe('SeccionPlegable', () => {
  it('empieza cerrada y se abre al pulsar el título', async () => {
    const usuario = userEvent.setup({ delay: null })
    render(<SeccionPlegable titulo="Actualidad"><p>contenido</p></SeccionPlegable>)

    expect(screen.queryByText('contenido')).not.toBeVisible()
    await usuario.click(screen.getByRole('button', { name: /actualidad/i }))
    expect(screen.getByText('contenido')).toBeVisible()
  })

  it('la que se marca como abierta empieza abierta', () => {
    render(<SeccionPlegable titulo="Cabecera" abiertaPorDefecto><p>contenido</p></SeccionPlegable>)
    expect(screen.getByText('contenido')).toBeVisible()
  })

  it('dice si está abierta o cerrada para quien no la ve', () => {
    render(<SeccionPlegable titulo="Actualidad"><p>contenido</p></SeccionPlegable>)
    expect(screen.getByRole('button', { name: /actualidad/i })).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('CampoTexto', () => {
  it('explica dónde sale en la web', () => {
    render(<CampoTexto etiqueta="Antetítulo" valor="Cultos" onCambio={() => {}}
      ayuda="El texto pequeño en versalitas, encima del título del bloque." maxLength={60} />)

    expect(screen.getByText(/versalitas/i)).toBeInTheDocument()
  })
})
```

`delay: null` en `userEvent.setup` no es un detalle: sin él, los tests que teclean se acercan al tope de 5 s y caen de forma intermitente cuando la batería entera compite por la CPU.

- [ ] **Paso 2: ver que falla**

```bash
cd desamparados-web && npx vitest run src/features/cms/contenido
```

- [ ] **Paso 3: implementar**

`desamparados-web/src/features/cms/contenido/SeccionPlegable.tsx`:

```tsx
import type { ReactNode } from 'react'
import { Accordion, AccordionDetails, AccordionSummary, Stack, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

/**
 * Un bloque de la portada dentro de la pantalla de edición. Van plegados
 * porque son seis y unos treinta campos: abiertos de golpe, encontrar el texto
 * que se viene a cambiar exige recorrer la pantalla entera.
 *
 * El `Accordion` de MUI ya pone `aria-expanded` en el botón del resumen, así
 * que quien no ve la pantalla sabe si la sección está abierta.
 */
export default function SeccionPlegable(
  { titulo, abiertaPorDefecto = false, children }:
  { titulo: string; abiertaPorDefecto?: boolean; children: ReactNode },
) {
  return (
    <Accordion defaultExpanded={abiertaPorDefecto} disableGutters variant="outlined" sx={{ mb: 1.5 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography sx={{ fontWeight: 600 }}>{titulo}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2.5} sx={{ pt: 1 }}>{children}</Stack>
      </AccordionDetails>
    </Accordion>
  )
}
```

`desamparados-web/src/features/cms/contenido/CampoTexto.tsx`:

```tsx
import { TextField } from '@mui/material'

/**
 * Un texto de la web pública.
 *
 * `ayuda` no es opcional a propósito: dice DÓNDE sale el campo en la página.
 * Sin eso, «antetítulo» o «ceja» no significan nada para quien no ha hecho el
 * diseño, y la pantalla se vuelve adivinanza.
 *
 * `maxLength` repite el tope del esquema del backend para avisar mientras se
 * escribe en vez de con un 400 al guardar.
 */
export default function CampoTexto({
  etiqueta, valor, onCambio, ayuda, maxLength, multilinea = false,
}: {
  etiqueta: string
  valor: string
  onCambio: (valor: string) => void
  ayuda: string
  maxLength: number
  multilinea?: boolean
}) {
  return (
    <TextField
      label={etiqueta}
      value={valor}
      onChange={(e) => onCambio(e.target.value)}
      helperText={ayuda}
      slotProps={{ htmlInput: { maxLength } }}
      multiline={multilinea}
      minRows={multilinea ? 3 : undefined}
      size="small"
      fullWidth
    />
  )
}
```

- [ ] **Paso 4: ver que pasa y comprometer**

```bash
cd desamparados-web && npx vitest run src/features/cms/contenido && npx tsc -b
git add desamparados-web/src/features/cms/contenido
git commit -m "Sección plegable y campo de texto para las pantallas de contenido"
```

---

## Tarea 13: `/cms/portada`, la portada entera

**Ficheros:**
- Reescribir: `desamparados-web/src/features/cms/PortadaAdminPage.tsx`
- Test: `desamparados-web/src/features/cms/__tests__/PortadaAdminPage.test.tsx`

**Interfaces:**
- Consume: `getPortada`, `guardarImagenesPortada` (tarea 6); `guardarContenido` (tarea 11); `SeccionPlegable`, `CampoTexto` (tarea 12).
- Produce: nada nuevo.

- [ ] **Paso 0: el ayudante de esta pantalla**

En el propio fichero de tests. Registra cada petición para poder afirmar **a qué rutas** fue el guardado, que es lo que distingue «guardó las dos cosas» de «guardó una»:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { crearTemaCms } from '../../../theme/cms'
import POR_DEFECTO from '../../../../../shared/contenido-por-defecto.json'
import PortadaAdminPage from '../PortadaAdminPage'

interface Peticion { url: string; metodo: string }

/**
 * @param fallaEn ruta cuyo PUT debe responder 500, para probar el guardado a medias.
 */
function montar({ fallaEn }: { fallaEn?: string } = {}) {
  const registradas: Peticion[] = []
  const textos = structuredClone(POR_DEFECTO.portada)
  // Una foto, no cero: con la lista vacía no se pinta ninguna fila de foto y el
  // test del guardado a medias no tendría dónde tocar una foto, que es lo que
  // hace falta para que se lancen las DOS peticiones.
  const imagenes = [{ id: 1, url: '/storage/public/portada/hero-1.webp', descripcion: 'Foto de prueba', orden: 0 }]

  vi.stubGlobal('fetch', vi.fn().mockImplementation((url: unknown, opciones?: RequestInit) => {
    const ruta = String(url)
    const metodo = opciones?.method ?? 'GET'
    registradas.push({ url: ruta, metodo })

    if (metodo === 'PUT' && fallaEn && ruta.includes(fallaEn)) {
      return Promise.resolve(new Response(JSON.stringify({ error: 'Fallo del servidor' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }))
    }
    const cuerpo = metodo === 'GET' ? { imagenes, textos } : { message: 'ok', data: {} }
    return Promise.resolve(new Response(JSON.stringify(cuerpo),
      { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }))

  const router = createMemoryRouter(
    [{ path: '/cms/portada', element: <PortadaAdminPage /> }, { path: '/cms', element: <h1>Inicio</h1> }],
    { initialEntries: ['/cms/portada'] },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })

  render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={crearTemaCms('claro')}><RouterProvider router={router} /></ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  )

  return { peticiones: () => registradas, usuario: userEvent.setup({ delay: null }) }
}

afterEach(() => { vi.unstubAllGlobals() })
```

El test del guardado a medias se monta con `montar({ fallaEn: '/contenido/portada' })`.

- [ ] **Paso 1: escribir los tests, que fallan**

Los que ya hay sobre las fotos siguen valiendo (cambiando la respuesta simulada a `{ imagenes, textos }`). Los nuevos:

```tsx
it('carga los textos de cada bloque en su sección', async () => {
  montar()
  await screen.findByRole('button', { name: /cabecera/i })

  expect(screen.getByRole('button', { name: /sábado de pasión/i })).toBeInTheDocument()
  expect(screen.getByDisplayValue('Desamparados Málaga')).toBeInTheDocument()
})

it('guarda las fotos y los textos, cada uno a su sitio', async () => {
  const { peticiones } = montar()
  const usuario = userEvent.setup({ delay: null })

  const titulo = await screen.findByDisplayValue('Desamparados Málaga')
  await usuario.clear(titulo)
  await usuario.type(titulo, 'Desamparados de Málaga')
  await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
  await usuario.click(screen.getByRole('button', { name: /guardar cambios/i }))

  await waitFor(() => {
    expect(peticiones()).toContainEqual(expect.objectContaining({ url: '/api/portada/imagenes', metodo: 'PUT' }))
    expect(peticiones()).toContainEqual(expect.objectContaining({ url: '/api/contenido/portada', metodo: 'PUT' }))
  })
})

it('si fallan los textos después de guardar las fotos, lo dice', async () => {
  // Son dos almacenes y dos peticiones: el botón no puede decir «guardado» si
  // la segunda ha fallado. Es la mentira más fácil de escribir aquí.
  const { usuario } = montar({ fallaEn: '/contenido/portada' })

  // Se tocan las DOS cosas: una foto y un texto. Con solo el texto, el mensaje
  // correcto sería otro (no se guardó nada), y el test no probaría este caso.
  const titulo = await screen.findByDisplayValue('Desamparados Málaga')
  await usuario.clear(titulo)
  await usuario.type(titulo, 'Otro título')
  await usuario.type(screen.getByLabelText(/descripción para lectores de pantalla/i), 'x')

  await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
  await usuario.click(screen.getByRole('button', { name: /guardar cambios/i }))

  const aviso = await screen.findByRole('alert')
  expect(aviso).toHaveTextContent(/fotos se han guardado/i)
  expect(aviso).toHaveTextContent(/textos no/i)
})
```

- [ ] **Paso 2: ver que fallan**

```bash
cd desamparados-web && npx vitest run src/features/cms/__tests__/PortadaAdminPage.test.tsx
```

- [ ] **Paso 3: implementar**

Estructura de la pantalla, dentro del `PantallaEdicion` que ya usa:

```tsx
<SeccionPlegable titulo="Cabecera" abiertaPorDefecto>
  <CampoTexto etiqueta="Antetítulo" valor={t.hero.ceja} onCambio={…} maxLength={60}
    ayuda="El texto pequeño en versalitas, sobre el título grande." />
  <CampoTexto etiqueta="Título" valor={t.hero.titulo} onCambio={…} maxLength={120}
    ayuda="El titular grande de la primera pantalla." />
  <CampoTexto etiqueta="Texto" valor={t.hero.parrafo} onCambio={…} maxLength={600} multilinea
    ayuda="El párrafo bajo el título." />
  <CampoTexto etiqueta="Botón principal" valor={t.hero.botonPrincipal} onCambio={…} maxLength={60}
    ayuda="El botón claro. Sigue llevando a la página del Grupo Parroquial." />
  <CampoTexto etiqueta="Enlace secundario" valor={t.hero.enlaceSecundario} onCambio={…} maxLength={60}
    ayuda="El enlace de al lado. Sigue llevando a la agenda." />
  {/* Debajo, las fotos: el bloque de filas que esta pantalla ya tiene hoy. */}
</SeccionPlegable>
```

Las otras cinco secciones se montan igual, un `CampoTexto` por campo. **Los campos exactos de cada bloque están en la §6 de la spec**, que es la lista completa y la única fuente de verdad; recorrerla de arriba abajo:

| Sección | Campos (`maxLength`) |
|---|---|
| Actualidad | ceja (60), titulo (120), enlace (60) |
| Agenda y Cultos | ceja (60), titulo (120), parrafo (600, multilínea), enlace (60), directoTitulo (60), directoTexto (60) |
| Accesos directos | placa: ceja (60), titulo (120), texto (600, multilínea), boton (60); y por cada tesela: titulo (120) y descripcion (600) |
| Sábado de Pasión | ceja (60), titulo (120, **multilínea**: el salto de línea es parte del diseño), parrafo (600, multilínea), enlace (60), `CampoImagen apaisada` para `imagenUrl`, y `CampoTexto` de 200 para `imagenAlt` |
| Publicaciones | boton (60), marcaDeAgua (60) |

En «Accesos directos», las seis teselas se pintan recorriendo `textos.accesos.teselas` **en el orden en que llegan**, cada una bajo un rótulo con su nombre actual; **no** se puede añadir, quitar ni reordenar ninguna, porque el destino y el icono los pone el código.

El campo de la foto lleva de ayuda: «JPG, PNG o WebP apaisado, de al menos 1920 píxeles de ancho y hasta 5 MB. Ocupa el fondo del bloque a todo lo ancho.»

El guardado encadena las dos peticiones y es honesto con el resultado:

```tsx
const guardar = async () => {
  setGuardando(true); setError(null); setGuardado(false)
  try {
    // Primero las fotos: si fallan, no se ha tocado nada.
    if (fotosSucias) await guardarImagenesPortada(sinClave(filas))
    if (textosSucios) await guardarContenido('portada', textos)
    setGuardado(true)
    void queryClient.invalidateQueries({ queryKey: ['home', 'portada'] })
  } catch (e: unknown) {
    // Si el fallo llega en la segunda, las fotos YA están guardadas: decirlo,
    // o quien lo lea creerá que no se ha guardado nada y lo repetirá todo.
    setError(fotosSucias && textosSucios
      ? 'Las fotos se han guardado, pero los textos no. Vuelve a intentarlo.'
      : e instanceof Error ? e.message : 'No se ha podido guardar.')
  } finally { setGuardando(false) }
}
```

El `sucio` de `PantallaEdicion` pasa a ser `fotosSucias || textosSucios`.

- [ ] **Paso 4: ver que pasan y comprometer**

```bash
cd desamparados-web && npx vitest run src/features/cms && npx tsc -b
git add desamparados-web/src/features/cms/PortadaAdminPage.tsx desamparados-web/src/features/cms/__tests__
git commit -m "El CMS edita los textos de los seis bloques de la portada"
```

---

## Tarea 14: `/cms/recorrido`

**Ficheros:**
- Crear: `desamparados-web/src/features/cms/RecorridoAdminPage.tsx`
- Modificar: `desamparados-web/src/app/cmsNavegacion.ts`
- Modificar: `desamparados-web/src/routes/index.tsx`
- Test: `desamparados-web/src/features/cms/__tests__/RecorridoAdminPage.test.tsx`

**Interfaces:**
- Consume: `getContenido`, `guardarContenido` (tarea 11); `SeccionPlegable`, `CampoTexto` (tarea 12); `CampoImagen` (ya existe).
- Produce: entrada `recorrido` en `itemsMenu` y en `rolesPorRutaCms`; ruta `/cms/recorrido`.

- [ ] **Paso 1: escribir los tests, que fallan**

`montar` es el mismo ayudante de la tarea 13, copiado a este fichero y cambiando dos cosas: monta `<RecorridoAdminPage />` en `/cms/recorrido`, y el `GET` responde `POR_DEFECTO.recorrido` en vez de `{ imagenes, textos }`. `montarConPlanoSinAlt()` es `montar()` con un `GET` que devuelve `{ ...POR_DEFECTO.recorrido, plano: { url: '/storage/public/ab12cd34ef56ab78cd90ef12ab34cd56.webp', alt: '' } }`.

```tsx
it('carga las paradas de siempre', async () => {
  montar()
  expect(await screen.findByDisplayValue('Plaza de la Marina')).toBeInTheDocument()
  expect(screen.getAllByLabelText(/^hora/i)).toHaveLength(9)
})

it('añade una parada al final', async () => {
  montar()
  const usuario = userEvent.setup({ delay: null })
  await screen.findByDisplayValue('Plaza de la Marina')

  await usuario.click(screen.getByRole('button', { name: /añadir parada/i }))

  expect(screen.getAllByLabelText(/^hora/i)).toHaveLength(10)
})

it('quita una parada', async () => {
  montar()
  const usuario = userEvent.setup({ delay: null })
  await screen.findByDisplayValue('Plaza de la Marina')

  await usuario.click(screen.getByRole('button', { name: /quitar la parada 4/i }))

  expect(screen.queryByDisplayValue('Plaza de la Marina')).not.toBeInTheDocument()
  expect(screen.getAllByLabelText(/^hora/i)).toHaveLength(8)
})

it('sube una parada de sitio', async () => {
  montar()
  const usuario = userEvent.setup({ delay: null })
  await screen.findByDisplayValue('Plaza de la Marina')

  await usuario.click(screen.getByRole('button', { name: /subir la parada 2/i }))

  const lugares = screen.getAllByLabelText(/^lugar/i) as HTMLInputElement[]
  expect(lugares[0].value).toBe('Plaza de la Constitución')
})

it('no deja guardar un plano sin descripción', async () => {
  // El servidor también lo rechaza; aquí se avisa antes de enviar.
  const { usuario } = await montarConPlanoSinAlt()
  await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

  expect(await screen.findByText(/descripción/i)).toBeInTheDocument()
})

it('guarda el documento entero', async () => {
  const { peticiones } = montar()
  const usuario = userEvent.setup({ delay: null })
  await screen.findByDisplayValue('Plaza de la Marina')

  await usuario.click(screen.getByRole('button', { name: 'Guardar' }))
  await usuario.click(screen.getByRole('button', { name: /guardar cambios/i }))

  await waitFor(() => expect(peticiones()).toContainEqual(
    expect.objectContaining({ url: '/api/contenido/recorrido', metodo: 'PUT' })))
})
```

- [ ] **Paso 2: ver que fallan**

```bash
cd desamparados-web && npx vitest run src/features/cms/__tests__/RecorridoAdminPage.test.tsx
```

- [ ] **Paso 3: implementar la pantalla**

Mismo esqueleto que `PortadaAdminPage`: `PantallaEdicion` con `titulo="Recorrido"`, `volverA="/cms"`, y dentro:

- Sección **Cabecera** (abierta): título, subtítulo, introducción, título del itinerario.
- Sección **Plano** : `CampoImagen apaisada` + `CampoTexto` de descripción, con la ayuda «Qué se ve en el plano, en una frase. Es lo que oye quien usa un lector de pantalla».
- Sección **Paradas** (abierta): una fila por parada con `TextField` de hora (`type="time"`), `TextField` de lugar y los tres botones —subir, bajar, quitar— con `aria-label` que incluya el número («Subir la parada 2»). Al final, «Añadir parada».

Las filas llevan una **clave propia del CMS** (un contador, como `Fila.clave` en `PortadaAdminPage`), no el índice ni la hora: dos paradas pueden tener la misma hora y el mismo lugar, y con claves repetidas React se lía al reordenar.

- [ ] **Paso 4: darla de alta en el menú y en las rutas**

En `src/app/cmsNavegacion.ts`, dentro de `itemsMenu`, justo detrás de Portada:

```ts
  { label: 'Recorrido', href: '/cms/recorrido', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'], grupo: 'Contenido', icono: MapOutlinedIcon },
```

(importando `MapOutlinedIcon` de `@mui/icons-material/MapOutlined`), y en `rolesPorRutaCms`:

```ts
  recorrido: ['ADMIN', 'REDES', 'HERMANO_MAYOR'],
```

Las dos a la vez: `AdminLayout.test.tsx` las compara y falla si divergen. Y en `src/routes/index.tsx`, junto a la de portada:

```tsx
{ path: 'recorrido', element: <RequireRole roles={rolesPorRutaCms.recorrido}>{withSuspense(RecorridoAdminPage)}</RequireRole> },
```

- [ ] **Paso 5: ver que pasa la batería entera**

```bash
cd desamparados-web && npx vitest run && npx tsc -b && npm run lint
```

Esperado: todo en verde; en lint, solo el aviso de siempre de `temaCms.tsx`.

- [ ] **Paso 6: comprometer**

```bash
git add desamparados-web/src
git commit -m "Pantalla del CMS para el recorrido, con su plano y sus paradas"
```

---

## Tarea 15: Comprobación final en el navegador

Los tests no ven una portada de verdad. Esto sí, y es lo que decide si el trabajo está hecho.

**Ficheros:** ninguno (salvo lo que haya que arreglar).

- [ ] **Paso 1: levantar todo**

```bash
docker start desamparados-mariadb
cd backend-desamparados && npx prisma migrate deploy && npm run seed && npx tsx src/index.ts > /tmp/backend.log 2>&1 &
cd desamparados-web && npx vite --port 5173 --strictPort > /tmp/front.log 2>&1 &
```

- [ ] **Paso 2: editar y ver**

Entrar en `/cms/acceso` con una cuenta ADMIN. En `/cms/portada`, cambiar **un texto de cada uno de los seis bloques** y subir otra foto en «Sábado de Pasión». Guardar. Abrir `/` y comprobar que los seis cambios están y que la foto es la nueva. Repetir en `/cms/recorrido`: cambiar una parada, subir un plano, guardar, y mirar `/corporacion/sabado-de-pasion/recorrido`.

- [ ] **Paso 3: mirarlo a 390 px**

Con el script de capturas de `capturas-playwright-local`: la portada y el recorrido a 390 y 1440 px. Comprobar que `document.documentElement.scrollWidth === clientWidth` en los dos anchos (nada se sale) y que la consola no tiene errores.

- [ ] **Paso 4: el huérfano que no lo es**

```bash
cd backend-desamparados && npm run limpiar:huerfanos
```

La foto recién subida a «Sábado de Pasión» y el plano del recorrido **no** pueden salir en la lista de huérfanos. Si salen, la tarea 4 está mal y hay que volver a ella antes de seguir.

- [ ] **Paso 5: las dos baterías completas**

```bash
cd backend-desamparados && npx tsc --noEmit && npm test
cd ../desamparados-web && npx tsc -b && npx vitest run && npm run lint
```

Esperado: backend con **0 omitidos** (si hay omisiones, MariaDB no estaba levantada y la batería miente); frontend en verde.

- [ ] **Paso 6: dejar constancia**

Escribir el traspaso del día en `docs/traspaso-2026-09-15.md` siguiendo el formato de los anteriores, y comprometerlo.

---

## Cómo se ejecuta

Las tareas van **en orden**. Tres dependencias que no se pueden saltar:

- La **4 antes que la 5**: si el guardado llega antes que el limpiador, hay una ventana en la que guardar la portada borra una foto publicada.
- La **1 antes que todas**: los valores por defecto y la mezcla los usan el backend, el frontend y los tests.
- La **6 antes que la 7-10**: hasta que `GET /api/portada` devuelve textos, los bloques no tienen de dónde leerlos.

Las tareas 7 a 11 son independientes entre sí una vez hecha la 6, y pueden repartirse.
