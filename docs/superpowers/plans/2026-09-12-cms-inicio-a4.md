# Inicio del CMS A4: tema claro/oscuro y «Cómo va el año» — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el panel informativo de `/cms` en un Inicio que dice qué hay que hacer hoy, con tema claro/oscuro conmutable, menú agrupado con avisos y una sección «Cómo va el año» de siete gráficas con selector de ejercicio.

**Architecture:** El backend amplía `GET /api/panel` con un parámetro `?anio=` validado en una función pura (`domain/panel-ejercicio.ts`) y añade cuatro datos que hoy no salen (movimientos mensuales, importe por categoría, recibos del ejercicio y un registro de actividad de contenido), sin salirse de la regla de oro del servicio (`count`, `groupBy` y `aggregate`). El frontend sustituye el tema fijo del CMS por `crearTemaCms(modo)` gobernado por un contexto en `app/temaCms.tsx` que recuerda la elección en `localStorage`; `PanelPage.tsx` se reescribe como Inicio y se parte en `features/cms/inicio/`, con las reglas de «Para hoy» en un módulo sin JSX (`tareas.ts`) y las gráficas en SVG propio dentro de `components/charts/`.

**Tech Stack:** Express + Prisma + MariaDB + `node:test` (backend); React 19 + MUI 9 + TanStack Query + Vitest + Testing Library (frontend).

**Spec:** `docs/superpowers/specs/2026-09-12-cms-inicio-a4-design.md`

**Lienzo de referencia:** `docs/superpowers/specs/2026-09-12-cms-inicio-a4/build-a4.mjs`, que genera las tres pantallas de A4 (la de Hermano Mayor en oscuro, la misma en claro y la de Redes) y donde viven **las variables CSS de los dos temas, la geometría exacta de cada gráfica y los textos del diseño**. Es la fuente a consultar cuando el plan diga «como en el lienzo». Se ejecuta con `node build-a4.mjs` y escribe los `.dc.html` a su lado; para verlos renderizados hace falta el canvas del artifact `https://claude.ai/code/artifact/af1ee0d5-f8c5-4028-bf99-d86927349190` (skill `design`).

**Dos avisos sobre el lienzo:** dibuja un buscador «Ctrl K» en la barra lateral que **no** entra en este plan (la spec lo deja para después), y usa «Hermandad» donde el proyecto exige «Grupo Parroquial» (ver la primera restricción global).

## Cómo arrancar (decidido el 12-09-2026)

El usuario eligió ejecutarlo **por subagentes, en una sesión aparte**. Al retomar:

1. Leer la spec entera y este plan.
2. Invocar `superpowers:subagent-driven-development`: un subagente por tarea, revisión entre una y otra.
3. Trabajar sobre la rama `spec-cms-inicio-a4`, que ya lleva la spec y este plan y tiene abierta la PR #7.
4. Las tareas 7, 8 y 9 dejan el proyecto sin compilar a propósito y se confirman todas juntas con la 10; está avisado en cada una.

## Global Constraints

- **Nomenclatura:** la corporación es **«Grupo Parroquial»**, nunca «Hermandad» ni «Cofradía». Los miembros sí son «hermanos». Aplica a todo texto visible. **El lienzo incumple esta regla en dos sitios** (el grupo «Hermandad» del menú y el antetítulo «La hermandad en datos»): en el código van **«Censo y enseres»** y **«El Grupo Parroquial en datos»**.
- **Regla de oro de `panel.service.ts`:** solo `count`, `groupBy` y `aggregate`. Prohibido `findMany` sobre `Hermano` y sobre `User`. Excepciones documentadas: `Evento` (actos públicos), `CategoriaTransaccion` (catálogo) y, nueva en este plan, `AuditLog` acotado a acciones de contenido y seleccionando solo `role` del usuario, nunca su nombre ni su correo.
- **El Inicio es solo agregados.** Ninguna cifra, texto ni tabla puede identificar a una persona. El test `test/panel-servicio.test.ts` («no devuelve ningún dato personal») recorre el JSON entero buscando claves y valores prohibidos: cualquier campo nuevo tiene que pasarlo.
- **Cero dependencias nuevas.** Nada de librerías de gráficos: `vite.config.ts` manda todo `@mui/*` a `vendor-mui`, que descarga también el visitante de la web pública. Las siete gráficas son SVG escrito a mano.
- **La web pública no se toca.** El tema del CMS va anidado dentro de `AdminLayout`, que solo envuelve las rutas `/cms`.
- **No cambia quién entra a qué.** `rolesPorRutaCms` y las guardas de `routes/index.tsx` se quedan exactamente como están; el test que compara menú y guardas tiene que seguir en verde.
- **Imports del backend con extensión `.js`** (ESM), como el resto del proyecto.
- **Paleta validada, no improvisada.** Entrada (ingresos, altas) `#2a78d6` en claro y `#3987e5` en oscuro; salida (gastos, bajas) `#b0414a` en los dos; estados ok `#1baf7a`, aviso `#eda100`, error `#e34948`. El año elegido va en tinta (`#1b1c1a` en claro, `#ffffff` en oscuro) y el contexto en gris.
- **El color nunca es el único portador del dato:** todo valor con color lleva etiqueta de texto o número visible. El verde y el ámbar no llegan a 3:1 sobre fondo claro.
- **Tras cada `git pull`,** `npx prisma generate` en el backend antes del typecheck.
- Tests backend: `npm test` en `backend-desamparados/`. Tests frontend: `npm test` en `desamparados-web/`. Typecheck frontend: `npx tsc -b`. Lint: `npm run lint`.
- **Commits en español**, en imperativo y explicando el porqué, como el resto del historial. Todos terminan con las dos líneas de atribución (`Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` y `Claude-Session: https://claude.ai/code/session_014uMcZX44gkBHP7fAaSzhvp`).

## Decisiones que la spec deja abiertas y aquí se cierran

Las cuatro salen de leer el código y no cambian nada de lo acordado; se anotan para que el que ejecute no tenga que decidir sobre la marcha.

1. **Papeletas por año.** La spec no incluye `procesion.porAnio` entre lo que acota el ejercicio, pero la gráfica pide «el ejercicio elegido destacado». Si se deja como hoy (los cinco últimos años absolutos), al elegir 2021 no se destacaría nada. Se acota a **los cinco años hasta el elegido** (`where: { year: { lte: anio } }` y `slice(-5)`), que es lo único que cumple las dos frases a la vez.
2. **Actividad sin títulos.** El contrato de `actividad.registro` de la spec (§8.5) tiene cuatro campos y ninguno es el título de la noticia o del acto. Se cumple al pie: la frase se construye con la acción y el tipo de entidad («Redes publicó una noticia»), no se consulta `detalles` ni se hace una segunda consulta para resolver títulos. Así el registro no puede filtrar nada y el servicio se queda en una consulta más.
3. **Citas de reparto sin botón.** El CMS no tiene todavía pantalla de turnos de reparto (no hay ruta ni componente), así que ese asunto de «Para hoy» se enseña sin botón de acción para todo el mundo. Además, `/api/panel` no distingue las citas «de mañana»: devuelve `citasReservadas` y `turnosProximos`, y el texto dice eso mismo.
4. **Contadores del menú.** `AdminLayout` consulta el mismo `GET /api/panel` que el Inicio, con la clave `['panel', 'hoy']` y `staleTime` de cinco minutos: en el Inicio no añade ninguna petición y en las demás pantallas del CMS añade una cada cinco minutos. Si la consulta falla, el menú se pinta sin contadores y no revienta.

## Estructura de ficheros

**Backend (`backend-desamparados/`)**

| Fichero | Responsabilidad |
|---|---|
| `src/domain/panel-ejercicio.ts` (nuevo) | Funciones puras: validar `?anio=`, meses que enseña el ejercicio, meses que hay que recorrer para reconstruir el censo y rangos de fechas |
| `test/panel-ejercicio.test.ts` (nuevo) | Pruebas de las anteriores, sin base de datos |
| `src/services/panel.service.ts` (modificar) | `getPanel(anio?)`, los cinco cambios de la spec §8 y el contrato `PanelResponse` |
| `src/controllers/panel.controller.ts` (modificar) | Pasar `req.query.anio` al servicio |
| `test/panel-servicio.test.ts` (modificar) | Casos del ejercicio y de los campos nuevos |
| `test/panel-acceso.test.ts` (modificar) | El 400 con un año inválido |

`src/routes/panel.routes.ts` **no se toca**: los seis roles ya pasan.

**Frontend (`desamparados-web/`)**

| Fichero | Responsabilidad |
|---|---|
| `src/theme/cms.ts` (reescribir) | `crearTemaCms(modo)`, `superficiesCms(modo)` y `graficasCms(modo)`; el tema deja de ser una constante |
| `src/app/temaCms.tsx` (nuevo) | Contexto del modo, lectura y escritura en `localStorage`, `ThemeProvider` |
| `src/app/cmsNavegacion.ts` (modificar) | Los mismos ítems con `grupo`, icono y de dónde sale su contador |
| `src/app/usePanelDeHoy.ts` (nuevo) | La consulta compartida `['panel', 'hoy']` |
| `src/app/AdminLayout.tsx` (reescribir) | Menú agrupado, contadores, interruptor de tema, bloque de usuario |
| `src/domain/sabadoDePasion.ts` (nuevo) | Pascua (Meeus/Butcher), fecha de la estación y cuenta atrás |
| `src/lib/api/panel.ts` (modificar) | Tipos nuevos y `getPanel(anio?)` |
| `src/components/charts/LineaTemporal.tsx` (reescribir) | Línea con área, eje de tres marcas y primer y último valor escritos |
| `src/components/charts/BarrasHorizontales.tsx` (modificar) | Color y formato de valor por props |
| `src/components/charts/ColumnasDivergentes.tsx` (nuevo) | Altas y bajas a ambos lados del cero |
| `src/components/charts/ColumnasPorPares.tsx` (nuevo) | Ingresos y gastos por mes, con detalle al pasar el ratón |
| `src/components/charts/ColumnasPorAnio.tsx` (nuevo) | Papeletas de cinco años, con el elegido destacado |
| `src/components/charts/ProporcionEstados.tsx` (nuevo) | Porcentaje cobrado, barra de proporción y tabla de estados |
| `src/components/charts/TablaDeDatos.tsx` (nuevo) | El «Ver tabla» de cada gráfica |
| `src/components/charts/BarraEstados.tsx` (borrar) | Lo sustituye `ProporcionEstados` |
| `src/features/cms/PanelPage.tsx` (reescribir) | El Inicio: monta las piezas y reparte los datos |
| `src/features/cms/inicio/tareas.ts` (nuevo) | Las reglas de «Para hoy», sin JSX |
| `src/features/cms/inicio/Cabecera.tsx` (nuevo) | Fecha, saludo con el cargo y botones de la cabecera |
| `src/features/cms/inicio/ParaHoy.tsx` (nuevo) | La tarjeta de asuntos, con el reparto por cargo |
| `src/features/cms/inicio/Cifras.tsx` (nuevo) | Las cuatro cifras de hoy |
| `src/features/cms/inicio/CuentaAtras.tsx` (nuevo) | El bloque destacado del Sábado de Pasión |
| `src/features/cms/inicio/ProximosActos.tsx` (nuevo) | Los cuatro próximos actos |
| `src/features/cms/inicio/ActividadEquipo.tsx` (nuevo) | Últimas acciones de contenido y agenda |
| `src/features/cms/inicio/ComoVaElAnio.tsx` (nuevo) | Selector de ejercicio y las siete gráficas |
| `src/features/cms/panel/Cifra.tsx` (borrar) | Se absorbe en `inicio/Cifras.tsx` |
| `src/features/cms/panel/plural.ts` (mover) | Pasa a `src/features/cms/inicio/plural.ts` |

---
### Task 1: El ejercicio, en funciones puras

Todo el cálculo de fechas del selector vive fuera del servicio para poder probarlo sin base de datos. Es lo que permite que el resto del backend sea un cambio pequeño.

**Files:**
- Create: `backend-desamparados/src/domain/panel-ejercicio.ts`
- Test: `backend-desamparados/test/panel-ejercicio.test.ts`

**Interfaces:**
- Consumes: `claveMes` y `ultimosMeses` de `src/domain/panel-censo.js`; `diaMadrid` e `inicioDiaMadrid` de `src/domain/contabilidad.js`; `HttpError` de `src/utils/error.handle.js`.
- Produces:
  - `interface Ejercicio { anio: number; cerrado: boolean }`
  - `leerEjercicio(valor: unknown, hoy: Date): Ejercicio`
  - `mesesDelEjercicio(ejercicio: Ejercicio, hoy: Date): string[]`
  - `mesesParaReconstruir(mesesMostrados: string[], hoy: Date): string[]`
  - `rangoDeMeses(meses: string[]): { desde: Date; hasta: Date }`
  - `rangoDelEjercicio(anio: number): { desde: Date; hasta: Date }`
  - `const ANIO_MINIMO = 2000`

- [ ] **Step 1: Write the failing test**

```ts
// backend-desamparados/test/panel-ejercicio.test.ts
// Funciones puras: se ejecutan siempre, sin base de datos.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  leerEjercicio,
  mesesDelEjercicio,
  mesesParaReconstruir,
  rangoDeMeses,
  rangoDelEjercicio,
} from '../src/domain/panel-ejercicio.js';
import { ultimosMeses } from '../src/domain/panel-censo.js';
import { HttpError } from '../src/utils/error.handle.js';

// 11 de septiembre de 2026, a mediodía: lejos de los bordes de día y de zona.
const HOY = new Date('2026-09-11T12:00:00.000Z');

describe('leerEjercicio', () => {
  test('sin parámetro, el año en curso y abierto', () => {
    assert.deepEqual(leerEjercicio(undefined, HOY), { anio: 2026, cerrado: false });
    assert.deepEqual(leerEjercicio('', HOY), { anio: 2026, cerrado: false });
  });

  test('un año anterior queda marcado como cerrado', () => {
    assert.deepEqual(leerEjercicio('2025', HOY), { anio: 2025, cerrado: true });
  });

  test('acepta el número además de la cadena de la query', () => {
    assert.deepEqual(leerEjercicio(2024, HOY), { anio: 2024, cerrado: true });
  });

  test('rechaza lo que no es un año con un 400 explicado', () => {
    // La cadena vacía no entra aquí: es «sin parámetro», y ya se comprueba arriba.
    const malos: unknown[] = ['abc', '2025.5', '20255', ' ', '2027', '1999', -1, [], {}];
    for (const malo of malos) {
      assert.throws(
        () => leerEjercicio(malo, HOY),
        (e: unknown) => e instanceof HttpError && e.status === 400 && /2000/.test(e.message),
        `${JSON.stringify(malo)} debería dar 400`,
      );
    }
  });

  test('el año en curso es el último válido: el que viene no', () => {
    assert.deepEqual(leerEjercicio('2026', HOY), { anio: 2026, cerrado: false });
    assert.throws(() => leerEjercicio('2027', HOY), HttpError);
  });
});

describe('mesesDelEjercicio', () => {
  test('el año en curso enseña los últimos doce meses, como hasta ahora', () => {
    const meses = mesesDelEjercicio({ anio: 2026, cerrado: false }, HOY);
    assert.deepEqual(meses, ultimosMeses(HOY, 12));
    assert.equal(meses[11], '2026-09');
  });

  test('un año cerrado enseña sus doce meses naturales', () => {
    const meses = mesesDelEjercicio({ anio: 2025, cerrado: true }, HOY);
    assert.equal(meses.length, 12);
    assert.equal(meses[0], '2025-01');
    assert.equal(meses[11], '2025-12');
  });
});

describe('mesesParaReconstruir', () => {
  test('el año en curso no necesita más meses de los que enseña', () => {
    const mostrados = mesesDelEjercicio({ anio: 2026, cerrado: false }, HOY);
    assert.deepEqual(mesesParaReconstruir(mostrados, HOY), mostrados);
  });

  test('un año cerrado llega hasta el mes de hoy', () => {
    // El censo se reconstruye hacia atrás desde los activos de HOY: sin las
    // altas y bajas de 2026 no se sabe cuántos había en diciembre de 2025.
    const mostrados = mesesDelEjercicio({ anio: 2025, cerrado: true }, HOY);
    const recorrido = mesesParaReconstruir(mostrados, HOY);
    assert.equal(recorrido[0], '2025-01');
    assert.equal(recorrido[recorrido.length - 1], '2026-09');
    assert.equal(recorrido.length, 21);
    for (const mes of mostrados) assert.ok(recorrido.includes(mes), `falta ${mes}`);
  });
});

describe('rangos de fechas', () => {
  test('el ejercicio va del 1 de enero al 1 de enero siguiente', () => {
    const { desde, hasta } = rangoDelEjercicio(2025);
    assert.equal(desde.toISOString(), '2024-12-31T23:00:00.000Z'); // 00:00 de Madrid
    assert.equal(hasta.toISOString(), '2025-12-31T23:00:00.000Z');
  });

  test('el rango de unos meses abarca el último entero', () => {
    const { desde, hasta } = rangoDeMeses(['2025-11', '2025-12']);
    assert.equal(desde.toISOString(), '2025-10-31T23:00:00.000Z');
    assert.equal(hasta.toISOString(), '2025-12-31T23:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (en `backend-desamparados/`): `npx tsx --test test/panel-ejercicio.test.ts`
Expected: FAIL, «Cannot find module '../src/domain/panel-ejercicio.js'».

- [ ] **Step 3: Write minimal implementation**

```ts
// backend-desamparados/src/domain/panel-ejercicio.ts
import { diaMadrid, inicioDiaMadrid } from './contabilidad.js';
import { claveMes, ultimosMeses } from './panel-censo.js';
import { HttpError } from '../utils/error.handle.js';

/**
 * El ejercicio que enseña «Cómo va el año». En la reunión de principios de año
 * la junta mira el ejercicio recién cerrado, cuando el nuevo todavía no tiene
 * datos; el resto del año se mira el que está en curso.
 *
 * `cerrado` no es solo informativo: decide si los meses son los doce naturales
 * del año (ejercicio terminado) o los últimos doce (año en curso, como hasta
 * ahora), y la pantalla lo dice en la cabecera.
 */
export interface Ejercicio {
  anio: number;
  cerrado: boolean;
}

/** Antes de 2000 no hay nada que enseñar y un año de cuatro cifras acota el error. */
export const ANIO_MINIMO = 2000;

/**
 * Lee y valida `?anio=`. Sin valor (o vacío), el año en curso. Cualquier otra
 * cosa que no sea un año de cuatro cifras entre ANIO_MINIMO y el actual es un
 * 400: es un parámetro de la petición, no un fallo del servidor.
 */
export function leerEjercicio(valor: unknown, hoy: Date): Ejercicio {
  const actual = Number(diaMadrid(hoy).slice(0, 4));
  if (valor === undefined || valor === null || valor === '') {
    return { anio: actual, cerrado: false };
  }

  const texto = String(valor).trim();
  const anio = /^\d{4}$/.test(texto) ? Number(texto) : NaN;
  if (!Number.isInteger(anio) || anio < ANIO_MINIMO || anio > actual) {
    throw new HttpError(`El ejercicio tiene que ser un año entre ${ANIO_MINIMO} y ${actual}.`, 400);
  }

  return { anio, cerrado: anio < actual };
}

/** Los doce meses ('YYYY-MM') que enseña la sección para ese ejercicio. */
export function mesesDelEjercicio({ anio, cerrado }: Ejercicio, hoy: Date): string[] {
  if (!cerrado) return ultimosMeses(hoy, 12);
  return Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, '0')}`);
}

/**
 * Meses que hay que recorrer para reconstruir el censo, del primero que se
 * enseña al mes de hoy.
 *
 * `serieCensoMensual` parte de los activos de HOY y camina hacia atrás: para
 * saber cuántos había al cierre de diciembre de 2025 hacen falta también las
 * altas y bajas de 2026. Con el año en curso coincide con los meses mostrados.
 */
export function mesesParaReconstruir(mesesMostrados: string[], hoy: Date): string[] {
  if (mesesMostrados.length === 0) return [];
  const primero = mesesMostrados[0];
  const mesDeHoy = claveMes(hoy);
  if (primero >= mesDeHoy) return mesesMostrados;

  const [anioPrimero, numeroPrimero] = primero.split('-').map(Number);
  const [anioHoy, numeroHoy] = mesDeHoy.split('-').map(Number);
  const cuantos = (anioHoy - anioPrimero) * 12 + (numeroHoy - numeroPrimero) + 1;
  return ultimosMeses(hoy, cuantos);
}

/** Instante inicial del mes siguiente a 'YYYY-MM', en Madrid. */
function inicioDelMesSiguiente(mes: string): Date {
  const [anio, numero] = mes.split('-').map(Number);
  const siguiente = numero === 12 ? `${anio + 1}-01` : `${anio}-${String(numero + 1).padStart(2, '0')}`;
  return inicioDiaMadrid(`${siguiente}-01`);
}

/** `[desde, hasta)` que cubre por completo esos meses, en horas de Madrid. */
export function rangoDeMeses(meses: string[]): { desde: Date; hasta: Date } {
  return {
    desde: inicioDiaMadrid(`${meses[0]}-01`),
    hasta: inicioDelMesSiguiente(meses[meses.length - 1]),
  };
}

/** `[1 de enero, 1 de enero siguiente)` del ejercicio, en horas de Madrid. */
export function rangoDelEjercicio(anio: number): { desde: Date; hasta: Date } {
  return {
    desde: inicioDiaMadrid(`${anio}-01-01`),
    hasta: inicioDiaMadrid(`${anio + 1}-01-01`),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test test/panel-ejercicio.test.ts`
Expected: PASS, los cinco `describe` en verde.

- [ ] **Step 5: Commit**

```bash
rtk git add backend-desamparados/src/domain/panel-ejercicio.ts backend-desamparados/test/panel-ejercicio.test.ts
rtk git commit -m "Calcular el ejercicio del panel en funciones puras"
```

---

### Task 2: `GET /api/panel?anio=` acota el ejercicio

El primero de los cinco cambios de la spec §8, y el que decide la forma de todos los demás: el servicio pasa a recibir un año, lo valida y acota con él el dinero, la procesión y la serie del censo. Lo que es de hoy (activos, sin número, por edad, actos, noticias, reparto) no se toca.

**Files:**
- Modify: `backend-desamparados/src/services/panel.service.ts`
- Modify: `backend-desamparados/src/controllers/panel.controller.ts`
- Test: `backend-desamparados/test/panel-servicio.test.ts` (añadir un `describe`)
- Test: `backend-desamparados/test/panel-acceso.test.ts` (añadir el caso del 400)

**Interfaces:**
- Consumes: todo lo que produce la Task 1.
- Produces:
  - `PanelService.getPanel(anioSolicitado?: unknown): Promise<PanelResponse>`
  - `PanelResponse.ejercicio: { anio: number; cerrado: boolean }`

- [ ] **Step 1: Write the failing test**

Añadir al final de `test/panel-servicio.test.ts`, dentro del mismo fichero (usa el `dbDisponible` y el `SIN_DB` que ya existen):

```ts
describe('el ejercicio del panel', () => {
  test('sin parámetro, el año en curso y sin cerrar', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const panel = await PanelService.getPanel();
    const anioActual = new Date().getFullYear();
    assert.equal(panel.ejercicio.anio, anioActual);
    assert.equal(panel.ejercicio.cerrado, false);
    // La cifra del ejercicio y el ejercicio elegido no pueden discrepar.
    assert.equal(panel.dinero.ejercicio.anio, panel.ejercicio.anio);
    assert.equal(panel.procesion.anio, panel.ejercicio.anio);
  });

  test('con un año anterior, la sección entera pasa a ese año', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const anterior = new Date().getFullYear() - 1;
    const panel = await PanelService.getPanel(String(anterior));
    assert.deepEqual(panel.ejercicio, { anio: anterior, cerrado: true });
    assert.equal(panel.dinero.ejercicio.anio, anterior);
    assert.equal(panel.procesion.anio, anterior);
    // Doce meses naturales de ese año, de enero a diciembre.
    assert.equal(panel.censo.serieMensual.length, 12);
    assert.equal(panel.censo.serieMensual[0].mes, `${anterior}-01`);
    assert.equal(panel.censo.serieMensual[11].mes, `${anterior}-12`);
    assert.deepEqual(
      panel.dinero.serieMensual.map((m) => m.mes),
      panel.censo.serieMensual.map((p) => p.mes),
    );
  });

  test('lo que es de hoy no lo toca el selector', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const anterior = new Date().getFullYear() - 1;
    const [hoy, cerrado] = await Promise.all([
      PanelService.getPanel(),
      PanelService.getPanel(String(anterior)),
    ]);
    assert.equal(cerrado.censo.activos, hoy.censo.activos);
    assert.equal(cerrado.censo.sinNumeroHermano, hoy.censo.sinNumeroHermano);
    assert.deepEqual(cerrado.censo.porEdad, hoy.censo.porEdad);
    assert.deepEqual(cerrado.actividad.proximosEventos, hoy.actividad.proximosEventos);
    assert.deepEqual(cerrado.actividad.noticias, hoy.actividad.noticias);
    assert.deepEqual(cerrado.actividad.reparto, hoy.actividad.reparto);
  });

  test('un año inválido no llega ni a consultar: es un error de la petición', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await assert.rejects(
      () => PanelService.getPanel('1492'),
      (e: unknown) => e instanceof HttpError && e.status === 400,
    );
  });
});
```

Y arriba, junto a los demás imports de ese fichero:

```ts
import { HttpError } from '../src/utils/error.handle.js';
```

En `test/panel-acceso.test.ts`, dentro del `describe` que ya prueba los permisos del staff, añadir:

```ts
test('un año que no existe devuelve 400, no 500', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const res = await fetch(`${baseUrl}/api/panel?anio=abc`, {
    headers: { cookie: `${COOKIE_SESION}=${generateToken({ id: roleToUserId['ADMIN'], role: 'ADMIN' })}` },
  });
  assert.equal(res.status, 400);
  const cuerpo = await res.json();
  assert.match(cuerpo.error, /año/i);
});
```

> Ojo: copia la forma exacta de construir la cookie de los tests que ya hay en ese fichero (la llamada a `generateToken` y el nombre de la cookie); si allí se hace de otra manera, usa la de allí.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` (en `backend-desamparados/`)
Expected: FAIL. Sin base de datos, los casos nuevos se omiten pero el typecheck de `tsx` ya falla en `panel.ejercicio` («Property 'ejercicio' does not exist»). Con base de datos, además fallan las aserciones.

- [ ] **Step 3: Write minimal implementation**

En `src/controllers/panel.controller.ts`, pasar la query:

```ts
import { Response, Request } from 'express';
import { PanelService } from '../services/panel.service.js';
import { handleHttp } from '../utils/error.handle.js';

export class PanelController {
  static async get(req: Request, res: Response) {
    try {
      // El año inválido llega como HttpError desde el dominio y handleHttp lo
      // convierte en 400: es un parámetro mal puesto, no un fallo del servidor.
      res.status(200).json(await PanelService.getPanel(req.query.anio));
    } catch (e) {
      handleHttp(res, e, 'Error obteniendo el panel');
    }
  }
}
```

En `src/services/panel.service.ts`:

1. Importar lo nuevo y ampliar el contrato:

```ts
import {
  leerEjercicio,
  mesesDelEjercicio,
  mesesParaReconstruir,
  rangoDeMeses,
  rangoDelEjercicio,
} from '../domain/panel-ejercicio.js';
```

```ts
export interface PanelResponse {
  generadoEn: string;
  /** Ejercicio que acota el dinero, la procesión y la serie del censo. */
  ejercicio: { anio: number; cerrado: boolean };
  censo: { /* ... igual que ahora ... */ };
  // ...
}
```

2. Sustituir la cabecera de `getPanel` por esto (el resto del cuerpo sigue igual salvo los `where` que se indican):

```ts
  static async getPanel(anioSolicitado?: unknown): Promise<PanelResponse> {
    const hoy = new Date();
    // Días, meses y años de Madrid, con los mismos helpers que la contabilidad:
    // en UTC, el ejercicio perdía la primera hora del 1 de enero y lo cobrado la
    // primera hora del día 1 de cada mes caía en el mes anterior.
    const diaHoy = diaMadrid(hoy);
    const ejercicio = leerEjercicio(anioSolicitado, hoy);
    const anio = ejercicio.anio;

    // Los meses que se enseñan y los que hay que recorrer para reconstruir el
    // censo hacia atrás desde los activos de hoy. Con el año en curso son los
    // mismos; con uno cerrado, el recorrido llega hasta el mes de hoy.
    const meses = mesesDelEjercicio(ejercicio, hoy);
    const mesesRecorridos = mesesParaReconstruir(meses, hoy);
    // Dos rangos distintos a propósito: el dinero solo necesita los meses que se
    // enseñan, y el censo necesita además todo lo que va desde ahí hasta hoy.
    const rangoDinero = rangoDeMeses(meses);
    const rangoCenso = rangoDeMeses(mesesRecorridos);
    const { desde: inicioEjercicio, hasta: finEjercicio } = rangoDelEjercicio(anio);

    // Las altas y bajas de los últimos doce meses son cifras DE HOY (van en la
    // tarjeta de hermanos activos), así que no las toca el selector.
    const haceUnAnio = inicioDiaMadrid(unAnioAntes(diaHoy));
    const altasUltimoAnio = whereAltasAprobadas(haceUnAnio);
    // Las de la serie, en cambio, cubren todo el recorrido de reconstrucción.
    const altasDelRecorrido = whereAltasAprobadas(rangoCenso.desde);
```

3. Cambiar los `where` de las consultas afectadas dentro del `Promise.all`:

```ts
      db.hermano.count({ where: { activo: true } }),
      // Las solicitudes pendientes no son altas (ver whereAltasAprobadas).
      db.hermano.count({ where: altasUltimoAnio }),
      db.hermano.count({ where: { fechaBaja: { gte: haceUnAnio } } }),
      db.hermano.count({ where: { activo: true, numeroHermano: null } }),
      db.hermano.groupBy({ by: ['fechaAlta'], _count: { _all: true }, where: altasDelRecorrido }),
      db.hermano.groupBy({
        by: ['fechaBaja'],
        _count: { _all: true },
        where: { fechaBaja: { gte: rangoCenso.desde } },
      }),
      // ... porEdadCounts igual ...
      db.recibo.groupBy({ by: ['estado'], _count: { _all: true }, _sum: { importe: true } }),
      db.transaccion.groupBy({
        by: ['tipo'],
        _sum: { importe: true },
        where: { fecha: { gte: inicioEjercicio, lt: finEjercicio } },
      }),
      db.transaccion.groupBy({
        by: ['categoriaId', 'tipo'],
        _count: { _all: true },
        where: { fecha: { gte: inicioEjercicio, lt: finEjercicio } },
      }),
      db.transaccion.groupBy({
        by: ['tipo', 'fecha'],
        _sum: { importe: true },
        where: { fecha: { gte: rangoDinero.desde, lt: rangoDinero.hasta } },
      }),
      // Los cinco años HASTA el elegido: la gráfica destaca el ejercicio, y con
      // los cinco últimos absolutos un año antiguo no aparecería en su propia
      // gráfica.
      db.papeletaSitio.groupBy({ by: ['year'], _count: { _all: true }, where: { year: { lte: anio } } }),
      db.papeletaSitio.groupBy({ by: ['puesto'], _count: { _all: true }, where: { year: anio } }),
```

4. La serie del censo se reconstruye sobre el recorrido y se recorta a lo que se enseña:

```ts
    const altasPorMes = contarPorMes(fechasAlta.flatMap((f) => new Array(f._count._all).fill(f.fechaAlta)));
    const bajasPorMes = contarPorMes(fechasBaja.flatMap((f) => new Array(f._count._all).fill(f.fechaBaja)));
    const serieCompleta = serieCensoMensual(activos, altasPorMes, bajasPorMes, mesesRecorridos);
    const mesesMostrados = new Set(meses);
    const serieCenso = serieCompleta.filter((p) => mesesMostrados.has(p.mes));
```

5. La serie del dinero se calcula sobre `meses` (los que se enseñan), no sobre los recorridos:

```ts
    const serieDinero = meses.map((mes) => {
      const delMes = transaccionesPorMes.filter((t) => claveMes(t.fecha) === mes);
      const suma = (tipo: TipoTransaccion) =>
        delMes.filter((t) => t.tipo === tipo).reduce((s, t) => s + Number(t._sum.importe ?? 0), 0);
      return { mes, ingresos: euros2(suma(TipoTransaccion.INGRESO)), gastos: euros2(suma(TipoTransaccion.GASTO)) };
    });
```

6. En el `return`, añadir `ejercicio` y usar `serieCenso`:

```ts
    return {
      generadoEn: hoy.toISOString(),
      ejercicio,
      censo: {
        activos,
        altas12m,
        bajas12m,
        sinNumeroHermano,
        serieMensual: serieCenso,
        porEdad,
      },
      // ... el resto igual ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` (en `backend-desamparados/`)
Expected: PASS. Sin base de datos los casos nuevos salen como omitidos con su motivo, pero `panel-ejercicio.test.ts` y el typecheck pasan; con MariaDB levantada, los cuatro casos nuevos en verde y los antiguos sin tocar.

- [ ] **Step 5: Commit**

```bash
rtk git add backend-desamparados/src backend-desamparados/test
rtk git commit -m "Elegir el ejercicio del panel con ?anio= sin mover lo que es de hoy"
```

---

### Task 3: Altas y bajas por mes

Ya se calculan para reconstruir el censo; lo único que falta es enviarlas. Es el cambio 2 de la spec §8.

**Files:**
- Modify: `backend-desamparados/src/services/panel.service.ts`
- Test: `backend-desamparados/test/panel-servicio.test.ts`

**Interfaces:**
- Consumes: `altasPorMes` y `bajasPorMes` de la Task 2, y `meses`.
- Produces: `PanelResponse.censo.movimientosMensuales: { mes: string; altas: number; bajas: number }[]`

- [ ] **Step 1: Write the failing test**

```ts
// en test/panel-servicio.test.ts, dentro de describe('servicio del panel')
test('las altas y bajas de cada mes viajan con la serie del censo', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const panel = await PanelService.getPanel();

  // Los mismos meses y en el mismo orden que la serie: las dos gráficas se
  // leen una encima de otra y un desfase las haría mentir.
  assert.deepEqual(
    panel.censo.movimientosMensuales.map((m) => m.mes),
    panel.censo.serieMensual.map((p) => p.mes),
  );
  for (const mes of panel.censo.movimientosMensuales) {
    assert.equal(typeof mes.altas, 'number');
    assert.equal(typeof mes.bajas, 'number');
    assert.ok(mes.altas >= 0 && mes.bajas >= 0, `${mes.mes} trae movimientos negativos`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/panel-servicio.test.ts`
Expected: FAIL en el typecheck, «Property 'movimientosMensuales' does not exist on type».

- [ ] **Step 3: Write minimal implementation**

En el contrato:

```ts
  censo: {
    activos: number;
    altas12m: number;
    bajas12m: number;
    sinNumeroHermano: number;
    serieMensual: { mes: string; activos: number }[];
    /** Altas y bajas de cada uno de los meses de `serieMensual`. */
    movimientosMensuales: { mes: string; altas: number; bajas: number }[];
    porEdad: { tramo: string; total: number }[];
  };
```

Junto al cálculo de `serieCenso`:

```ts
    // Los movimientos ya estaban calculados para reconstruir la serie; lo único
    // que faltaba era mandarlos. Los meses sin movimiento van a cero, no
    // ausentes: la gráfica necesita las doce ranuras.
    const porMes = (lista: MovimientoMensual[]) => new Map(lista.map((m) => [m.mes, m.total]));
    const altasIndexadas = porMes(altasPorMes);
    const bajasIndexadas = porMes(bajasPorMes);
    const movimientosMensuales = meses.map((mes) => ({
      mes,
      altas: altasIndexadas.get(mes) ?? 0,
      bajas: bajasIndexadas.get(mes) ?? 0,
    }));
```

Y en el `return`, dentro de `censo`, después de `serieMensual`:

```ts
        movimientosMensuales,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add backend-desamparados/src/services/panel.service.ts backend-desamparados/test/panel-servicio.test.ts
rtk git commit -m "Enviar las altas y bajas por mes, que ya se calculaban"
```

---

### Task 4: El gasto por categoría, en euros

Hoy `porCategoria.total` es el número de apuntes, no lo que cuesta. Es el cambio 3 de la spec §8.

**Files:**
- Modify: `backend-desamparados/src/services/panel.service.ts`
- Test: `backend-desamparados/test/panel-servicio.test.ts`

**Interfaces:**
- Produces: `PanelResponse.dinero.porCategoria[].importe: number` (se mantiene `total`, que es el recuento de apuntes).

- [ ] **Step 1: Write the failing test**

```ts
// en test/panel-servicio.test.ts, dentro de describe('servicio del panel')
test('cada categoría trae su importe además del número de apuntes', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const panel = await PanelService.getPanel();

  // Control positivo: el before() siembra una categoría de ingreso con dos
  // apuntes de 10,10 y 10,20 en el mes en curso.
  const prueba = panel.dinero.porCategoria.find((c) => c.categoria === 'ZZTestCategoriaArrastre');
  assert.ok(prueba, 'no se encontró la categoría de prueba; ¿se sembró?');
  assert.equal(prueba!.total, 2);
  assert.equal(prueba!.importe, 20.3); // sin arrastre binario: 20.299999999999997 fallaría

  for (const fila of panel.dinero.porCategoria) {
    assert.equal(typeof fila.importe, 'number');
    assert.ok(!Number.isNaN(fila.importe));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/panel-servicio.test.ts`
Expected: FAIL en el typecheck, «Property 'importe' does not exist».

- [ ] **Step 3: Write minimal implementation**

En el contrato:

```ts
    porCategoria: { categoria: string; tipo: TipoTransaccion; total: number; importe: number }[];
```

En la consulta (añadir el `_sum`):

```ts
      db.transaccion.groupBy({
        by: ['categoriaId', 'tipo'],
        _count: { _all: true },
        _sum: { importe: true },
        where: { fecha: { gte: inicioEjercicio, lt: finEjercicio } },
      }),
```

En el `return`:

```ts
        porCategoria: transaccionesPorCategoria.map((t) => ({
          categoria: nombreCategoria.get(t.categoriaId) ?? 'Sin categoría',
          tipo: t.tipo,
          total: t._count._all,
          // En euros, que es lo que responde a «en qué se gasta»: el número de
          // apuntes no dice nada (una factura de 11.000 € y un recibo de 6 €
          // cuentan igual). `total` se mantiene para no romper a nadie.
          importe: euros2(Number(t._sum.importe ?? 0)),
        })),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add backend-desamparados/src/services/panel.service.ts backend-desamparados/test/panel-servicio.test.ts
rtk git commit -m "Contar el gasto por categoría en euros y no en apuntes"
```

---

### Task 5: Los recibos, del ejercicio

`recibosPorEstado` agrupa todos los años desde que existe el Grupo Parroquial, así que el «94 % cobrado» mezclaba ejercicios. Es el cambio 4 de la spec §8, y el único que cambia una cifra que Tesorería ya miraba: hay que avisarles.

**Files:**
- Modify: `backend-desamparados/src/services/panel.service.ts`
- Test: `backend-desamparados/test/panel-servicio.test.ts`

**Interfaces:**
- `PanelResponse.dinero.porEstado` no cambia de forma; cambia lo que cuenta.

- [ ] **Step 1: Write the failing test**

```ts
// en test/panel-servicio.test.ts, dentro de describe('el ejercicio del panel')
test('los recibos se cuentan del ejercicio elegido, no de todos los años', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const anterior = new Date().getFullYear() - 1;
  const [hoy, cerrado] = await Promise.all([
    PanelService.getPanel(),
    PanelService.getPanel(String(anterior)),
  ]);

  const suma = (panel: Awaited<ReturnType<typeof PanelService.getPanel>>) =>
    panel.dinero.porEstado.reduce((s, e) => s + e.total, 0);
  const total = await db.recibo.count();

  // Cada ejercicio por separado no puede sumar más que todos los recibos que
  // hay; antes de este cambio los dos devolvían exactamente ese total.
  assert.ok(suma(hoy) <= total, 'el ejercicio en curso trae recibos de más');
  assert.ok(suma(cerrado) <= total, 'el ejercicio cerrado trae recibos de más');
  assert.equal(suma(hoy), await db.recibo.count({ where: { year: hoy.ejercicio.anio } }));
  assert.equal(suma(cerrado), await db.recibo.count({ where: { year: anterior } }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/panel-servicio.test.ts`
Expected: FAIL con base de datos y recibos de más de un año. Si la base de pruebas solo tuviera recibos de un año, el caso pasaría por casualidad: antes de darlo por bueno, comprueba con `npx prisma studio` o `SELECT year, COUNT(*) FROM Recibo GROUP BY year` que hay más de uno; si no, siembra uno del año anterior en el `before()`.

- [ ] **Step 3: Write minimal implementation**

```ts
      // Del ejercicio elegido: mezclando años, el «% cobrado» salía diluido por
      // ejercicios ya liquidados. El índice @@index([year]) ya existe.
      db.recibo.groupBy({
        by: ['estado'],
        _count: { _all: true },
        _sum: { importe: true },
        where: { year: anio },
      }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add backend-desamparados/src/services/panel.service.ts backend-desamparados/test/panel-servicio.test.ts
rtk git commit -m "Contar los recibos del ejercicio elegido y no de todos los años"
```

---

### Task 6: Actividad de contenido y agenda

El cambio 5 de la spec §8. La actividad del equipo la ve toda la junta, así que solo puede llevar lo público: contenido y agenda. El registro completo, con personas y con IP, sigue en Auditoría, que solo ven ADMIN y HERMANO_MAYOR.

**Files:**
- Modify: `backend-desamparados/src/services/panel.service.ts`
- Test: `backend-desamparados/test/panel-servicio.test.ts`

**Interfaces:**
- Produces: `PanelResponse.actividad.registro: { accion: string; entityType: string | null; createdAt: string; cargo: string | null }[]`

- [ ] **Step 1: Write the failing test**

```ts
// en test/panel-servicio.test.ts, dentro de describe('servicio del panel')
test('la actividad del equipo solo trae contenido y agenda, y sin personas', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const panel = await PanelService.getPanel();

  assert.ok(Array.isArray(panel.actividad.registro));
  assert.ok(panel.actividad.registro.length <= 5, 'el registro son las cinco últimas acciones');

  const PERMITIDAS = /^(NOTICIA|PUBLICACION|PAGINA|EVENTO)_|^PORTADA_ACTUALIZAR$/;
  for (const fila of panel.actividad.registro) {
    assert.match(fila.accion, PERMITIDAS, `${fila.accion} no es una acción de contenido`);
    assert.match(fila.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    // El cargo, nunca la persona: ni id, ni nombre, ni correo.
    assert.ok(fila.cargo === null || typeof fila.cargo === 'string');
    assert.deepEqual(
      Object.keys(fila).sort(),
      ['accion', 'cargo', 'createdAt', 'entityType'],
    );
  }

  // En orden, de lo más reciente a lo más antiguo.
  const fechas = panel.actividad.registro.map((f) => f.createdAt);
  assert.deepEqual(fechas, [...fechas].sort().reverse());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test test/panel-servicio.test.ts`
Expected: FAIL en el typecheck, «Property 'registro' does not exist».

- [ ] **Step 3: Write minimal implementation**

Ampliar el comentario de la regla de oro, arriba del todo del fichero, con la tercera excepción:

```
 *   - AuditLog acotado a las acciones de contenido y agenda de la lista
 *     blanca, y seleccionando del usuario SOLO su `role`: el Inicio dice qué
 *     cargo hizo qué, nunca quién. Ni `detalles` ni `entityId` salen de aquí,
 *     así que no hay forma de que se cuele el nombre de nadie. El registro
 *     completo sigue en Auditoría, que solo ven ADMIN y HERMANO_MAYOR.
```

Constante, junto a `TRAMOS_EDAD`:

```ts
/**
 * Acciones que puede ver toda la junta: las que tocan lo que se publica.
 * Cualquier acción sobre personas o dinero queda fuera a propósito.
 */
const ACCIONES_DE_CONTENIDO = [
  'NOTICIA_CREAR', 'NOTICIA_ACTUALIZAR', 'NOTICIA_ELIMINAR',
  'PUBLICACION_CREAR', 'PUBLICACION_ACTUALIZAR', 'PUBLICACION_ELIMINAR',
  'PAGINA_GUARDAR', 'PAGINA_ACTUALIZAR', 'PAGINA_ELIMINAR',
  'PORTADA_ACTUALIZAR',
  'EVENTO_CREAR', 'EVENTO_ACTUALIZAR', 'EVENTO_ELIMINAR',
];
```

En el contrato:

```ts
  actividad: {
    proximosEventos: { id: number; title: string; startDate: string; type: TipoEvento }[];
    noticias: { publicadas: number; borradores: number };
    publicaciones: { total: number; ultima: string | null };
    reparto: { turnosProximos: number; citasReservadas: number; capacidadEstimada: number };
    /** Las cinco últimas acciones de contenido y agenda, por cargo y sin personas. */
    registro: { accion: string; entityType: string | null; createdAt: string; cargo: string | null }[];
  };
```

Una consulta más en el `Promise.all` (al final de la lista, y su nombre en el destructuring):

```ts
      db.auditLog.findMany({
        where: { action: { in: ACCIONES_DE_CONTENIDO } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          action: true,
          entityType: true,
          createdAt: true,
          // Solo el cargo. `user` entero traería correo y nombre.
          user: { select: { role: true } },
        },
      }),
```

En el `return`, dentro de `actividad`:

```ts
        registro: registroContenido.map((r) => ({
          accion: r.action,
          entityType: r.entityType,
          createdAt: r.createdAt.toISOString(),
          cargo: r.user?.role ?? null,
        })),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, incluido el test antiguo «no devuelve ningún dato personal», que ahora recorre también el registro.

- [ ] **Step 5: Commit**

```bash
rtk git add backend-desamparados/src/services/panel.service.ts backend-desamparados/test/panel-servicio.test.ts
rtk git commit -m "Dar a la junta la actividad de contenido y agenda, por cargo"
```

---
### Task 7: El tema del CMS, en dos modos

`cmsTheme` deja de ser una constante. Los dos modos salen de `designTokens`, sin inventar ningún color, y de aquí salen también las superficies y los colores de las gráficas para que nadie los escriba a mano en un componente.

**Files:**
- Modify: `desamparados-web/src/theme/cms.ts`
- Test: `desamparados-web/src/theme/__tests__/cms.test.ts` (reescribir)
- Modify: `desamparados-web/src/features/cms/__tests__/BrotherEditPage.test.tsx` (import)
- Modify: `desamparados-web/src/features/cms/__tests__/InventoryEditPage.test.tsx` (import)

**Interfaces:**
- Consumes: `theme` y `designTokens` de `src/theme/index.ts`.
- Produces:
  - `type ModoCms = 'claro' | 'oscuro'`
  - `superficiesCms(modo: ModoCms): SuperficiesCms`
  - `graficasCms(modo: ModoCms): GraficasCms`
  - `crearTemaCms(modo: ModoCms): Theme`
  - Desaparecen `cmsTheme` y `cmsSurfaces` (constantes) y el export por defecto.

- [ ] **Step 1: Write the failing test**

```tsx
// src/theme/__tests__/cms.test.ts
import { describe, it, expect } from 'vitest'
import { crearTemaCms, superficiesCms, graficasCms } from '../cms'
import theme, { designTokens } from '../index'

describe('tema del CMS', () => {
  it('el modo claro es el lienzo de papel de siempre', () => {
    const claro = crearTemaCms('claro')
    expect(claro.palette.mode).toBe('light')
    expect(claro.palette.background.default).toBe('#f4f2ee')
    expect(claro.palette.background.paper).toBe('#ffffff')
    expect(claro.palette.text.primary).toBe(designTokens.colors.onSurface)
  })

  it('el modo oscuro es el de la web pública: mismo lienzo y tarjeta tintada', () => {
    const oscuro = crearTemaCms('oscuro')
    expect(oscuro.palette.mode).toBe('dark')
    expect(oscuro.palette.background.default).toBe(designTokens.colors.primaryContainer) // #262326
    expect(oscuro.palette.background.paper).toBe(designTokens.colors.onPrimaryFixed) // #1d1b1e
    expect(oscuro.palette.text.primary).toBe('#ffffff')
  })

  it('conserva la identidad en los dos: burdeos y Libre Caslon en los títulos', () => {
    for (const modo of ['claro', 'oscuro'] as const) {
      const t = crearTemaCms(modo)
      expect(t.palette.primary.main).toBe(designTokens.colors.secondary)
      expect(t.typography.h1.fontFamily).toContain('Libre Caslon Text')
    }
  })

  it('no altera el tema de la web pública', () => {
    crearTemaCms('claro')
    crearTemaCms('oscuro')
    expect(theme.palette.mode).toBe('dark')
    expect(theme.palette.background.default).toBe(designTokens.colors.primaryContainer)
  })

  it('los estados interactivos del modo claro no se quedan en blanco', () => {
    // Fusionar sobre el tema oscuro deja action y text.disabled en blancos de
    // baja opacidad: invisibles sobre fondo claro.
    const { palette } = crearTemaCms('claro')
    const enBlanco = (valor: string) => valor.includes('255, 255, 255') || valor === '#fff'
    for (const valor of [palette.action.hover, palette.action.selected, palette.action.focus, palette.action.active, palette.text.disabled]) {
      expect(enBlanco(valor)).toBe(false)
    }
  })

  it('la barra lateral es la misma tinta en los dos modos', () => {
    expect(superficiesCms('claro').sidebar).toBe(designTokens.colors.primary) // #100e11
    expect(superficiesCms('oscuro').sidebar).toBe(designTokens.colors.primary)
  })

  it('el bloque destacado va siempre en el tono contrario al tema', () => {
    // Es lo que lo hace destacar en los dos: papel sobre oscuro, tinta sobre claro.
    expect(superficiesCms('oscuro').inverso).toBe('#fbf9f6')
    expect(superficiesCms('claro').inverso).toBe('#1d1b1e')
    expect(superficiesCms('oscuro').inversoTexto).toBe('#1b1c1a')
    expect(superficiesCms('claro').inversoTexto).toBe('#ffffff')
  })

  it('las gráficas tienen su azul por modo y el mismo granate en los dos', () => {
    // Paleta validada con el script de dataviz sobre las superficies reales.
    expect(graficasCms('claro').entrada).toBe('#2a78d6')
    expect(graficasCms('oscuro').entrada).toBe('#3987e5')
    expect(graficasCms('claro').salida).toBe('#b0414a')
    expect(graficasCms('oscuro').salida).toBe('#b0414a')
  })

  it('el año elegido va en tinta y el contexto en gris, nunca al revés', () => {
    for (const modo of ['claro', 'oscuro'] as const) {
      const g = graficasCms(modo)
      expect(g.enfasis).toBe(modo === 'claro' ? '#1b1c1a' : '#ffffff')
      expect(g.enfasis).not.toBe(g.contexto)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (en `desamparados-web/`): `npx vitest run src/theme/__tests__/cms.test.ts`
Expected: FAIL, «does not provide an export named 'crearTemaCms'».

- [ ] **Step 3: Write minimal implementation**

```ts
// src/theme/cms.ts
import { createTheme, type Theme } from '@mui/material/styles'
import theme, { designTokens } from './index'

/**
 * Tema del CMS en dos modos, sobre el mismo juego de tokens que la web pública.
 *
 * Se aplica con un ThemeProvider anidado dentro de AdminLayout, así que la web
 * pública no se entera. Los dos modos redefinen la paleta entera, los estados
 * interactivos y el texto deshabilitado en lugar de fusionar parcialmente:
 * heredar sobre el `mode: 'dark'` del tema base deja esos tres grupos en
 * blancos de baja opacidad, invisibles sobre el lienzo claro. Afecta al hover,
 * la selección y el foco de botones, MenuItem, ListItemButton, filas de tabla,
 * y al texto deshabilitado.
 */
export type ModoCms = 'claro' | 'oscuro'

export interface SuperficiesCms {
  /** Lienzo de la pantalla. */
  canvas: string
  /** Fondo de tarjeta. */
  card: string
  /** Borde de tarjeta; en oscuro no hay borde, la tarjeta se separa por tono. */
  hairline: string
  /** Línea que separa filas dentro de una tarjeta. */
  filete: string
  /** Barra lateral: la misma tinta en los dos modos. */
  sidebar: string
  /** Bloque destacado, siempre en el tono contrario al tema. */
  inverso: string
  inversoTexto: string
  inversoTenue: string
  /** Pista de la barra de progreso dentro del bloque destacado. */
  inversoPista: string
  /** Botón secundario de la cabecera. */
  boton2: string
  boton2Borde: string
  /** Botón de acción de «Para hoy». */
  accionFondo: string
  accionTexto: string
  enlace: string
  /** Fondo de las etiquetas de estado de «Para hoy». */
  pillUrgente: string
  pillPendiente: string
  pillNeutro: string
  /** Emergente de detalle de las gráficas. */
  emergente: string
  emergenteBorde: string
  texto: string
  texto2: string
  tenue: string
}

export interface GraficasCms {
  /** Lo que entra: ingresos, altas. */
  entrada: string
  /** Lo que sale: gastos, bajas. */
  salida: string
  /** Años que no son el elegido. */
  contexto: string
  /** El año elegido. */
  enfasis: string
  /** Una serie sin signo (tramos de edad). */
  neutro: string
  rejilla: string
  /** Línea del cero, más marcada que la rejilla. */
  cero: string
  /** Banda del mes señalado al pasar el ratón. */
  banda: string
  estados: { ok: string; aviso: string; error: string }
}

const SUPERFICIES: Record<ModoCms, SuperficiesCms> = {
  claro: {
    canvas: '#f4f2ee',
    card: '#ffffff',
    hairline: '#e3dfda',
    filete: '#efebe6',
    sidebar: designTokens.colors.primary,
    inverso: designTokens.colors.onPrimaryFixed, // #1d1b1e
    inversoTexto: '#ffffff',
    inversoTenue: 'rgba(255,255,255,0.55)',
    inversoPista: 'rgba(255,255,255,0.12)',
    boton2: '#ffffff',
    boton2Borde: '#e3dfda',
    accionFondo: 'rgba(110,24,34,0.07)',
    accionTexto: designTokens.colors.burgundy, // #6e1822
    enlace: designTokens.colors.burgundy,
    pillUrgente: 'rgba(227,73,72,0.12)',
    pillPendiente: 'rgba(237,161,0,0.16)',
    pillNeutro: '#efeeeb',
    emergente: '#ffffff',
    emergenteBorde: '#e3dfda',
    texto: designTokens.colors.onSurface, // #1b1c1a
    texto2: designTokens.colors.onSurfaceVariant, // #4a454a
    tenue: designTokens.colors.outline, // #7b757a
  },
  oscuro: {
    canvas: designTokens.colors.primaryContainer, // #262326
    card: designTokens.colors.onPrimaryFixed, // #1d1b1e
    hairline: 'transparent',
    filete: designTokens.colors.glassBorder, // rgba(204,196,201,0.1)
    sidebar: designTokens.colors.primary,
    inverso: designTokens.colors.surface, // #fbf9f6
    inversoTexto: designTokens.colors.onSurface,
    inversoTenue: designTokens.colors.outline,
    inversoPista: designTokens.colors.surfaceVariant, // #e4e2df
    boton2: 'rgba(255,255,255,0.06)',
    boton2Borde: 'transparent',
    accionFondo: 'rgba(160,61,68,0.22)',
    accionTexto: designTokens.colors.secondaryFixedDim, // #ffb3b4
    enlace: designTokens.colors.secondaryFixedDim,
    pillUrgente: 'rgba(227,73,72,0.18)',
    pillPendiente: 'rgba(237,161,0,0.18)',
    pillNeutro: 'rgba(255,255,255,0.08)',
    emergente: designTokens.colors.primary, // #100e11
    emergenteBorde: 'rgba(204,196,201,0.18)',
    texto: '#ffffff',
    texto2: designTokens.colors.primaryFixedDim, // #cbc5c8
    tenue: designTokens.colors.onPrimaryContainer, // #8f8a8d
  },
}

const GRAFICAS: Record<ModoCms, GraficasCms> = {
  claro: {
    entrada: designTokens.dataviz.series[0], // #2a78d6
    salida: '#b0414a',
    contexto: '#d6d0cb',
    enfasis: designTokens.colors.onSurface,
    neutro: designTokens.colors.outline,
    rejilla: '#efebe6',
    cero: '#b9b3b0',
    banda: 'rgba(27,28,26,0.045)',
    estados: designTokens.dataviz.estados,
  },
  oscuro: {
    entrada: designTokens.dataviz.seriesOscuras[0], // #3987e5
    salida: '#b0414a',
    contexto: designTokens.colors.onSurfaceVariant, // #4a454a
    enfasis: '#ffffff',
    neutro: designTokens.colors.onPrimaryContainer,
    rejilla: 'rgba(204,196,201,0.12)',
    cero: 'rgba(204,196,201,0.4)',
    banda: 'rgba(255,255,255,0.05)',
    estados: designTokens.dataviz.estados,
  },
}

export const superficiesCms = (modo: ModoCms): SuperficiesCms => SUPERFICIES[modo]
export const graficasCms = (modo: ModoCms): GraficasCms => GRAFICAS[modo]

const ACCIONES: Record<ModoCms, Record<string, string>> = {
  claro: {
    active: 'rgba(0, 0, 0, 0.54)',
    hover: 'rgba(0, 0, 0, 0.04)',
    selected: 'rgba(0, 0, 0, 0.08)',
    disabled: 'rgba(0, 0, 0, 0.26)',
    disabledBackground: 'rgba(0, 0, 0, 0.12)',
    focus: 'rgba(0, 0, 0, 0.12)',
  },
  oscuro: {
    active: 'rgba(255, 255, 255, 0.62)',
    hover: 'rgba(255, 255, 255, 0.06)',
    selected: 'rgba(255, 255, 255, 0.12)',
    disabled: 'rgba(255, 255, 255, 0.34)',
    disabledBackground: 'rgba(255, 255, 255, 0.12)',
    focus: 'rgba(255, 255, 255, 0.14)',
  },
}

export function crearTemaCms(modo: ModoCms): Theme {
  const s = superficiesCms(modo)
  return createTheme(theme, {
    palette: {
      mode: modo === 'claro' ? 'light' : 'dark',
      background: { default: s.canvas, paper: s.card },
      text: {
        primary: s.texto,
        secondary: s.texto2,
        disabled: modo === 'claro' ? 'rgba(0, 0, 0, 0.38)' : 'rgba(255, 255, 255, 0.42)',
      },
      action: ACCIONES[modo],
      divider: modo === 'claro' ? s.hairline : s.filete,
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            // En oscuro la tarjeta se separa del lienzo por tono, como en la web
            // pública: un borde encima la ensuciaría.
            border: modo === 'claro' ? `1px solid ${s.hairline}` : 0,
          },
        },
      },
    },
  })
}
```

En `src/features/cms/__tests__/BrotherEditPage.test.tsx` y en `InventoryEditPage.test.tsx`, cambiar el import y el uso:

```tsx
import { crearTemaCms } from '../../../theme/cms'
// ...
return render(<HelmetProvider><ThemeProvider theme={crearTemaCms('claro')}><RouterProvider router={router} /></ThemeProvider></HelmetProvider>)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/theme src/features/cms/__tests__/BrotherEditPage.test.tsx src/features/cms/__tests__/InventoryEditPage.test.tsx`
Expected: PASS. `npx tsc -b` fallará todavía en `AdminLayout.tsx`, que aún importa `cmsTheme`: se arregla en la Task 10.

- [ ] **Step 5: Commit**

No se hace commit aquí: el proyecto no compila hasta la Task 10. Se acumula y se confirma con ella. (Si prefieres commits atómicos, deja en `cms.ts` un `export const cmsTheme = crearTemaCms('claro')` temporal, confirma, y quítalo en la Task 10.)

---

### Task 8: El interruptor de tema y su memoria

El modo vive en un contexto para que lo puedan leer el menú (el interruptor) y las gráficas (sus colores) sin pasárselo de mano en mano por diez componentes.

**Files:**
- Create: `desamparados-web/src/app/temaCms.tsx`
- Test: `desamparados-web/src/app/__tests__/temaCms.test.tsx`

**Interfaces:**
- Consumes: `crearTemaCms`, `ModoCms` de `src/theme/cms.ts`.
- Produces:
  - `<TemaCmsProvider>{children}</TemaCmsProvider>` (monta el `ThemeProvider` de MUI)
  - `useTemaCms(): { modo: ModoCms, cambiarModo: (m: ModoCms) => void, superficies: SuperficiesCms, graficas: GraficasCms }`
  - `const CLAVE_TEMA_CMS = 'cms-tema'`

- [ ] **Step 1: Write the failing test**

```tsx
// src/app/__tests__/temaCms.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemaCmsProvider, useTemaCms, CLAVE_TEMA_CMS } from '../temaCms'

function Sonda() {
  const { modo, cambiarModo, graficas } = useTemaCms()
  return (
    <div>
      <span data-testid="modo">{modo}</span>
      <span data-testid="entrada">{graficas.entrada}</span>
      <button onClick={() => cambiarModo('claro')}>Claro</button>
      <button onClick={() => cambiarModo('oscuro')}>Oscuro</button>
    </div>
  )
}

const montar = () => render(<TemaCmsProvider><Sonda /></TemaCmsProvider>)

describe('tema del CMS', () => {
  beforeEach(() => { localStorage.clear() })

  it('sin nada guardado arranca en oscuro, que es la dirección elegida', () => {
    montar()
    expect(screen.getByTestId('modo')).toHaveTextContent('oscuro')
  })

  it('al pulsar Claro cambia y lo recuerda', async () => {
    montar()
    await userEvent.click(screen.getByRole('button', { name: 'Claro' }))
    expect(screen.getByTestId('modo')).toHaveTextContent('claro')
    expect(localStorage.getItem(CLAVE_TEMA_CMS)).toBe('claro')
  })

  it('al volver a entrar respeta lo guardado', () => {
    localStorage.setItem(CLAVE_TEMA_CMS, 'claro')
    montar()
    expect(screen.getByTestId('modo')).toHaveTextContent('claro')
  })

  it('las gráficas cambian de azul con el modo', async () => {
    montar()
    expect(screen.getByTestId('entrada')).toHaveTextContent('#3987e5')
    await userEvent.click(screen.getByRole('button', { name: 'Claro' }))
    expect(screen.getByTestId('entrada')).toHaveTextContent('#2a78d6')
  })

  it('un valor corrupto en el almacenamiento no rompe nada', () => {
    localStorage.setItem(CLAVE_TEMA_CMS, 'fucsia')
    montar()
    expect(screen.getByTestId('modo')).toHaveTextContent('oscuro')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/__tests__/temaCms.test.tsx`
Expected: FAIL, «Failed to resolve import '../temaCms'».

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/app/temaCms.tsx
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { ThemeProvider } from '@mui/material/styles'
import {
  crearTemaCms,
  graficasCms,
  superficiesCms,
  type GraficasCms,
  type ModoCms,
  type SuperficiesCms,
} from '../theme/cms'

/** Dónde recuerda el navegador el modo elegido. Es por persona y por equipo. */
export const CLAVE_TEMA_CMS = 'cms-tema'

/** Sin nada guardado, oscuro: es la dirección elegida; quien prefiera claro lo cambia una vez. */
const POR_DEFECTO: ModoCms = 'oscuro'

interface ValorTemaCms {
  modo: ModoCms
  cambiarModo: (modo: ModoCms) => void
  superficies: SuperficiesCms
  graficas: GraficasCms
}

const Contexto = createContext<ValorTemaCms | null>(null)

/**
 * localStorage puede lanzar (modo privado, almacenamiento bloqueado, iframes) y
 * puede traer basura si alguien lo edita a mano: en los dos casos, el modo por
 * defecto. Se lee en el inicializador de useState, antes del primer pintado,
 * para que no haya un parpadeo de claro a oscuro al entrar.
 */
function leerModo(): ModoCms {
  try {
    const guardado = window.localStorage.getItem(CLAVE_TEMA_CMS)
    return guardado === 'claro' || guardado === 'oscuro' ? guardado : POR_DEFECTO
  } catch {
    return POR_DEFECTO
  }
}

export function TemaCmsProvider({ children }: { children: React.ReactNode }) {
  const [modo, setModo] = useState<ModoCms>(leerModo)

  const cambiarModo = useCallback((nuevo: ModoCms) => {
    setModo(nuevo)
    try {
      window.localStorage.setItem(CLAVE_TEMA_CMS, nuevo)
    } catch {
      // Sin almacenamiento: la elección dura lo que dure la pestaña.
    }
  }, [])

  const valor = useMemo<ValorTemaCms>(
    () => ({ modo, cambiarModo, superficies: superficiesCms(modo), graficas: graficasCms(modo) }),
    [modo, cambiarModo],
  )
  const tema = useMemo(() => crearTemaCms(modo), [modo])

  return (
    <Contexto.Provider value={valor}>
      <ThemeProvider theme={tema}>{children}</ThemeProvider>
    </Contexto.Provider>
  )
}

export function useTemaCms(): ValorTemaCms {
  const valor = useContext(Contexto)
  if (!valor) throw new Error('useTemaCms solo funciona dentro de TemaCmsProvider')
  return valor
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/__tests__/temaCms.test.tsx`
Expected: PASS, los cinco casos.

- [ ] **Step 5: Commit**

Se acumula con la Task 10 (ver la nota de la Task 7).

---

### Task 9: `getPanel(anio)` y los tipos del Inicio

El cliente refleja el contrato nuevo del backend y aparece la consulta compartida que alimenta a la vez al menú y al Inicio.

**Files:**
- Modify: `desamparados-web/src/lib/api/panel.ts`
- Create: `desamparados-web/src/app/usePanelDeHoy.ts`
- Test: `desamparados-web/src/lib/api/__tests__/panel.test.ts`

**Interfaces:**
- Produces:
  - `PanelResponse` con `ejercicio`, `censo.movimientosMensuales`, `dinero.porCategoria[].importe` y `actividad.registro`
  - `getPanel(anio?: number): Promise<PanelResponse>`
  - `CLAVE_PANEL_HOY` y `usePanelDeHoy()`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/api/__tests__/panel.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getPanel } from '../panel'

function espiarFetch() {
  const espia = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  )
  vi.stubGlobal('fetch', espia)
  return espia
}

afterEach(() => { vi.unstubAllGlobals() })

describe('getPanel', () => {
  it('sin año, pide el panel a secas', async () => {
    const espia = espiarFetch()
    await getPanel()
    expect(espia.mock.calls[0][0]).toBe('/api/panel')
  })

  it('con año, lo manda en la query', async () => {
    const espia = espiarFetch()
    await getPanel(2025)
    expect(espia.mock.calls[0][0]).toBe('/api/panel?anio=2025')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/api/__tests__/panel.test.ts`
Expected: FAIL: `getPanel` no acepta argumentos («Expected 0 arguments, but got 1»).

- [ ] **Step 3: Write minimal implementation**

En `src/lib/api/panel.ts`, ampliar el tipo y la función:

```ts
export interface PanelResponse {
  generadoEn: string
  /** Ejercicio al que corresponden el dinero, la procesión y la serie del censo. */
  ejercicio: { anio: number; cerrado: boolean }
  censo: {
    activos: number
    altas12m: number
    bajas12m: number
    sinNumeroHermano: number
    serieMensual: PuntoCenso[]
    movimientosMensuales: { mes: string; altas: number; bajas: number }[]
    porEdad: { tramo: string; total: number }[]
  }
  dinero: {
    porEstado: { estado: EstadoRecibo; total: number; importe: number }[]
    ejercicio: { anio: number; ingresos: number; gastos: number; saldo: number }
    serieMensual: { mes: string; ingresos: number; gastos: number }[]
    porCategoria: { categoria: string; tipo: TipoMovimiento; total: number; importe: number }[]
  }
  procesion: {
    anio: number
    papeletas: number
    porAnio: { anio: number; total: number }[]
    porPuesto: FilaRecuento[]
    porTalla: FilaRecuento[]
    porAlturaHombro: { tramo: string; total: number }[]
  }
  actividad: {
    proximosEventos: { id: number; title: string; startDate: string; type: TipoEvento }[]
    noticias: { publicadas: number; borradores: number }
    publicaciones: { total: number; ultima: string | null }
    reparto: { turnosProximos: number; citasReservadas: number; capacidadEstimada: number }
    /** Las cinco últimas acciones de contenido y agenda, por cargo y sin personas. */
    registro: { accion: string; entityType: string | null; createdAt: string; cargo: string | null }[]
  }
}

/** Sin año, el ejercicio en curso. */
export function getPanel(anio?: number) {
  return apiFetch<PanelResponse>(anio === undefined ? '/panel' : `/panel?anio=${anio}`)
}
```

```ts
// src/app/usePanelDeHoy.ts
import { useQuery } from '@tanstack/react-query'
import { getPanel } from '../lib/api/panel'

/**
 * La consulta del panel del ejercicio en curso, compartida por el menú (que
 * saca de ahí sus contadores) y por el Inicio. Con la misma clave, TanStack
 * Query la resuelve una sola vez; el `staleTime` evita que cambiar de pantalla
 * dentro del CMS dispare una petición nueva cada vez.
 */
export const CLAVE_PANEL_HOY = ['panel', 'hoy'] as const

export function usePanelDeHoy() {
  return useQuery({
    queryKey: CLAVE_PANEL_HOY,
    queryFn: () => getPanel(),
    staleTime: 5 * 60 * 1000,
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/api/__tests__/panel.test.ts`
Expected: PASS. `npx tsc -b` sigue fallando en `PanelPage.tsx` y `AdminLayout.tsx`: se arreglan en las Tasks 10 y 16.

- [ ] **Step 5: Commit**

Se acumula con la Task 10.

---

### Task 10: Menú agrupado, contadores e interruptor

`AdminLayout` pasa a agrupar el menú por áreas, a enseñar cuántos asuntos hay pendientes en cada sección, a llevar el interruptor de tema abajo y a rematar con el bloque de usuario. Los roles por ruta no se tocan.

**Files:**
- Modify: `desamparados-web/src/app/cmsNavegacion.ts`
- Modify: `desamparados-web/src/app/AdminLayout.tsx`
- Test: `desamparados-web/src/app/__tests__/AdminLayout.test.tsx`

**Interfaces:**
- Consumes: `useTemaCms` (Task 8), `usePanelDeHoy` (Task 9), `superficiesCms`.
- Produces:
  - `itemsMenu` con `grupo: Grupo`, `icono: ComponentType`, y `contador?: { de: ClaveContador; tono: 'aviso' | 'error' }`
  - `GRUPOS: readonly Grupo[]` en el orden en que se pintan
  - `type ClaveContador = 'noticiasBorradores' | 'hermanosSinNumero' | 'recibosDevueltos'`
  - `contadoresDelPanel(panel?: PanelResponse): Record<ClaveContador, number>`

- [ ] **Step 1: Write the failing test**

Reemplazar el caso «todo el staff tiene el panel como primera entrada» y añadir los nuevos, dejando intactos los `describe` de divergencia menú/guardas y de color de texto:

```tsx
// src/app/__tests__/AdminLayout.test.tsx — casos nuevos
import { vi, beforeEach, afterEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { CLAVE_TEMA_CMS } from '../temaCms'

const PANEL_MINIMO = {
  generadoEn: '2026-09-11T08:00:00.000Z',
  ejercicio: { anio: 2026, cerrado: false },
  censo: { activos: 1284, altas12m: 34, bajas12m: 12, sinNumeroHermano: 3, serieMensual: [], movimientosMensuales: [], porEdad: [] },
  dinero: {
    porEstado: [{ estado: 'DEVUELTO', total: 14, importe: 420 }],
    ejercicio: { anio: 2026, ingresos: 0, gastos: 0, saldo: 0 },
    serieMensual: [],
    porCategoria: [],
  },
  procesion: { anio: 2026, papeletas: 612, porAnio: [], porPuesto: [], porTalla: [], porAlturaHombro: [] },
  actividad: {
    proximosEventos: [],
    noticias: { publicadas: 4, borradores: 2 },
    publicaciones: { total: 7, ultima: null },
    reparto: { turnosProximos: 2, citasReservadas: 6, capacidadEstimada: 40 },
    registro: [],
  },
}

function responder(cuerpo: unknown = PANEL_MINIMO, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }),
  ))
}

describe('el menú del Inicio', () => {
  beforeEach(() => { localStorage.clear(); responder() })
  afterEach(() => { vi.unstubAllGlobals() })

  it('la primera entrada es Inicio, no Panel', async () => {
    entrarComo('REDES')
    renderWithProviders(<AdminLayout />)
    const enlaces = screen.getAllByRole('link')
    expect(enlaces[1]).toHaveAccessibleName('Inicio') // [0] es el logotipo
  })

  it('agrupa las secciones por áreas', () => {
    entrarComo('ADMIN')
    renderWithProviders(<AdminLayout />)
    for (const grupo of ['Hoy', 'Contenido', 'Censo y enseres', 'Cuentas', 'Sistema']) {
      expect(screen.getByText(grupo)).toBeInTheDocument()
    }
  })

  it('un cargo acotado solo ve los grupos que le tocan', () => {
    entrarComo('REDES')
    renderWithProviders(<AdminLayout />)
    expect(screen.getByText('Contenido')).toBeInTheDocument()
    // Sin Tesorería ni Contabilidad, el grupo «Cuentas» no tiene nada que agrupar.
    expect(screen.queryByText('Cuentas')).not.toBeInTheDocument()
    expect(screen.queryByText('Censo y enseres')).not.toBeInTheDocument()
  })

  it('los contadores salen de los datos del panel', async () => {
    entrarComo('ADMIN')
    renderWithProviders(<AdminLayout />)
    // 2 borradores en Noticias, 3 hermanos sin número, 14 recibos devueltos.
    expect(await screen.findByLabelText('Noticias: 2 pendientes')).toHaveTextContent('2')
    expect(screen.getByLabelText('Hermanos: 3 pendientes')).toHaveTextContent('3')
    expect(screen.getByLabelText('Tesorería: 14 urgentes')).toHaveTextContent('14')
  })

  it('sin nada pendiente no pinta contadores', async () => {
    responder({
      ...PANEL_MINIMO,
      censo: { ...PANEL_MINIMO.censo, sinNumeroHermano: 0 },
      dinero: { ...PANEL_MINIMO.dinero, porEstado: [] },
      actividad: { ...PANEL_MINIMO.actividad, noticias: { publicadas: 4, borradores: 0 } },
    })
    entrarComo('ADMIN')
    renderWithProviders(<AdminLayout />)
    await screen.findByRole('link', { name: 'Noticias' })
    expect(screen.queryByLabelText(/pendientes$/)).not.toBeInTheDocument()
  })

  it('si el panel falla, el menú se pinta igual', async () => {
    responder({}, 500)
    entrarComo('ADMIN')
    renderWithProviders(<AdminLayout />)
    expect(await screen.findByRole('link', { name: 'Tesorería' })).toBeInTheDocument()
  })

  it('el interruptor de tema arranca en oscuro y recuerda el cambio', async () => {
    entrarComo('ADMIN')
    renderWithProviders(<AdminLayout />)
    const claro = screen.getByRole('radio', { name: 'Claro' })
    const oscuro = screen.getByRole('radio', { name: 'Oscuro' })
    expect(oscuro).toBeChecked()
    await userEvent.click(claro)
    expect(claro).toBeChecked()
    expect(localStorage.getItem(CLAVE_TEMA_CMS)).toBe('claro')
  })

  it('el bloque de usuario dice el cargo y ofrece salir', () => {
    entrarComo('SECRETARIA')
    renderWithProviders(<AdminLayout />)
    expect(screen.getByText('Secretaría')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument()
  })
})
```

El caso antiguo «no lleva cabecera con el nombre del grupo ni el rol» comprobaba que **no** aparece «Secretaría»: ahora sí aparece, en el bloque de usuario. Hay que cambiarlo para que siga comprobando lo que quería decir (que no hay cabecera superior con el nombre del Grupo Parroquial):

```tsx
  it('no lleva cabecera superior con el nombre del Grupo Parroquial', () => {
    entrarComo('SECRETARIA')
    renderWithProviders(<AdminLayout />)
    expect(screen.queryByText('Grupo Parroquial de los Desamparados')).not.toBeInTheDocument()
    expect(screen.queryByText('Administración')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app`
Expected: FAIL: no existen ni los grupos, ni los contadores, ni el interruptor.

- [ ] **Step 3: Write minimal implementation**

`src/app/cmsNavegacion.ts` — mismos ítems y mismos roles, más grupo, icono y contador. **`rolesPorRutaCms` no se toca.**

```ts
import type { ComponentType } from 'react'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import type { PanelResponse } from '../lib/api/panel'

/**
 * Áreas del menú, en el orden en que se pintan. «Censo y enseres» y no
 * «Hermandad»: la corporación es un Grupo Parroquial.
 */
export const GRUPOS = ['Hoy', 'Contenido', 'Censo y enseres', 'Cuentas', 'Sistema'] as const
export type Grupo = (typeof GRUPOS)[number]

/** De dónde sale el número que se enseña junto a una sección. */
export type ClaveContador = 'noticiasBorradores' | 'hermanosSinNumero' | 'recibosDevueltos'

export interface ItemMenu {
  label: string
  href: string
  roles: string[]
  grupo: Grupo
  icono: ComponentType<{ fontSize?: 'small' | 'inherit' | 'medium' | 'large' }>
  /** El número dice cuántos hay; el tono, cuánta prisa corre. */
  contador?: { de: ClaveContador; tono: 'aviso' | 'error' }
}

const TODOS = ['ADMIN', 'HERMANO_MAYOR', 'SECRETARIA', 'TESORERIA', 'REDES', 'ALBACERIA']

export const itemsMenu: ItemMenu[] = [
  { label: 'Inicio', href: '/cms', roles: TODOS, grupo: 'Hoy', icono: HomeOutlinedIcon },
  { label: 'Portada', href: '/cms/portada', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'], grupo: 'Contenido', icono: ImageOutlinedIcon },
  { label: 'Noticias', href: '/cms/noticias', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'], grupo: 'Contenido', icono: ArticleOutlinedIcon, contador: { de: 'noticiasBorradores', tono: 'aviso' } },
  { label: 'Publicaciones', href: '/cms/publicaciones', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'], grupo: 'Contenido', icono: MenuBookOutlinedIcon },
  { label: 'Agenda', href: '/cms/agenda', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'], grupo: 'Contenido', icono: CalendarMonthOutlinedIcon },
  { label: 'Hermanos', href: '/cms/hermanos', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'], grupo: 'Censo y enseres', icono: GroupsOutlinedIcon, contador: { de: 'hermanosSinNumero', tono: 'aviso' } },
  { label: 'Inventario', href: '/cms/inventario', roles: ['ADMIN', 'ALBACERIA', 'HERMANO_MAYOR'], grupo: 'Censo y enseres', icono: Inventory2OutlinedIcon },
  { label: 'Tesorería', href: '/cms/tesoreria', roles: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'], grupo: 'Cuentas', icono: AccountBalanceWalletOutlinedIcon, contador: { de: 'recibosDevueltos', tono: 'error' } },
  { label: 'Contabilidad', href: '/cms/contabilidad', roles: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'], grupo: 'Cuentas', icono: BarChartOutlinedIcon },
  { label: 'Auditoría', href: '/cms/auditoria', roles: ['ADMIN', 'HERMANO_MAYOR'], grupo: 'Sistema', icono: FactCheckOutlinedIcon },
  { label: 'Mi seguridad', href: '/cms/mi-seguridad', roles: TODOS, grupo: 'Sistema', icono: ShieldOutlinedIcon },
]

/** Los tres números del menú, del mismo panel que alimenta el Inicio. */
export function contadoresDelPanel(panel?: PanelResponse): Record<ClaveContador, number> {
  return {
    noticiasBorradores: panel?.actividad.noticias.borradores ?? 0,
    hermanosSinNumero: panel?.censo.sinNumeroHermano ?? 0,
    recibosDevueltos: panel?.dinero.porEstado.find((e) => e.estado === 'DEVUELTO')?.total ?? 0,
  }
}

/** Nombre del cargo tal y como se enseña. */
export const NOMBRE_CARGO: Record<string, string> = {
  ADMIN: 'Administración',
  HERMANO_MAYOR: 'Hermano Mayor',
  SECRETARIA: 'Secretaría',
  TESORERIA: 'Tesorería',
  REDES: 'Redes',
  ALBACERIA: 'Albacería',
}
```

`src/app/AdminLayout.tsx` — la barra por grupos, con contador, interruptor y bloque de usuario. El `ThemeProvider` fijo lo sustituye `TemaCmsProvider`, así que el layout se parte en dos: el proveedor fuera y el contenido dentro (dentro es donde ya se puede llamar a `useTemaCms`).

```tsx
import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  Box, Drawer, IconButton, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Toolbar, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import { useAuthStore } from '../features/members/auth/store'
import { cerrarSesion } from '../features/members/auth/session'
import { TemaCmsProvider, useTemaCms } from './temaCms'
import { superficiesCms, type ModoCms } from '../theme/cms'
import { GRUPOS, NOMBRE_CARGO, contadoresDelPanel, itemsMenu } from './cmsNavegacion'
import { usePanelDeHoy } from './usePanelDeHoy'
import { designTokens } from '../theme'

const SIDEBAR = superficiesCms('oscuro').sidebar // #100e11, la misma en los dos modos

function Contador({ seccion, valor, tono }: { seccion: string; valor: number; tono: 'aviso' | 'error' }) {
  // El número dice cuántos y el color cuánta prisa corre, pero el color nunca
  // va solo: el aria-label lo dice con palabras.
  const fondo = tono === 'error' ? designTokens.dataviz.estados.error : designTokens.dataviz.estados.aviso
  return (
    <Box
      component="span"
      aria-label={`${seccion}: ${valor} ${tono === 'error' ? 'urgentes' : 'pendientes'}`}
      sx={{
        minWidth: 22, height: 20, px: 0.75, borderRadius: 10, backgroundColor: fondo,
        color: SIDEBAR, fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {valor}
    </Box>
  )
}

function Navegacion({ role, onNavegar }: { role?: string; onNavegar?: () => void }) {
  const location = useLocation()
  const { data } = usePanelDeHoy()
  const contadores = contadoresDelPanel(data)
  const visibles = itemsMenu.filter((item) => role && item.roles.includes(role))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {GRUPOS.map((grupo) => {
        const items = visibles.filter((item) => item.grupo === grupo)
        if (items.length === 0) return null
        return (
          <Box key={grupo}>
            <Typography
              sx={{
                px: 1.5, pt: 2, pb: 0.75, fontSize: 11, fontWeight: 600,
                letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.36)',
              }}
            >
              {grupo}
            </Typography>
            <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {items.map((item) => {
                const activo = item.href === '/cms'
                  ? location.pathname === '/cms'
                  : location.pathname.startsWith(item.href)
                const Icono = item.icono
                const valor = item.contador ? contadores[item.contador.de] : 0
                return (
                  <ListItem key={item.href} disablePadding>
                    <ListItemButton
                      component={Link}
                      to={item.href}
                      onClick={onNavegar}
                      selected={activo}
                      sx={{
                        borderRadius: 1.5, minHeight: 36, py: 0, px: 1.5, gap: 1.5,
                        color: activo ? '#fff' : 'rgba(255,255,255,0.66)',
                        backgroundColor: activo ? 'primary.main' : 'transparent',
                        '&.Mui-selected:hover': { backgroundColor: 'primary.dark' },
                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.06)' },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 0, color: 'inherit' }}><Icono fontSize="small" /></ListItemIcon>
                      <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: 14 } } }} />
                      {item.contador && valor > 0 && (
                        <Contador seccion={item.label} valor={valor} tono={item.contador.tono} />
                      )}
                    </ListItemButton>
                  </ListItem>
                )
              })}
            </List>
          </Box>
        )
      })}
    </Box>
  )
}

/** Control segmentado de dos opciones: es una elección, no dos botones sueltos. */
function InterruptorTema() {
  const { modo, cambiarModo } = useTemaCms()
  const opciones: { valor: ModoCms; texto: string; Icono: typeof LightModeOutlinedIcon }[] = [
    { valor: 'claro', texto: 'Claro', Icono: LightModeOutlinedIcon },
    { valor: 'oscuro', texto: 'Oscuro', Icono: DarkModeOutlinedIcon },
  ]
  return (
    <Box
      role="radiogroup"
      aria-label="Tema del CMS"
      sx={{ display: 'flex', gap: '2px', p: '3px', mb: 1.75, borderRadius: 1.25, backgroundColor: 'rgba(255,255,255,0.06)' }}
    >
      {opciones.map(({ valor, texto, Icono }) => (
        <Box
          key={valor}
          component="button"
          type="button"
          role="radio"
          aria-checked={modo === valor}
          onClick={() => cambiarModo(valor)}
          sx={{
            flex: 1, height: 30, border: 0, cursor: 'pointer', borderRadius: 1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
            fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
            backgroundColor: modo === valor ? 'rgba(255,255,255,0.14)' : 'transparent',
            color: modo === valor ? '#fff' : 'rgba(255,255,255,0.55)',
          }}
        >
          <Icono sx={{ fontSize: 15 }} />
          {texto}
        </Box>
      ))}
    </Box>
  )
}

function BloqueUsuario({ role }: { role?: string }) {
  const cargo = role ? NOMBRE_CARGO[role] ?? role : ''
  const iniciales = cargo.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
  return (
    <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', pt: 1.75, px: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box
        aria-hidden="true"
        sx={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          backgroundColor: designTokens.colors.burgundy, color: '#fff',
          fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {iniciales}
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{cargo}</Typography>
        <Box
          component="button"
          type="button"
          onClick={() => { void cerrarSesion() }}
          sx={{
            border: 0, background: 'none', p: 0, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 12, color: 'rgba(255,255,255,0.45)', '&:hover': { color: '#fff' },
          }}
        >
          Cerrar sesión
        </Box>
      </Box>
    </Box>
  )
}

function Contenido() {
  const role = useAuthStore((state) => state.user?.role)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const tema = useTheme()
  const { superficies } = useTemaCms()
  const esMovil = useMediaQuery(tema.breakpoints.down('md'))

  const barra = (
    <Box sx={{ height: '100%', backgroundColor: SIDEBAR, p: 2, pt: 3.25, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ px: 1.25 }}>
        <Typography
          component={Link}
          to="/cms"
          sx={{ color: '#fff', textDecoration: 'none', fontFamily: designTokens.fonts.heading, fontSize: 19, letterSpacing: '0.04em' }}
        >
          DESAMPARADOS
        </Typography>
        <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.45)', mt: 0.5 }}>
          CMS
        </Typography>
      </Box>
      <Navegacion role={role} onNavegar={() => setMenuAbierto(false)} />
      <Box sx={{ mt: 'auto' }} />
      <InterruptorTema />
      <BloqueUsuario role={role} />
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default', color: 'text.primary' }}>
      {esMovil ? (
        <Drawer open={menuAbierto} onClose={() => setMenuAbierto(false)} sx={{ '& .MuiDrawer-paper': { width: 264, border: 0 } }}>
          {barra}
        </Drawer>
      ) : (
        <Box
          component="aside"
          sx={{
            width: 264,
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            // En un contenedor flex, sin esto el hijo se estira a toda la
            // altura y `sticky` no llega a pegarse a nada.
            alignSelf: 'flex-start',
            height: '100vh',
            overflowY: 'auto',
          }}
        >
          {barra}
        </Box>
      )}

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        {esMovil && (
          <Toolbar
            sx={{
              borderBottom: `1px solid ${superficies.filete}`,
              backgroundColor: 'background.paper',
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            <IconButton edge="start" aria-label="Abrir el menú" onClick={() => setMenuAbierto(true)}>
              <MenuIcon />
            </IconButton>
          </Toolbar>
        )}
        <Box sx={{ p: { xs: 2.5, md: 4 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  )
}

export default function AdminLayout() {
  // El proveedor va fuera para que `Contenido` pueda leer el modo con useTemaCms.
  return (
    <TemaCmsProvider>
      <Contenido />
    </TemaCmsProvider>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app src/theme && npx tsc -b`
Expected: los tests de `src/app` y `src/theme` en verde, incluidos los dos `describe` antiguos que comparan el menú con las guardas. `tsc -b` seguirá fallando en `PanelPage.tsx`, que todavía es el panel antiguo; es lo que arregla la Task 17.

- [ ] **Step 5: Commit**

```bash
rtk git add desamparados-web/src/theme desamparados-web/src/app desamparados-web/src/lib/api desamparados-web/src/features/cms/__tests__
rtk git commit -m "Dar al CMS tema claro/oscuro y menú agrupado con avisos"
```

---
### Task 11: El Sábado de Pasión se calcula, no se escribe

La fecha de la estación de penitencia se mueve cada año con la Pascua. Escribirla a mano obligaría a tocar el código cada enero.

**Files:**
- Create: `desamparados-web/src/domain/sabadoDePasion.ts`
- Test: `desamparados-web/src/domain/__tests__/sabadoDePasion.test.ts`

**Interfaces:**
- Produces:
  - `pascua(anio: number): Date`
  - `sabadoDePasion(anio: number): Date`
  - `cuentaAtrasEstacion(hoy: Date): { fecha: Date; anterior: Date; dias: number; porcentaje: number }`

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/__tests__/sabadoDePasion.test.ts
import { describe, it, expect } from 'vitest'
import { pascua, sabadoDePasion, cuentaAtrasEstacion } from '../sabadoDePasion'

const comoTexto = (f: Date) =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`

describe('Pascua', () => {
  it('cae donde dice el calendario', () => {
    // Domingos de Resurrección comprobables en cualquier calendario litúrgico.
    expect(comoTexto(pascua(2024))).toBe('2024-03-31')
    expect(comoTexto(pascua(2025))).toBe('2025-04-20')
    expect(comoTexto(pascua(2026))).toBe('2026-04-05')
    expect(comoTexto(pascua(2027))).toBe('2027-03-28')
    expect(comoTexto(pascua(2038))).toBe('2038-04-25') // el más tardío posible
  })
})

describe('Sábado de Pasión', () => {
  it('es ocho días antes de Pascua, y siempre sábado', () => {
    expect(comoTexto(sabadoDePasion(2026))).toBe('2026-03-28')
    expect(comoTexto(sabadoDePasion(2027))).toBe('2027-03-20')
    for (const anio of [2024, 2025, 2026, 2027, 2028, 2030]) {
      expect(sabadoDePasion(anio).getDay(), `${anio} no cae en sábado`).toBe(6)
    }
  })

  it('salta de mes hacia atrás sin descuadrarse', () => {
    // Pascua del 5 de abril menos ocho días cruza a marzo.
    expect(comoTexto(sabadoDePasion(2026))).toBe('2026-03-28')
  })
})

describe('cuenta atrás de la estación', () => {
  it('antes de la estación, apunta a la de este año', () => {
    const { fecha, anterior, dias } = cuentaAtrasEstacion(new Date(2026, 0, 15))
    expect(comoTexto(fecha)).toBe('2026-03-28')
    expect(comoTexto(anterior)).toBe('2025-04-12') // Pascua 2025 (20 abr) menos 8
    expect(dias).toBe(72)
  })

  it('pasada la estación, apunta a la del año que viene', () => {
    const { fecha, anterior, dias, porcentaje } = cuentaAtrasEstacion(new Date(2026, 8, 11))
    expect(comoTexto(fecha)).toBe('2027-03-20')
    expect(comoTexto(anterior)).toBe('2026-03-28')
    expect(dias).toBe(190)
    expect(porcentaje).toBe(47) // 167 días de curso de 357
  })

  it('el mismo día de la estación no la da por pasada', () => {
    const { dias, porcentaje } = cuentaAtrasEstacion(new Date(2026, 2, 28))
    expect(dias).toBe(0)
    expect(porcentaje).toBe(100)
  })

  it('el porcentaje se queda siempre entre 0 y 100', () => {
    for (const fecha of [new Date(2026, 2, 29), new Date(2026, 11, 31), new Date(2027, 2, 19)]) {
      const { porcentaje } = cuentaAtrasEstacion(fecha)
      expect(porcentaje).toBeGreaterThanOrEqual(0)
      expect(porcentaje).toBeLessThanOrEqual(100)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain`
Expected: FAIL, «Failed to resolve import '../sabadoDePasion'».

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/sabadoDePasion.ts
/**
 * La estación de penitencia del Grupo Parroquial es el Sábado de Pasión: ocho
 * días antes del Domingo de Resurrección, que se mueve cada año. Se calcula en
 * vez de escribirse a mano para no tener que tocar el código cada enero.
 *
 * Todas las fechas son medianoche LOCAL, no UTC: son fechas de calendario, se
 * comparan con el día de hoy del navegador y se enseñan con
 * `toLocaleDateString`. Con medianoche UTC, en Madrid saldrían un día antes
 * durante el horario de verano.
 */

/** Domingo de Pascua por el algoritmo de Meeus/Butcher (calendario gregoriano). */
export function pascua(anio: number): Date {
  const a = anio % 19
  const b = Math.floor(anio / 100)
  const c = anio % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(anio, mes - 1, dia)
}

/** Sábado de Pasión de ese año: Pascua menos ocho días. */
export function sabadoDePasion(anio: number): Date {
  const domingo = pascua(anio)
  // El constructor de Date normaliza un día negativo al mes anterior.
  return new Date(domingo.getFullYear(), domingo.getMonth(), domingo.getDate() - 8)
}

export interface CuentaAtrasEstacion {
  /** La próxima estación de penitencia. */
  fecha: Date
  /** La última celebrada: marca el principio del curso. */
  anterior: Date
  /** Días que faltan; 0 el mismo día. */
  dias: number
  /** Parte del curso recorrida desde la estación anterior, de 0 a 100. */
  porcentaje: number
}

const DIA_EN_MS = 24 * 60 * 60 * 1000
/** La fecha sin hora, para restar días sin que el cambio de hora estorbe. */
const soloDia = (f: Date) => Date.UTC(f.getFullYear(), f.getMonth(), f.getDate())

export function cuentaAtrasEstacion(hoy: Date): CuentaAtrasEstacion {
  const deEsteAnio = sabadoDePasion(hoy.getFullYear())
  // El mismo día de la estación todavía cuenta como «hoy es la estación».
  const yaPasó = soloDia(hoy) > soloDia(deEsteAnio)
  const fecha = yaPasó ? sabadoDePasion(hoy.getFullYear() + 1) : deEsteAnio
  const anterior = yaPasó ? deEsteAnio : sabadoDePasion(hoy.getFullYear() - 1)

  const dias = Math.round((soloDia(fecha) - soloDia(hoy)) / DIA_EN_MS)
  const curso = soloDia(fecha) - soloDia(anterior)
  const recorrido = soloDia(hoy) - soloDia(anterior)
  const porcentaje = Math.min(100, Math.max(0, Math.round((recorrido / curso) * 100)))

  return { fecha, anterior, dias, porcentaje }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain`
Expected: PASS, los siete casos.

- [ ] **Step 5: Commit**

```bash
rtk git add desamparados-web/src/domain
rtk git commit -m "Calcular el Sábado de Pasión desde la Pascua, año a año"
```

---

### Task 12: Las reglas de «Para hoy»

Qué asuntos hay, quién los lleva y quién ve el botón. Sin JSX, para poder probar las reglas solas.

**Files:**
- Create: `desamparados-web/src/features/cms/inicio/tareas.ts`
- Create: `desamparados-web/src/features/cms/inicio/plural.ts` (mover desde `../panel/plural.ts`, sin cambios)
- Test: `desamparados-web/src/features/cms/inicio/__tests__/tareas.test.ts`

**Interfaces:**
- Consumes: `PanelResponse` de `src/lib/api/panel.ts`; `contar` de `./plural`.
- Produces:
  - `type Prioridad = 'urgente' | 'pendiente' | 'programado'`
  - `interface Tarea { clave; prioridad; etiqueta; titulo; detalle; cargo; roles; accion: { texto; href } | null }`
  - `tareasDelDia(panel: PanelResponse): Tarea[]`
  - `repartirTareas(tareas: Tarea[], role?: string): { tuyas: Tarea[]; deLaJunta: Tarea[] }`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/cms/inicio/__tests__/tareas.test.ts
import { describe, it, expect } from 'vitest'
import { tareasDelDia, repartirTareas } from '../tareas'
import type { PanelResponse } from '../../../../lib/api/panel'

const PANEL = {
  generadoEn: '2026-09-11T08:00:00.000Z',
  ejercicio: { anio: 2026, cerrado: false },
  censo: { activos: 1284, altas12m: 34, bajas12m: 12, sinNumeroHermano: 3, serieMensual: [], movimientosMensuales: [], porEdad: [] },
  dinero: {
    porEstado: [
      { estado: 'PAGADO', total: 1126, importe: 33780 },
      { estado: 'DEVUELTO', total: 14, importe: 420 },
    ],
    ejercicio: { anio: 2026, ingresos: 48300, gastos: 35440, saldo: 12860 },
    serieMensual: [],
    porCategoria: [],
  },
  procesion: { anio: 2026, papeletas: 612, porAnio: [], porPuesto: [], porTalla: [], porAlturaHombro: [] },
  actividad: {
    proximosEventos: [],
    noticias: { publicadas: 4, borradores: 2 },
    publicaciones: { total: 7, ultima: null },
    reparto: { turnosProximos: 2, citasReservadas: 6, capacidadEstimada: 40 },
    registro: [],
  },
} as unknown as PanelResponse

const vacio = {
  ...PANEL,
  censo: { ...PANEL.censo, sinNumeroHermano: 0 },
  dinero: { ...PANEL.dinero, porEstado: [{ estado: 'PAGADO' as const, total: 1126, importe: 33780 }] },
  actividad: {
    ...PANEL.actividad,
    noticias: { publicadas: 4, borradores: 0 },
    reparto: { turnosProximos: 0, citasReservadas: 0, capacidadEstimada: 0 },
  },
} as unknown as PanelResponse

describe('tareasDelDia', () => {
  it('saca un asunto por cada cosa pendiente, y cada uno con su cargo', () => {
    const tareas = tareasDelDia(PANEL)
    expect(tareas.map((t) => t.clave)).toEqual([
      'recibos-devueltos', 'noticias-borrador', 'hermanos-sin-numero', 'citas-reparto',
    ])
    expect(tareas.map((t) => t.cargo)).toEqual(['Tesorería', 'Redes', 'Secretaría', 'Secretaría'])
  })

  it('los ordena por prisa: lo urgente primero', () => {
    const prioridades = tareasDelDia(PANEL).map((t) => t.prioridad)
    expect(prioridades).toEqual(['urgente', 'pendiente', 'pendiente', 'programado'])
  })

  it('cada estado lleva color y texto, nunca color solo', () => {
    for (const tarea of tareasDelDia(PANEL)) {
      expect(tarea.etiqueta).toMatch(/^(Urgente|Pendiente|Programado)$/)
    }
  })

  it('cuenta en singular cuando solo hay uno', () => {
    const uno = { ...PANEL, censo: { ...PANEL.censo, sinNumeroHermano: 1 } } as PanelResponse
    const tarea = tareasDelDia(uno).find((t) => t.clave === 'hermanos-sin-numero')!
    expect(tarea.titulo).toBe('1 hermano sin número de hermano')
  })

  it('sin nada pendiente, ningún asunto', () => {
    expect(tareasDelDia(vacio)).toEqual([])
  })

  it('el reparto no lleva botón: todavía no hay pantalla de turnos', () => {
    const reparto = tareasDelDia(PANEL).find((t) => t.clave === 'citas-reparto')!
    expect(reparto.accion).toBeNull()
  })

  it('los asuntos con pantalla apuntan a la suya', () => {
    const porClave = Object.fromEntries(tareasDelDia(PANEL).map((t) => [t.clave, t.accion?.href]))
    expect(porClave['recibos-devueltos']).toBe('/cms/tesoreria')
    expect(porClave['noticias-borrador']).toBe('/cms/noticias')
    expect(porClave['hermanos-sin-numero']).toBe('/cms/hermanos')
  })
})

describe('repartirTareas', () => {
  it('el Hermano Mayor y el Administrador lo llevan todo', () => {
    for (const role of ['ADMIN', 'HERMANO_MAYOR']) {
      const { tuyas, deLaJunta } = repartirTareas(tareasDelDia(PANEL), role)
      expect(tuyas).toHaveLength(4)
      expect(deLaJunta).toHaveLength(0)
    }
  })

  it('un cargo acotado ve lo suyo con botón y el resto sin él', () => {
    const { tuyas, deLaJunta } = repartirTareas(tareasDelDia(PANEL), 'REDES')
    expect(tuyas.map((t) => t.clave)).toEqual(['noticias-borrador'])
    expect(deLaJunta.map((t) => t.cargo)).toEqual(['Tesorería', 'Secretaría', 'Secretaría'])
  })

  it('Secretaría lleva dos asuntos, uno de ellos sin botón', () => {
    const { tuyas } = repartirTareas(tareasDelDia(PANEL), 'SECRETARIA')
    expect(tuyas.map((t) => t.clave)).toEqual(['hermanos-sin-numero', 'citas-reparto'])
    expect(tuyas[1].accion).toBeNull()
  })

  it('sin cargo (aún cargando la sesión) no se atribuye nada', () => {
    const { tuyas, deLaJunta } = repartirTareas(tareasDelDia(PANEL), undefined)
    expect(tuyas).toHaveLength(0)
    expect(deLaJunta).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/cms/inicio`
Expected: FAIL, «Failed to resolve import '../tareas'».

- [ ] **Step 3: Write minimal implementation**

Mover el fichero de plural tal cual y arreglar el único import que lo sigue:

```bash
mkdir -p desamparados-web/src/features/cms/inicio
rtk git mv desamparados-web/src/features/cms/panel/plural.ts desamparados-web/src/features/cms/inicio/plural.ts
```

En `src/features/cms/PanelPage.tsx`, cambiar `from './panel/plural'` por `from './inicio/plural'` (una línea; la página se reescribe entera en la Task 17, pero así el proyecto sigue compilando entre una tarea y otra).

Y escribir:

```ts
// src/features/cms/inicio/tareas.ts
import type { PanelResponse } from '../../../lib/api/panel'
import { contar } from './plural'

/**
 * «Para hoy»: lo que hay que hacer, sacado de lo que ya devuelve /api/panel.
 *
 * Vive aparte del JSX porque es la única parte del Inicio con reglas de verdad
 * —qué es urgente, quién lo lleva, quién ve el botón— y así se prueba sola.
 */
export type Prioridad = 'urgente' | 'pendiente' | 'programado'

const ETIQUETA: Record<Prioridad, string> = {
  urgente: 'Urgente',
  pendiente: 'Pendiente',
  programado: 'Programado',
}

export interface Tarea {
  clave: string
  prioridad: Prioridad
  /** El estado en palabras: el color nunca va solo. */
  etiqueta: string
  titulo: string
  detalle: string
  /** Cargo que lo lleva, tal y como se enseña. */
  cargo: string
  /** Roles que pueden actuar sobre él (los mismos que la guarda de su pantalla). */
  roles: string[]
  /** `null` cuando todavía no hay pantalla a la que ir. */
  accion: { texto: string; href: string } | null
}

const CONTENIDO = ['ADMIN', 'REDES', 'HERMANO_MAYOR']
const SECRETARIA = ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR']
const TESORERIA = ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR']

export function tareasDelDia(panel: PanelResponse): Tarea[] {
  const tareas: Tarea[] = []

  const devueltos = panel.dinero.porEstado.find((e) => e.estado === 'DEVUELTO')?.total ?? 0
  if (devueltos > 0) {
    tareas.push({
      clave: 'recibos-devueltos',
      prioridad: 'urgente',
      etiqueta: ETIQUETA.urgente,
      titulo: contar(devueltos, 'recibo devuelto', 'recibos devueltos'),
      detalle: `Tesorería · ejercicio ${panel.ejercicio.anio}`,
      cargo: 'Tesorería',
      roles: TESORERIA,
      accion: { texto: 'Revisar', href: '/cms/tesoreria' },
    })
  }

  const borradores = panel.actividad.noticias.borradores
  if (borradores > 0) {
    tareas.push({
      clave: 'noticias-borrador',
      prioridad: 'pendiente',
      etiqueta: ETIQUETA.pendiente,
      titulo: contar(borradores, 'noticia en borrador', 'noticias en borrador'),
      detalle: 'Noticias · sin publicar',
      cargo: 'Redes',
      roles: CONTENIDO,
      accion: { texto: 'Publicar', href: '/cms/noticias' },
    })
  }

  const sinNumero = panel.censo.sinNumeroHermano
  if (sinNumero > 0) {
    tareas.push({
      clave: 'hermanos-sin-numero',
      prioridad: 'pendiente',
      etiqueta: ETIQUETA.pendiente,
      titulo: `${contar(sinNumero, 'hermano', 'hermanos')} sin número de hermano`,
      detalle: 'Hermanos · altas recientes',
      cargo: 'Secretaría',
      roles: SECRETARIA,
      accion: { texto: 'Asignar', href: '/cms/hermanos' },
    })
  }

  const { citasReservadas, turnosProximos, capacidadEstimada } = panel.actividad.reparto
  if (citasReservadas > 0 || turnosProximos > 0) {
    tareas.push({
      clave: 'citas-reparto',
      prioridad: 'programado',
      etiqueta: ETIQUETA.programado,
      titulo: contar(citasReservadas, 'cita de reparto', 'citas de reparto'),
      detalle: `Reparto · ${contar(turnosProximos, 'turno próximo', 'turnos próximos')}, capacidad para ${capacidadEstimada}`,
      cargo: 'Secretaría',
      roles: SECRETARIA,
      // El CMS todavía no tiene pantalla de turnos de reparto: sin sitio al que
      // ir, el asunto informa y no ofrece botón a nadie.
      accion: null,
    })
  }

  return tareas
}

/**
 * Lo tuyo, con botón; lo del resto de la junta, con «Lo lleva X». ADMIN y
 * HERMANO_MAYOR están en las tres listas de roles, así que lo llevan todo.
 */
export function repartirTareas(tareas: Tarea[], role?: string) {
  const tuyas = tareas.filter((t) => role !== undefined && t.roles.includes(role))
  const deLaJunta = tareas.filter((t) => !tuyas.includes(t))
  return { tuyas, deLaJunta }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/cms/inicio`
Expected: PASS, los once casos.

- [ ] **Step 5: Commit**

```bash
rtk git add desamparados-web/src/features/cms/inicio desamparados-web/src/features/cms/panel
rtk git commit -m "Sacar de los datos del panel los asuntos de cada cargo"
```

---

### Task 13: Las gráficas que ya había, leyendo el tema

`LineaTemporal` gana eje con valores y el primer y el último punto escritos; `BarrasHorizontales`, formato de valor. Las dos dejan de coger su color de una constante global.

**Files:**
- Modify: `desamparados-web/src/components/charts/LineaTemporal.tsx`
- Modify: `desamparados-web/src/components/charts/BarrasHorizontales.tsx`
- Create: `desamparados-web/src/components/charts/TablaDeDatos.tsx`
- Test: `desamparados-web/src/components/charts/__tests__/LineaTemporal.test.tsx` (reescribir)
- Test: `desamparados-web/src/components/charts/__tests__/BarrasHorizontales.test.tsx` (ampliar)
- Test: `desamparados-web/src/components/charts/__tests__/TablaDeDatos.test.tsx` (nuevo)

**Interfaces:**
- Consumes: `GraficasCms` de `src/theme/cms.ts`.
- Produces:
  - `<LineaTemporal puntos etiqueta paleta color? formatoValor? etiquetaX? />`
  - `<BarrasHorizontales filas color? formatoValor? />`
  - `<TablaDeDatos titulo columnas filas />`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/charts/__tests__/TablaDeDatos.test.tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import TablaDeDatos from '../TablaDeDatos'

// Las consultas van con `hidden: true`: el contenido vive dentro de un
// `<details>` plegado y jsdom no implementa el plegado igual que un navegador,
// así que comprobar la apertura a golpe de clic sería probar a jsdom, no a
// nuestro componente. Lo que importa es que la tabla esté y diga lo mismo.
describe('TablaDeDatos', () => {
  it('ofrece la tabla detrás de «Ver tabla»', () => {
    renderWithProviders(
      <TablaDeDatos titulo="Censo de hermanos" columnas={['Mes', 'Activos']} filas={[['Enero', 1253]]} />,
    )
    expect(screen.getByText('Ver tabla')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Activos', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '1253', hidden: true })).toBeInTheDocument()
  })

  it('las cifras de la tabla son las mismas que le llegan', () => {
    renderWithProviders(
      <TablaDeDatos titulo="Papeletas" columnas={['Año', 'Total']} filas={[['2025', '604'], ['2026', '612']]} />,
    )
    expect(screen.getByRole('cell', { name: '604', hidden: true })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '612', hidden: true })).toBeInTheDocument()
  })

  it('sin filas no pinta nada: la gráfica ya dice que no hay datos', () => {
    const { container } = renderWithProviders(
      <TablaDeDatos titulo="Vacía" columnas={['Mes', 'Activos']} filas={[]} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
```

```tsx
// src/components/charts/__tests__/LineaTemporal.test.tsx (reescrito)
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import LineaTemporal from '../LineaTemporal'
import { graficasCms } from '../../../theme/cms'

const paleta = graficasCms('claro')
const puntos = [
  { x: '2025-10', y: 1253 },
  { x: '2026-08', y: 1282 },
  { x: '2026-09', y: 1284 },
]

describe('LineaTemporal', () => {
  it('escribe el primer y el último valor, para no depender del ratón', () => {
    renderWithProviders(<LineaTemporal puntos={puntos} etiqueta="Hermanos activos" paleta={paleta} />)
    expect(screen.getByText('1253')).toBeInTheDocument()
    expect(screen.getByText('1284')).toBeInTheDocument()
  })

  it('describe la serie para quien no ve el dibujo', () => {
    renderWithProviders(<LineaTemporal puntos={puntos} etiqueta="Hermanos activos" paleta={paleta} />)
    expect(screen.getByRole('img')).toHaveAccessibleName(/Hermanos activos: de 1253 a 1284/)
  })

  it('pinta el eje con sus marcas y sus valores', () => {
    const { container } = renderWithProviders(
      <LineaTemporal puntos={puntos} etiqueta="Hermanos activos" paleta={paleta} />,
    )
    expect(container.querySelectorAll('line').length).toBeGreaterThanOrEqual(3)
    // Las marcas son números redondos, no los datos.
    expect(screen.getByText('1240')).toBeInTheDocument()
  })

  it('usa el color que le da el tema, no una constante suya', () => {
    const { container } = renderWithProviders(
      <LineaTemporal puntos={puntos} etiqueta="Hermanos" paleta={graficasCms('oscuro')} />,
    )
    expect(container.querySelector('[data-testid="linea"]')).toHaveAttribute('stroke', '#ffffff')
  })

  it('formatea los valores si se le pide', () => {
    renderWithProviders(
      <LineaTemporal puntos={puntos} etiqueta="Saldo" paleta={paleta} formatoValor={(v) => `${v} €`} />,
    )
    expect(screen.getByText('1284 €')).toBeInTheDocument()
  })

  it('con una serie vacía lo dice y no revienta', () => {
    renderWithProviders(<LineaTemporal puntos={[]} etiqueta="Hermanos activos" paleta={paleta} />)
    expect(screen.getByText(/todavía no hay datos/i)).toBeInTheDocument()
  })

  it('aguanta una serie plana sin dividir por cero', () => {
    const planos = [{ x: 'a', y: 7 }, { x: 'b', y: 7 }]
    const { container } = renderWithProviders(
      <LineaTemporal puntos={planos} etiqueta="Plano" paleta={paleta} />,
    )
    expect(container.querySelector('[data-testid="linea"]')?.getAttribute('d')).not.toContain('NaN')
  })
})
```

```tsx
// src/components/charts/__tests__/BarrasHorizontales.test.tsx — casos nuevos
  it('formatea el valor si se le pide, para poder poner euros', () => {
    renderWithProviders(
      <BarrasHorizontales
        filas={[{ etiqueta: 'Cultos', valor: 9800 }]}
        formatoValor={(v) => `${v.toLocaleString('es-ES')} €`}
      />,
    )
    expect(screen.getByText('9.800 €')).toBeInTheDocument()
  })

  it('ordena de mayor a menor quien se las pasa, y las pinta en ese orden', () => {
    renderWithProviders(
      <BarrasHorizontales filas={[{ etiqueta: 'A', valor: 30 }, { etiqueta: 'B', valor: 10 }]} />,
    )
    const etiquetas = screen.getAllByText(/^[AB]$/).map((n) => n.textContent)
    expect(etiquetas).toEqual(['A', 'B'])
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/charts`
Expected: FAIL: `TablaDeDatos` no existe y `LineaTemporal` no acepta `paleta` ni escribe el primer valor.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/charts/TablaDeDatos.tsx
import { Box, Typography } from '@mui/material'

interface Props {
  titulo: string
  columnas: string[]
  filas: (string | number)[][]
}

/**
 * Los mismos datos de la gráfica, en tabla. Va plegada en un `<details>`: el
 * resumen ya es un control con teclado y no hace falta estado ni diálogo.
 */
export default function TablaDeDatos({ titulo, columnas, filas }: Props) {
  if (filas.length === 0) return null

  return (
    <Box component="details" sx={{ mt: 0.5 }}>
      <Box
        component="summary"
        sx={{
          cursor: 'pointer', listStyle: 'none', display: 'inline-flex', alignItems: 'center',
          fontSize: 12, fontWeight: 600, color: 'primary.main',
          '&::-webkit-details-marker': { display: 'none' },
        }}
      >
        Ver tabla
      </Box>
      <Box sx={{ mt: 1.5, overflowX: 'auto' }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <Box component="caption" sx={{ textAlign: 'left', pb: 1 }}>
            <Typography variant="caption" color="text.secondary">{titulo}</Typography>
          </Box>
          <thead>
            <tr>
              {columnas.map((columna, i) => (
                <Box
                  key={columna}
                  component="th"
                  scope="col"
                  sx={{
                    textAlign: i === 0 ? 'left' : 'right', py: 0.75, px: 1,
                    borderBottom: 1, borderColor: 'divider', color: 'text.secondary', fontWeight: 600,
                  }}
                >
                  {columna}
                </Box>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={String(fila[0])}>
                {fila.map((celda, i) => (
                  <Box
                    key={columnas[i]}
                    component="td"
                    sx={{
                      textAlign: i === 0 ? 'left' : 'right', py: 0.75, px: 1,
                      borderBottom: 1, borderColor: 'divider',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {celda}
                  </Box>
                ))}
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
    </Box>
  )
}
```

```tsx
// src/components/charts/LineaTemporal.tsx (reescrito)
import { Box, Typography, useTheme } from '@mui/material'
import type { GraficasCms } from '../../theme/cms'

export interface PuntoLinea {
  x: string
  y: number
}

interface Props {
  puntos: PuntoLinea[]
  /** Qué mide la línea. Va en el aria-label y da nombre al gráfico. */
  etiqueta: string
  paleta: GraficasCms
  /** Por defecto, el color de énfasis: esta gráfica no compara nada. */
  color?: string
  formatoValor?: (valor: number) => string
  /** '2026-09' → 'sep'. Por defecto, la clave tal cual. */
  etiquetaX?: (x: string) => string
}

const ANCHO = 488
const ALTO = 232
const IZQ = 50
const DER = 54
const ARRIBA = 18
const ABAJO = 42

/** Paso de eje redondo: 1, 2, 2,5 o 5 por la potencia de diez que toque. */
function pasoBonito(bruto: number) {
  if (bruto <= 0) return 1
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  return ([1, 2, 2.5, 5, 10].find((f) => f * potencia >= bruto) ?? 10) * potencia
}

/** Eje que abarca los datos con marcas en números redondos, unas tres. */
function escala(min: number, max: number) {
  if (max === min) return { suelo: min - 1, techo: min + 1, marcas: [min] }
  const paso = pasoBonito((max - min) / 2)
  const suelo = Math.floor(min / paso) * paso
  const techo = Math.ceil(max / paso) * paso
  const marcas: number[] = []
  for (let v = suelo; v <= techo + paso / 1000; v += paso) marcas.push(Math.round(v * 100) / 100)
  return { suelo, techo, marcas }
}

/**
 * Una serie en el tiempo, con área. Los valores del primero y el último punto
 * van escritos: el ratón añade detalle, pero nunca es la única forma de leer un
 * dato.
 */
export default function LineaTemporal({ puntos, etiqueta, paleta, color, formatoValor, etiquetaX }: Props) {
  const theme = useTheme()

  if (puntos.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        Todavía no hay datos que enseñar aquí.
      </Typography>
    )
  }

  const trazo = color ?? paleta.enfasis
  const texto = (valor: number) => (formatoValor ? formatoValor(valor) : String(valor))
  const enX = etiquetaX ?? ((x: string) => x)

  const valores = puntos.map((p) => p.y)
  const { suelo, techo, marcas } = escala(Math.min(...valores), Math.max(...valores))
  const rango = techo - suelo || 1
  const anchoUtil = ANCHO - IZQ - DER
  const altoUtil = ALTO - ARRIBA - ABAJO

  const X = (i: number) => IZQ + (puntos.length > 1 ? (i * anchoUtil) / (puntos.length - 1) : anchoUtil / 2)
  const Y = (v: number) => ARRIBA + altoUtil - ((v - suelo) / rango) * altoUtil

  const d = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ')
  const primero = puntos[0]
  const ultimo = puntos[puntos.length - 1]

  return (
    <Box sx={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        width="100%"
        role="img"
        aria-label={`${etiqueta}: de ${texto(primero.y)} a ${texto(ultimo.y)}.`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {marcas.map((marca) => (
          <g key={marca}>
            <line x1={IZQ} y1={Y(marca)} x2={ANCHO - DER + 8} y2={Y(marca)} stroke={paleta.rejilla} strokeWidth="1" />
            <text
              x={IZQ - 10}
              y={Y(marca) + 4}
              textAnchor="end"
              fontSize="11"
              fill={theme.palette.text.secondary}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {marca}
            </text>
          </g>
        ))}

        <path d={`${d} L${X(puntos.length - 1).toFixed(1)},${Y(suelo).toFixed(1)} L${X(0).toFixed(1)},${Y(suelo).toFixed(1)} Z`} fill={trazo} opacity="0.1" />
        <path data-testid="linea" d={d} fill="none" stroke={trazo} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Primer punto: la etiqueta va DEBAJO, donde no hay trazo. */}
        <circle cx={X(0)} cy={Y(primero.y)} r="4" fill={trazo} stroke={theme.palette.background.paper} strokeWidth="2" />
        <text x={X(0) + 8} y={Y(primero.y) + 20} fontSize="12" fontWeight="600" fill={theme.palette.text.secondary}>
          {texto(primero.y)}
        </text>

        <circle cx={X(puntos.length - 1)} cy={Y(ultimo.y)} r="5" fill={trazo} stroke={theme.palette.background.paper} strokeWidth="2" />
        <text x={X(puntos.length - 1) + 10} y={Y(ultimo.y) + 4} fontSize="13" fontWeight="700" fill={theme.palette.text.primary}>
          {texto(ultimo.y)}
        </text>

        {puntos.map((p, i) => (
          <text key={p.x} x={X(i)} y={ALTO - ABAJO + 18} textAnchor="middle" fontSize="11" fill={theme.palette.text.secondary}>
            {enX(p.x)}
          </text>
        ))}
      </svg>
    </Box>
  )
}
```

En `BarrasHorizontales.tsx`, dos cambios: el formato de valor y una etiqueta más ancha.

```tsx
interface Props {
  filas: FilaBarra[]
  color?: string
  /** Por defecto, el número tal cual; con euros, el importe formateado. */
  formatoValor?: (valor: number) => string
}
```

```tsx
export default function BarrasHorizontales({ filas, color, formatoValor }: Props) {
  // ... el mismo cuerpo, con:
  const relleno = color ?? designTokens.dataviz.series[0]
  // ...
        <Box
          key={fila.etiqueta}
          sx={{ display: 'grid', gridTemplateColumns: '176px minmax(0, 1fr) auto', alignItems: 'center', gap: 1.5 }}
        >
  // ... y en la celda del valor:
          <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {formatoValor ? formatoValor(fila.valor) : fila.valor}
          </Typography>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/charts`
Expected: PASS. `PanelPage.test.tsx` seguirá roto (usa la API antigua de `LineaTemporal`); se reescribe en la Task 17.

- [ ] **Step 5: Commit**

```bash
rtk git add desamparados-web/src/components/charts
rtk git commit -m "Dar eje, valores escritos y color del tema a las gráficas existentes"
```

---

### Task 14: Las cuatro gráficas nuevas

Columnas divergentes (altas y bajas), columnas por pares (ingresos y gastos, con detalle al pasar el ratón), columnas por año (papeletas) y proporción de estados (cobro de recibos). Todas en SVG propio, sin librerías.

**Files:**
- Create: `desamparados-web/src/components/charts/ColumnasDivergentes.tsx`
- Create: `desamparados-web/src/components/charts/ColumnasPorPares.tsx`
- Create: `desamparados-web/src/components/charts/ColumnasPorAnio.tsx`
- Create: `desamparados-web/src/components/charts/ProporcionEstados.tsx`
- Create: `desamparados-web/src/components/charts/ejes.ts`
- Test: `desamparados-web/src/components/charts/__tests__/ColumnasDivergentes.test.tsx`
- Test: `desamparados-web/src/components/charts/__tests__/ColumnasPorPares.test.tsx`
- Test: `desamparados-web/src/components/charts/__tests__/ColumnasPorAnio.test.tsx`
- Test: `desamparados-web/src/components/charts/__tests__/ProporcionEstados.test.tsx`

**Interfaces:**
- Consumes: `GraficasCms`.
- Produces:
  - `ejes.ts`: `pasoBonito(bruto: number): number`, `escalaDesdeCero(maximo: number): { techo: number; marcas: number[] }`
  - `<ColumnasDivergentes meses paleta etiquetaArriba etiquetaAbajo etiquetaX? />` con `meses: { mes: string; arriba: number; abajo: number }[]`
  - `<ColumnasPorPares puntos paleta etiquetaA etiquetaB formatoValor etiquetaX etiquetaXLarga />` con `puntos: { clave: string; a: number; b: number }[]`
  - `<ColumnasPorAnio datos paleta destacado />` con `datos: { anio: number; total: number }[]`
  - `<ProporcionEstados estados paleta formatoImporte />` con `estados: { clave; etiqueta; total; importe; estado: 'ok'|'aviso'|'error' }[]`

> `pasoBonito` está repetido en `LineaTemporal.tsx` (Task 13). Al crear `ejes.ts`, **muévelo allí** y que `LineaTemporal` lo importe: es la misma función y una copia acabaría divergiendo.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/charts/__tests__/ColumnasDivergentes.test.tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import ColumnasDivergentes from '../ColumnasDivergentes'
import { graficasCms } from '../../../theme/cms'

const paleta = graficasCms('claro')
const meses = [
  { mes: '2026-01', arriba: 5, abajo: 1 },
  { mes: '2026-02', arriba: 6, abajo: 3 },
  { mes: '2026-03', arriba: 7, abajo: 3 },
]

describe('ColumnasDivergentes', () => {
  it('lleva leyenda con los totales de cada serie', () => {
    renderWithProviders(
      <ColumnasDivergentes meses={meses} paleta={paleta} etiquetaArriba="Altas" etiquetaAbajo="Bajas" />,
    )
    expect(screen.getByText('Altas')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument() // 5+6+7
    expect(screen.getByText('Bajas')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument() // 1+3+3
  })

  it('pinta el cero y las columnas a sus dos lados', () => {
    const { container } = renderWithProviders(
      <ColumnasDivergentes meses={meses} paleta={paleta} etiquetaArriba="Altas" etiquetaAbajo="Bajas" />,
    )
    expect(container.querySelectorAll('[data-testid="columna-arriba"]')).toHaveLength(3)
    expect(container.querySelectorAll('[data-testid="columna-abajo"]')).toHaveLength(3)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('un mes sin movimiento no pinta columna, pero sigue ocupando su sitio', () => {
    const conHueco = [{ mes: '2026-01', arriba: 0, abajo: 0 }, ...meses]
    const { container } = renderWithProviders(
      <ColumnasDivergentes meses={conHueco} paleta={paleta} etiquetaArriba="Altas" etiquetaAbajo="Bajas" />,
    )
    expect(container.querySelectorAll('[data-testid="columna-arriba"]')).toHaveLength(3)
  })

  it('sin datos lo dice', () => {
    renderWithProviders(
      <ColumnasDivergentes meses={[]} paleta={paleta} etiquetaArriba="Altas" etiquetaAbajo="Bajas" />,
    )
    expect(screen.getByText(/todavía no hay datos/i)).toBeInTheDocument()
  })
})
```

```tsx
// src/components/charts/__tests__/ColumnasPorPares.test.tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import ColumnasPorPares from '../ColumnasPorPares'
import { graficasCms } from '../../../theme/cms'

const paleta = graficasCms('claro')
const puntos = [
  { clave: '2026-01', a: 9800, b: 3100 },
  { clave: '2026-03', a: 3900, b: 9400 },
]
const props = {
  puntos,
  paleta,
  etiquetaA: 'Ingresos',
  etiquetaB: 'Gastos',
  formatoValor: (v: number) => `${v} €`,
  etiquetaX: (c: string) => c.slice(5),
  etiquetaXLarga: (c: string) => `mes ${c.slice(5)}`,
}

describe('ColumnasPorPares', () => {
  it('pinta dos columnas por punto y el eje en euros', () => {
    const { container } = renderWithProviders(<ColumnasPorPares {...props} />)
    expect(container.querySelectorAll('[data-testid="columna"]')).toHaveLength(4)
    expect(screen.getByText('0 €')).toBeInTheDocument()
  })

  it('al pasar el ratón por un mes enseña sus dos cifras', async () => {
    const { container } = renderWithProviders(<ColumnasPorPares {...props} />)
    await userEvent.hover(container.querySelectorAll('[data-testid="zona"]')[1])
    expect(screen.getByText('mes 03')).toBeInTheDocument()
    expect(screen.getByText(/3900 €/)).toBeInTheDocument()
    expect(screen.getByText(/9400 €/)).toBeInTheDocument()
  })

  it('sin pasar el ratón ya se lee el máximo de cada serie', () => {
    renderWithProviders(<ColumnasPorPares {...props} />)
    expect(screen.getByText('9800 €')).toBeInTheDocument()
    expect(screen.getByText('9400 €')).toBeInTheDocument()
  })

  it('sin datos lo dice', () => {
    renderWithProviders(<ColumnasPorPares {...props} puntos={[]} />)
    expect(screen.getByText(/todavía no hay datos/i)).toBeInTheDocument()
  })
})
```

```tsx
// src/components/charts/__tests__/ColumnasPorAnio.test.tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import ColumnasPorAnio from '../ColumnasPorAnio'
import { graficasCms } from '../../../theme/cms'

const paleta = graficasCms('claro')
const datos = [
  { anio: 2022, total: 548 },
  { anio: 2023, total: 571 },
  { anio: 2026, total: 612 },
]

describe('ColumnasPorAnio', () => {
  it('escribe el valor sobre cada columna y el año debajo', () => {
    renderWithProviders(<ColumnasPorAnio datos={datos} paleta={paleta} destacado={2026} />)
    for (const texto of ['548', '571', '612', '2022', '2023', '2026']) {
      expect(screen.getByText(texto)).toBeInTheDocument()
    }
  })

  it('destaca el ejercicio elegido y deja el resto en gris', () => {
    const { container } = renderWithProviders(
      <ColumnasPorAnio datos={datos} paleta={paleta} destacado={2026} />,
    )
    const columnas = container.querySelectorAll('[data-testid="columna"]')
    expect(columnas[2]).toHaveAttribute('fill', paleta.enfasis)
    expect(columnas[0]).toHaveAttribute('fill', paleta.contexto)
  })

  it('si el año destacado no está en los datos, no destaca ninguno', () => {
    const { container } = renderWithProviders(
      <ColumnasPorAnio datos={datos} paleta={paleta} destacado={2019} />,
    )
    const colores = [...container.querySelectorAll('[data-testid="columna"]')].map((c) => c.getAttribute('fill'))
    expect(colores.every((c) => c === paleta.contexto)).toBe(true)
  })

  it('sin datos lo dice', () => {
    renderWithProviders(<ColumnasPorAnio datos={[]} paleta={paleta} destacado={2026} />)
    expect(screen.getByText(/todavía no hay datos/i)).toBeInTheDocument()
  })
})
```

```tsx
// src/components/charts/__tests__/ProporcionEstados.test.tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import ProporcionEstados from '../ProporcionEstados'
import { graficasCms } from '../../../theme/cms'

const paleta = graficasCms('claro')
const estados = [
  { clave: 'PAGADO', etiqueta: 'Cobrados', total: 1126, importe: 33780, estado: 'ok' as const },
  { clave: 'PENDIENTE', etiqueta: 'Pendientes', total: 57, importe: 1710, estado: 'aviso' as const },
  { clave: 'DEVUELTO', etiqueta: 'Devueltos por el banco', total: 14, importe: 420, estado: 'error' as const },
]
const euros = (v: number) => `${v} €`

describe('ProporcionEstados', () => {
  it('enseña el porcentaje cobrado con su cuenta', () => {
    renderWithProviders(<ProporcionEstados estados={estados} paleta={paleta} formatoImporte={euros} />)
    expect(screen.getByText('94 %')).toBeInTheDocument()
    expect(screen.getByText(/1126 de 1197/)).toBeInTheDocument()
  })

  it('cada estado lleva texto, número e importe, no solo color', () => {
    renderWithProviders(<ProporcionEstados estados={estados} paleta={paleta} formatoImporte={euros} />)
    expect(screen.getByText('Devueltos por el banco')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
    expect(screen.getByText('420 €')).toBeInTheDocument()
  })

  it('sin recibos no divide por cero', () => {
    renderWithProviders(<ProporcionEstados estados={[]} paleta={paleta} formatoImporte={euros} />)
    expect(screen.getByText(/todavía no hay datos/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/charts`
Expected: FAIL, los cuatro componentes no existen.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/components/charts/ejes.ts
/** Paso de eje redondo: 1, 2, 2,5 o 5 por la potencia de diez que toque. */
export function pasoBonito(bruto: number): number {
  if (bruto <= 0) return 1
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  return ([1, 2, 2.5, 5, 10].find((f) => f * potencia >= bruto) ?? 10) * potencia
}

/** Eje que arranca en cero con marcas redondas, unas cuatro divisiones. */
export function escalaDesdeCero(maximo: number): { techo: number; marcas: number[] } {
  if (maximo <= 0) return { techo: 1, marcas: [0, 1] }
  const paso = pasoBonito(maximo / 4)
  const techo = paso * Math.ceil(maximo / paso)
  return { techo, marcas: Array.from({ length: Math.round(techo / paso) + 1 }, (_, i) => i * paso) }
}

/** Columna apoyada en la base con los dos cantos del extremo redondeados. */
export function columna(x: number, base: number, tope: number, ancho: number): string {
  const alto = Math.abs(base - tope)
  if (alto < 0.5) return ''
  const haciaAbajo = tope > base
  const r = Math.min(4, alto, ancho / 2)
  return haciaAbajo
    ? `M${x},${base} H${x + ancho} V${tope - r} Q${x + ancho},${tope} ${x + ancho - r},${tope} H${x + r} Q${x},${tope} ${x},${tope - r} Z`
    : `M${x},${base} V${tope + r} Q${x},${tope} ${x + r},${tope} H${x + ancho - r} Q${x + ancho},${tope} ${x + ancho},${tope + r} V${base} Z`
}
```

```tsx
// src/components/charts/ColumnasDivergentes.tsx
import { Box, Typography, useTheme } from '@mui/material'
import type { GraficasCms } from '../../theme/cms'
import { columna, pasoBonito } from './ejes'

export interface MesDivergente {
  mes: string
  arriba: number
  abajo: number
}

interface Props {
  meses: MesDivergente[]
  paleta: GraficasCms
  etiquetaArriba: string
  etiquetaAbajo: string
  etiquetaX?: (mes: string) => string
}

const ANCHO = 488
const ALTO = 232
const IZQ = 38
const DER = 10
const ARRIBA = 20
const ABAJO = 42

/**
 * Lo que entra arriba del cero y lo que sale debajo. Es la forma que deja ver
 * de un vistazo si un mes fue de crecimiento o de pérdida: dos series apiladas
 * en el mismo lado obligarían a restar a ojo.
 */
export default function ColumnasDivergentes({ meses, paleta, etiquetaArriba, etiquetaAbajo, etiquetaX }: Props) {
  const theme = useTheme()

  if (meses.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        Todavía no hay datos que enseñar aquí.
      </Typography>
    )
  }

  const totalArriba = meses.reduce((s, m) => s + m.arriba, 0)
  const totalAbajo = meses.reduce((s, m) => s + m.abajo, 0)
  const enX = etiquetaX ?? ((mes: string) => mes)

  const paso = pasoBonito(Math.max(1, ...meses.map((m) => Math.max(m.arriba, m.abajo))) / 2)
  const techo = paso * Math.ceil(Math.max(1, ...meses.map((m) => m.arriba)) / paso)
  const suelo = -paso * Math.ceil(Math.max(1, ...meses.map((m) => m.abajo)) / paso)
  const altoUtil = ALTO - ARRIBA - ABAJO
  const Y = (v: number) => ARRIBA + ((techo - v) / (techo - suelo)) * altoUtil

  const ranura = (ANCHO - IZQ - DER) / meses.length
  const anchoColumna = Math.min(16, ranura * 0.55)

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.25, mb: 1, fontSize: 13 }}>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.875 }}>
          <Box component="span" sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: paleta.entrada }} />
          <Typography component="span" variant="body2" color="text.secondary">{etiquetaArriba}</Typography>
          <Typography component="strong" variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{totalArriba}</Typography>
        </Box>
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.875 }}>
          <Box component="span" sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: paleta.salida }} />
          <Typography component="span" variant="body2" color="text.secondary">{etiquetaAbajo}</Typography>
          <Typography component="strong" variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{totalAbajo}</Typography>
        </Box>
      </Box>

      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        width="100%"
        role="img"
        aria-label={`${etiquetaArriba}: ${totalArriba}. ${etiquetaAbajo}: ${totalAbajo}.`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {[techo, suelo].map((marca) => (
          <g key={marca}>
            <line x1={IZQ} y1={Y(marca)} x2={ANCHO - DER} y2={Y(marca)} stroke={paleta.rejilla} strokeWidth="1" />
            <text x={IZQ - 8} y={Y(marca) + 4} textAnchor="end" fontSize="11" fill={theme.palette.text.secondary}>
              {marca > 0 ? `+${marca}` : `−${-marca}`}
            </text>
          </g>
        ))}
        <line x1={IZQ} y1={Y(0)} x2={ANCHO - DER} y2={Y(0)} stroke={paleta.cero} strokeWidth="1" />
        <text x={IZQ - 8} y={Y(0) + 4} textAnchor="end" fontSize="11" fill={theme.palette.text.secondary}>0</text>

        {meses.map((m, i) => {
          const x = IZQ + ranura * i + (ranura - anchoColumna) / 2
          return (
            <g key={m.mes}>
              {m.arriba > 0 && (
                <path data-testid="columna-arriba" d={columna(x, Y(0) - 1, Y(m.arriba), anchoColumna)} fill={paleta.entrada} />
              )}
              {m.abajo > 0 && (
                <path data-testid="columna-abajo" d={columna(x, Y(0) + 1, Y(-m.abajo), anchoColumna)} fill={paleta.salida} />
              )}
              <text x={x + anchoColumna / 2} y={ALTO - ABAJO + 18} textAnchor="middle" fontSize="11" fill={theme.palette.text.secondary}>
                {enX(m.mes)}
              </text>
            </g>
          )
        })}
      </svg>
    </Box>
  )
}
```

```tsx
// src/components/charts/ColumnasPorPares.tsx
import { useState } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import type { GraficasCms } from '../../theme/cms'
import { columna, escalaDesdeCero } from './ejes'

export interface PuntoPar {
  clave: string
  a: number
  b: number
}

interface Props {
  puntos: PuntoPar[]
  paleta: GraficasCms
  etiquetaA: string
  etiquetaB: string
  formatoValor: (valor: number) => string
  etiquetaX: (clave: string) => string
  /** Para el detalle del ratón: «marzo de 2026». */
  etiquetaXLarga: (clave: string) => string
}

const ANCHO = 1042
const ALTO = 300
const IZQ = 66
const DER = 12
const ARRIBA = 24
const ABAJO = 30

/**
 * Dos series emparejadas por periodo, en la misma escala. Los picos de cada
 * serie van escritos aunque nadie pase el ratón; el emergente añade el detalle
 * del mes señalado, pero no es la única forma de leer la gráfica.
 */
export default function ColumnasPorPares({
  puntos, paleta, etiquetaA, etiquetaB, formatoValor, etiquetaX, etiquetaXLarga,
}: Props) {
  const theme = useTheme()
  const [activo, setActivo] = useState<number | null>(null)

  if (puntos.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        Todavía no hay datos que enseñar aquí.
      </Typography>
    )
  }

  const eje = escalaDesdeCero(Math.max(0, ...puntos.flatMap((p) => [p.a, p.b])))
  const altoUtil = ALTO - ARRIBA - ABAJO
  const Y = (v: number) => ARRIBA + altoUtil - (v / eje.techo) * altoUtil
  const ranura = (ANCHO - IZQ - DER) / puntos.length
  const ancho = Math.min(22, (ranura - 12) / 2)

  const picoDe = (lado: 'a' | 'b') =>
    puntos.reduce((mejor, p, i) => (p[lado] > puntos[mejor][lado] ? i : mejor), 0)

  return (
    <Box sx={{ width: '100%', position: 'relative' }}>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        width="100%"
        role="img"
        aria-label={`${etiquetaA} y ${etiquetaB} por periodo.`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {eje.marcas.map((marca) => (
          <g key={marca}>
            <line x1={IZQ} y1={Y(marca)} x2={ANCHO - DER} y2={Y(marca)} stroke={marca === 0 ? paleta.cero : paleta.rejilla} strokeWidth="1" />
            <text x={IZQ - 12} y={Y(marca) + 4} textAnchor="end" fontSize="11" fill={theme.palette.text.secondary} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatoValor(marca)}
            </text>
          </g>
        ))}

        {puntos.map((p, i) => {
          const centro = IZQ + ranura * i + ranura / 2
          return (
            <g key={p.clave} onMouseEnter={() => setActivo(i)} onMouseLeave={() => setActivo(null)}>
              {activo === i && (
                <rect x={IZQ + ranura * i + 4} y={ARRIBA - 10} width={ranura - 8} height={altoUtil + 10} rx="8" fill={paleta.banda} />
              )}
              {/* Zona de ratón más ancha que las columnas. */}
              <rect data-testid="zona" x={IZQ + ranura * i} y={ARRIBA - 10} width={ranura} height={altoUtil + 30} fill="transparent" />
              <path data-testid="columna" d={columna(centro - ancho - 1, Y(0), Y(p.a), ancho)} fill={paleta.entrada} />
              <path data-testid="columna" d={columna(centro + 1, Y(0), Y(p.b), ancho)} fill={paleta.salida} />
              <text x={centro} y={ALTO - 8} textAnchor="middle" fontSize="12" fill={activo === i ? theme.palette.text.primary : theme.palette.text.secondary} fontWeight={activo === i ? 700 : 400}>
                {etiquetaX(p.clave)}
              </text>
            </g>
          )
        })}

        {/* Etiqueta directa en el pico de cada serie, y solo mientras nadie
            señala un mes: con el emergente abierto, la misma cifra saldría dos
            veces. */}
        {(['a', 'b'] as const).map((lado, j) => {
          const i = picoDe(lado)
          const valor = puntos[i][lado]
          if (valor <= 0 || activo !== null) return null
          const centro = IZQ + ranura * i + ranura / 2
          const x = j === 0 ? centro - ancho / 2 - 1 : centro + ancho / 2 + 1
          return (
            <text key={lado} x={x} y={Y(valor) - 8} textAnchor="middle" fontSize="12" fontWeight="700" fill={theme.palette.text.primary}>
              {formatoValor(valor)}
            </text>
          )
        })}
      </svg>

      {activo !== null && (
        <Box
          sx={{
            position: 'absolute', top: 8, left: `${((IZQ + ranura * activo + ranura) / ANCHO) * 100}%`,
            transform: 'translateX(8px)', pointerEvents: 'none', minWidth: 188,
            backgroundColor: 'background.paper', border: 1, borderColor: 'divider',
            borderRadius: 1.25, px: 1.5, py: 1.25, boxShadow: 3, fontSize: 13, zIndex: 1,
          }}
        >
          <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>
            {etiquetaXLarga(puntos[activo].clave)}
          </Typography>
          {([[etiquetaA, puntos[activo].a, paleta.entrada], [etiquetaB, puntos[activo].b, paleta.salida]] as const).map(
            ([texto, valor, color]) => (
              <Box key={texto} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Box component="span" sx={{ width: 12, height: 2, backgroundColor: color }} />
                <Typography component="strong" variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {formatoValor(valor)}
                </Typography>
                <Typography component="span" variant="body2" color="text.secondary">{texto}</Typography>
              </Box>
            ),
          )}
        </Box>
      )}
    </Box>
  )
}
```

```tsx
// src/components/charts/ColumnasPorAnio.tsx
import { Box, Typography, useTheme } from '@mui/material'
import type { GraficasCms } from '../../theme/cms'
import { columna, escalaDesdeCero } from './ejes'

interface Props {
  datos: { anio: number; total: number }[]
  paleta: GraficasCms
  /** El ejercicio elegido: va en tinta, el resto en gris. */
  destacado: number
}

const ANCHO = 488
const ALTO = 232
const IZQ = 40
const DER = 10
const ARRIBA = 26
const ABAJO = 30

/** Una columna por año, con su valor escrito encima: cinco cifras se leen mejor así que en una línea. */
export default function ColumnasPorAnio({ datos, paleta, destacado }: Props) {
  const theme = useTheme()

  if (datos.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        Todavía no hay datos que enseñar aquí.
      </Typography>
    )
  }

  const eje = escalaDesdeCero(Math.max(...datos.map((d) => d.total)))
  const altoUtil = ALTO - ARRIBA - ABAJO
  const Y = (v: number) => ARRIBA + altoUtil - (v / eje.techo) * altoUtil
  const ranura = (ANCHO - IZQ - DER) / datos.length
  const ancho = Math.min(24, ranura * 0.45)

  return (
    <Box sx={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        width="100%"
        role="img"
        aria-label={datos.map((d) => `${d.anio}: ${d.total}`).join('. ')}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* Las marcas intermedias van por debajo de las cifras de cada columna, así nunca las cruzan. */}
        {eje.marcas.filter((m) => m < eje.techo).map((marca) => (
          <g key={marca}>
            <line x1={IZQ} y1={Y(marca)} x2={ANCHO - DER} y2={Y(marca)} stroke={marca === 0 ? paleta.cero : paleta.rejilla} strokeWidth="1" />
            <text x={IZQ - 10} y={Y(marca) + 4} textAnchor="end" fontSize="11" fill={theme.palette.text.secondary}>{marca}</text>
          </g>
        ))}

        {datos.map((d, i) => {
          const x = IZQ + ranura * i + (ranura - ancho) / 2
          const esElegido = d.anio === destacado
          return (
            <g key={d.anio}>
              <path data-testid="columna" d={columna(x, Y(0), Y(d.total), ancho)} fill={esElegido ? paleta.enfasis : paleta.contexto} />
              <text x={x + ancho / 2} y={Y(d.total) - 8} textAnchor="middle" fontSize="12" fontWeight={esElegido ? 700 : 600} fill={esElegido ? theme.palette.text.primary : theme.palette.text.secondary}>
                {d.total}
              </text>
              <text x={x + ancho / 2} y={ALTO - 8} textAnchor="middle" fontSize="12" fontWeight={esElegido ? 700 : 400} fill={esElegido ? theme.palette.text.primary : theme.palette.text.secondary}>
                {d.anio}
              </text>
            </g>
          )
        })}
      </svg>
    </Box>
  )
}
```

```tsx
// src/components/charts/ProporcionEstados.tsx
import { Box, Typography } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ScheduleIcon from '@mui/icons-material/Schedule'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import type { GraficasCms } from '../../theme/cms'

export type ClaveEstado = 'ok' | 'aviso' | 'error'

export interface FilaEstado {
  clave: string
  etiqueta: string
  total: number
  importe: number
  estado: ClaveEstado
}

interface Props {
  estados: FilaEstado[]
  paleta: GraficasCms
  formatoImporte: (valor: number) => string
}

const ICONO = {
  ok: CheckCircleOutlineIcon,
  aviso: ScheduleIcon,
  error: ReportProblemOutlinedIcon,
}

/**
 * Cuánto se ha cobrado y de qué se compone el resto. El verde y el ámbar no
 * llegan a 3:1 sobre el lienzo claro, así que cada estado lleva además icono,
 * texto, número e importe: el color solo acompaña.
 */
export default function ProporcionEstados({ estados, paleta, formatoImporte }: Props) {
  const total = estados.reduce((s, e) => s + e.total, 0)

  if (total === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
        Todavía no hay datos que enseñar aquí.
      </Typography>
    )
  }

  const cobrados = estados.filter((e) => e.estado === 'ok').reduce((s, e) => s + e.total, 0)
  const porcentaje = Math.round((cobrados / total) * 100)
  const visibles = estados.filter((e) => e.total > 0)

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, flexWrap: 'wrap' }}>
        <Typography component="span" sx={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {porcentaje} %
        </Typography>
        <Typography variant="body2" color="text.secondary">
          cobrado · {cobrados} de {total} recibos
        </Typography>
      </Box>

      {/* 2 px de hueco entre segmentos: sin él, dos colores contiguos se leen
          como uno solo cuando el trozo es estrecho. */}
      <Box sx={{ display: 'flex', gap: '2px', height: 14, borderRadius: '7px', overflow: 'hidden', my: 2 }} aria-hidden="true">
        {visibles.map((e) => (
          <Box
            key={e.clave}
            data-testid="segmento"
            sx={{ flexGrow: e.total, flexBasis: 0, minWidth: 6, backgroundColor: paleta.estados[e.estado] }}
          />
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr) auto auto', rowGap: 1.25, columnGap: 1.25, alignItems: 'center', fontSize: 14 }}>
        {estados.map((e) => {
          const Icono = ICONO[e.estado]
          return (
            <Box key={e.clave} sx={{ display: 'contents' }}>
              <Box sx={{ display: 'flex', color: paleta.estados[e.estado] }}><Icono sx={{ fontSize: 18 }} /></Box>
              <Typography variant="body2" color="text.secondary">{e.etiqueta}</Typography>
              <Typography component="strong" variant="body2" sx={{ textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {e.total}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {formatoImporte(e.importe)}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
```

Y en `LineaTemporal.tsx`, borrar la copia local de `pasoBonito` e importarla: `import { pasoBonito } from './ejes'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/charts`
Expected: PASS, los cuatro ficheros nuevos y los dos de la Task 13.

- [ ] **Step 5: Commit**

```bash
rtk git add desamparados-web/src/components/charts
rtk git commit -m "Añadir las cuatro gráficas nuevas del Inicio, en SVG propio"
```

---
### Task 15: Las piezas de la parte de arriba del Inicio

Cabecera, «Para hoy», las cuatro cifras, la cuenta atrás, los próximos actos y la actividad del equipo. Cada una en su fichero, y las dos que tienen reglas (el reparto de asuntos y la frase de actividad) apoyadas en módulos sin JSX.

**Files:**
- Create: `desamparados-web/src/features/cms/inicio/actividad.ts`
- Create: `desamparados-web/src/features/cms/inicio/Cabecera.tsx`
- Create: `desamparados-web/src/features/cms/inicio/ParaHoy.tsx`
- Create: `desamparados-web/src/features/cms/inicio/Cifras.tsx`
- Create: `desamparados-web/src/features/cms/inicio/CuentaAtras.tsx`
- Create: `desamparados-web/src/features/cms/inicio/ProximosActos.tsx`
- Create: `desamparados-web/src/features/cms/inicio/ActividadEquipo.tsx`
- Test: `desamparados-web/src/features/cms/inicio/__tests__/actividad.test.ts`
- Test: `desamparados-web/src/features/cms/inicio/__tests__/ParaHoy.test.tsx`
- Test: `desamparados-web/src/features/cms/inicio/__tests__/CuentaAtras.test.tsx`

**Interfaces:**
- Consumes: `Tarea`, `repartirTareas` (Task 12); `cuentaAtrasEstacion` (Task 11); `useTemaCms` (Task 8); `NOMBRE_CARGO` (Task 10); `euros`, `eurosResumen`, `numero` de `../contabilidad/formato`.
- Produces:
  - `actividad.ts`: `describirAccion(accion: string, entityType: string | null): string`, `cuandoFue(iso: string, ahora: Date): string`
  - `<Cabecera panel role />`, `<ParaHoy tareas role />`, `<Cifras panel />`, `<CuentaAtras hoy? />`, `<ProximosActos eventos />`, `<ActividadEquipo registro role />`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/cms/inicio/__tests__/actividad.test.ts
import { describe, it, expect } from 'vitest'
import { describirAccion, cuandoFue } from '../actividad'

describe('describirAccion', () => {
  it('describe lo que se hizo, sin nombrar el contenido', () => {
    expect(describirAccion('NOTICIA_CREAR', 'noticia')).toBe('creó una noticia')
    expect(describirAccion('EVENTO_ACTUALIZAR', 'evento')).toBe('cambió un acto de la agenda')
    expect(describirAccion('PORTADA_ACTUALIZAR', 'portada')).toBe('cambió la portada')
  })

  it('una acción desconocida no deja la frase coja', () => {
    expect(describirAccion('ACCION_RARA', null)).toBe('hizo un cambio')
  })
})

describe('cuandoFue', () => {
  const ahora = new Date(2026, 8, 11, 12, 0)

  it('lo de hoy lleva la hora', () => {
    expect(cuandoFue(new Date(2026, 8, 11, 10, 5).toISOString(), ahora)).toBe('Hoy 10:05')
  })

  it('lo de ayer lo dice', () => {
    expect(cuandoFue(new Date(2026, 8, 10, 19, 12).toISOString(), ahora)).toBe('Ayer 19:12')
  })

  it('más atrás, el día y el mes', () => {
    expect(cuandoFue(new Date(2026, 8, 9, 11, 5).toISOString(), ahora)).toBe('9 sep')
  })
})
```

```tsx
// src/features/cms/inicio/__tests__/ParaHoy.test.tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import ParaHoy from '../ParaHoy'
import type { Tarea } from '../tareas'

const TAREAS: Tarea[] = [
  {
    clave: 'recibos-devueltos', prioridad: 'urgente', etiqueta: 'Urgente',
    titulo: '14 recibos devueltos', detalle: 'Tesorería · ejercicio 2026',
    cargo: 'Tesorería', roles: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'],
    accion: { texto: 'Revisar', href: '/cms/tesoreria' },
  },
  {
    clave: 'noticias-borrador', prioridad: 'pendiente', etiqueta: 'Pendiente',
    titulo: '2 noticias en borrador', detalle: 'Noticias · sin publicar',
    cargo: 'Redes', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'],
    accion: { texto: 'Publicar', href: '/cms/noticias' },
  },
]

const montar = (tareas: Tarea[], role?: string) =>
  renderWithProviders(<TemaCmsProvider><ParaHoy tareas={tareas} role={role} /></TemaCmsProvider>)

describe('ParaHoy', () => {
  it('el que lleva el asunto ve el botón', () => {
    montar(TAREAS, 'REDES')
    expect(screen.getByRole('link', { name: /Publicar/ })).toHaveAttribute('href', '/cms/noticias')
  })

  it('lo del resto de la junta va sin botón y con quién lo lleva', () => {
    montar(TAREAS, 'REDES')
    expect(screen.getByText('En el resto de la junta')).toBeInTheDocument()
    expect(screen.getByText('Lo lleva Tesorería')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Revisar/ })).not.toBeInTheDocument()
  })

  it('el Hermano Mayor ve todos los botones y ningún «lo lleva»', () => {
    montar(TAREAS, 'HERMANO_MAYOR')
    expect(screen.getByRole('link', { name: /Revisar/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Publicar/ })).toBeInTheDocument()
    expect(screen.queryByText(/Lo lleva/)).not.toBeInTheDocument()
  })

  it('cada estado se lee en palabras, no solo por su color', () => {
    montar(TAREAS, 'ADMIN')
    expect(screen.getByText('Urgente')).toBeInTheDocument()
    expect(screen.getByText('Pendiente')).toBeInTheDocument()
  })

  it('sin asuntos, lo dice y no deja la tarjeta vacía', () => {
    montar([], 'ADMIN')
    expect(screen.getByText(/todo al día/i)).toBeInTheDocument()
  })
})
```

```tsx
// src/features/cms/inicio/__tests__/CuentaAtras.test.tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import CuentaAtras from '../CuentaAtras'

const montar = (hoy: Date) =>
  renderWithProviders(<TemaCmsProvider><CuentaAtras hoy={hoy} /></TemaCmsProvider>)

describe('CuentaAtras', () => {
  it('dice cuántos días faltan y para qué fecha', () => {
    montar(new Date(2026, 8, 11))
    expect(screen.getByText('190')).toBeInTheDocument()
    // La fecha sale dos veces (antetítulo y extremo de la barra): se ancla en el
    // antetítulo, que es el que la nombra.
    expect(screen.getByText(/Sábado de Pasión · 20 mar 2027/)).toBeInTheDocument()
  })

  it('enseña qué parte del curso ha pasado', () => {
    montar(new Date(2026, 8, 11))
    expect(screen.getByText('47 % del curso')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '47')
  })

  it('el mismo día de la estación no cuenta días de más', () => {
    montar(new Date(2026, 2, 28))
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/cms/inicio`
Expected: FAIL, no existen `../actividad`, `../ParaHoy` ni `../CuentaAtras`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/cms/inicio/actividad.ts
/**
 * Cómo se cuenta una acción de la auditoría sin nombrar lo que se tocó. El
 * contrato de `actividad.registro` solo trae la acción y el tipo de entidad, a
 * propósito: el Inicio lo ve toda la junta y no puede enseñar ni personas ni
 * borradores sin publicar.
 */
const ACCIONES: Record<string, string> = {
  NOTICIA_CREAR: 'creó una noticia',
  NOTICIA_ACTUALIZAR: 'editó una noticia',
  NOTICIA_ELIMINAR: 'borró una noticia',
  PUBLICACION_CREAR: 'subió una publicación',
  PUBLICACION_ACTUALIZAR: 'editó una publicación',
  PUBLICACION_ELIMINAR: 'borró una publicación',
  PAGINA_GUARDAR: 'creó una página',
  PAGINA_ACTUALIZAR: 'editó una página',
  PAGINA_ELIMINAR: 'borró una página',
  PORTADA_ACTUALIZAR: 'cambió la portada',
  EVENTO_CREAR: 'añadió un acto a la agenda',
  EVENTO_ACTUALIZAR: 'cambió un acto de la agenda',
  EVENTO_ELIMINAR: 'quitó un acto de la agenda',
}

export function describirAccion(accion: string, _entityType: string | null): string {
  return ACCIONES[accion] ?? 'hizo un cambio'
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const hora = (f: Date) => `${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`
const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** «Hoy 10:05», «Ayer 19:12» o «9 sep»: lo reciente con hora, lo viejo con fecha. */
export function cuandoFue(iso: string, ahora: Date): string {
  const fecha = new Date(iso)
  if (mismoDia(fecha, ahora)) return `Hoy ${hora(fecha)}`
  const ayer = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1)
  if (mismoDia(fecha, ayer)) return `Ayer ${hora(fecha)}`
  return `${fecha.getDate()} ${MESES[fecha.getMonth()]}`
}
```

```tsx
// src/features/cms/inicio/Cabecera.tsx
import { Box, Button, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { Link } from 'react-router-dom'
import { NOMBRE_CARGO } from '../../../app/cmsNavegacion'
import { contar } from './plural'

interface Props {
  /** Cuántos asuntos esperan hoy a este cargo. */
  asuntosPropios: number
  asuntosDeLaJunta: number
  role?: string
  hoy?: Date
}

/** Los botones de la cabecera: solo los de las secciones de cada cargo. */
const ATAJOS = [
  { texto: 'Nuevo acto', href: '/cms/agenda', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'] },
  { texto: 'Nuevo apunte', href: '/cms/contabilidad', roles: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'] },
  { texto: 'Nueva noticia', href: '/cms/noticias', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'], principal: true },
]

export default function Cabecera({ asuntosPropios, asuntosDeLaJunta, role, hoy = new Date() }: Props) {
  const cargo = role ? NOMBRE_CARGO[role] ?? '' : ''
  const visibles = ATAJOS.filter((a) => role && a.roles.includes(role))

  const frase = asuntosPropios > 0
    ? `Tienes ${contar(asuntosPropios, 'asunto', 'asuntos')} esperando.`
    : 'No tienes nada pendiente.'
  const resto = asuntosDeLaJunta > 0
    ? ` El resto de la junta lleva ${contar(asuntosDeLaJunta, 'asunto más', 'asuntos más')}.`
    : ''

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 3, flexWrap: 'wrap', mb: 3.25 }}>
      <Box>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>
          {hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </Typography>
        <Typography variant="h3" component="h1" sx={{ fontSize: { xs: 30, md: 40 }, lineHeight: 1.15, my: 1 }}>
          Buenos días{cargo && `, ${cargo}`}
        </Typography>
        <Typography variant="body1" color="text.secondary">{frase}{resto}</Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap' }}>
        {visibles.map((atajo) => (
          <Button
            key={atajo.href}
            component={Link}
            to={atajo.href}
            startIcon={<AddIcon />}
            variant={atajo.principal ? 'contained' : 'outlined'}
            color={atajo.principal ? 'primary' : 'inherit'}
            sx={{ borderRadius: 1.25 }}
          >
            {atajo.texto}
          </Button>
        ))}
      </Box>
    </Box>
  )
}
```

```tsx
// src/features/cms/inicio/ParaHoy.tsx
import { Box, Paper, Typography } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { Link } from 'react-router-dom'
import { useTemaCms } from '../../../app/temaCms'
import { repartirTareas, type Prioridad, type Tarea } from './tareas'
import { contar } from './plural'

const PUNTO: Record<Prioridad, 'error' | 'aviso' | null> = {
  urgente: 'error',
  pendiente: 'aviso',
  programado: null,
}

function Fila({ tarea, conBoton }: { tarea: Tarea; conBoton: boolean }) {
  const { superficies, graficas } = useTemaCms()
  const tono = PUNTO[tarea.prioridad]
  const fondo = tarea.prioridad === 'urgente'
    ? superficies.pillUrgente
    : tarea.prioridad === 'pendiente'
      ? superficies.pillPendiente
      : superficies.pillNeutro

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: { xs: 2, md: 2.75 }, py: 1.625, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
      <Box
        component="span"
        sx={{
          width: 96, flexShrink: 0, height: 26, borderRadius: 13, backgroundColor: fondo,
          display: 'inline-flex', alignItems: 'center', gap: 0.875, px: 1.25,
          fontSize: 12, fontWeight: 600, boxSizing: 'border-box',
        }}
      >
        <Box
          component="span"
          aria-hidden="true"
          sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, backgroundColor: tono ? graficas.estados[tono] : 'text.disabled' }}
        />
        {tarea.etiqueta}
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 180 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{tarea.titulo}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{tarea.detalle}</Typography>
      </Box>
      {conBoton && tarea.accion && (
        <Box
          component={Link}
          to={tarea.accion.href}
          sx={{
            height: 34, px: 1.5, borderRadius: 1.125, flexShrink: 0, textDecoration: 'none',
            backgroundColor: superficies.accionFondo, color: superficies.accionTexto,
            fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 0.75,
          }}
        >
          {tarea.accion.texto}
          <ArrowForwardIcon sx={{ fontSize: 15 }} />
        </Box>
      )}
      {!conBoton && (
        <Box
          component="span"
          sx={{
            height: 28, px: 1.5, borderRadius: 14, flexShrink: 0, whiteSpace: 'nowrap',
            backgroundColor: superficies.pillNeutro, color: 'text.secondary',
            fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center',
          }}
        >
          Lo lleva {tarea.cargo}
        </Box>
      )}
    </Box>
  )
}

/** Lo que hay que hacer hoy: lo tuyo con botón, lo del resto de la junta sin él. */
export default function ParaHoy({ tareas, role }: { tareas: Tarea[]; role?: string }) {
  const { tuyas, deLaJunta } = repartirTareas(tareas, role)

  return (
    <Paper component="section" aria-labelledby="para-hoy" sx={{ borderRadius: 1.75 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, px: { xs: 2, md: 2.75 }, pt: 2.25, pb: 1.5 }}>
        <Typography id="para-hoy" variant="h5" component="h2">Para hoy</Typography>
        <Typography variant="body2" color="text.secondary">
          {tareas.length === 0
            ? 'Nada pendiente'
            : `${contar(tuyas.length, 'tuyo', 'tuyos')} · ${deLaJunta.length} del resto de la junta`}
        </Typography>
      </Box>

      {tareas.length === 0 && (
        <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 3, borderTop: 1, borderColor: 'divider', pt: 2.5 }}>
          <Typography variant="body1">Todo al día. No queda nada esperando.</Typography>
        </Box>
      )}

      {tuyas.map((tarea) => <Fila key={tarea.clave} tarea={tarea} conBoton />)}

      {deLaJunta.length > 0 && (
        <>
          <Typography
            sx={{
              px: { xs: 2, md: 2.75 }, pt: 1.75, pb: 0.75, borderTop: 1, borderColor: 'divider',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary',
            }}
          >
            En el resto de la junta
          </Typography>
          {deLaJunta.map((tarea) => <Fila key={tarea.clave} tarea={tarea} conBoton={false} />)}
        </>
      )}
      <Box sx={{ pb: 1 }} />
    </Paper>
  )
}
```

```tsx
// src/features/cms/inicio/Cifras.tsx
import { Box, Paper, Typography } from '@mui/material'
import type { PanelResponse } from '../../../lib/api/panel'
import { eurosResumen, numero } from '../contabilidad/formato'
import { contar } from './plural'

function Cifra({ etiqueta, valor, pie }: { etiqueta: string; valor: string | number; pie: string }) {
  return (
    <Paper sx={{ p: 2.25, borderRadius: 1.75, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.secondary' }}>
        {etiqueta}
      </Typography>
      <Typography sx={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
        {valor}
      </Typography>
      <Typography variant="caption" color="text.secondary">{pie}</Typography>
    </Paper>
  )
}

/**
 * Las cuatro cifras de hoy. No las toca el selector de ejercicio: son cosas que
 * hacer ahora, y mezclarlas con un año cerrado despistaría.
 */
export default function Cifras({ panel }: { panel: PanelResponse }) {
  const porCobrar = panel.dinero.porEstado
    .filter((e) => e.estado === 'PENDIENTE' || e.estado === 'DEVUELTO')
    .reduce((s, e) => ({ total: s.total + e.total, importe: s.importe + e.importe }), { total: 0, importe: 0 })
  const saldo = panel.dinero.ejercicio.saldo

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' }, gap: 1.75 }}>
      <Cifra
        etiqueta="Hermanos activos"
        valor={numero(panel.censo.activos)}
        pie={`+${panel.censo.altas12m} / −${panel.censo.bajas12m} en doce meses`}
      />
      <Cifra etiqueta={`Papeletas ${panel.procesion.anio}`} valor={numero(panel.procesion.papeletas)} pie="de sitio" />
      <Cifra
        etiqueta="Por cobrar"
        valor={eurosResumen(porCobrar.importe)}
        pie={contar(porCobrar.total, 'recibo', 'recibos')}
      />
      <Cifra
        etiqueta={`Saldo ${panel.dinero.ejercicio.anio}`}
        valor={eurosResumen(saldo)}
        pie={saldo >= 0 ? 'superávit' : 'déficit'}
      />
    </Box>
  )
}
```

```tsx
// src/features/cms/inicio/CuentaAtras.tsx
import { Box, Typography } from '@mui/material'
import { useTemaCms } from '../../../app/temaCms'
import { cuentaAtrasEstacion } from '../../../domain/sabadoDePasion'
import { designTokens } from '../../../theme'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const corta = (f: Date) => `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`

/**
 * El bloque destacado del Inicio. Va siempre en el tono CONTRARIO al tema: papel
 * sobre el lienzo oscuro y tinta sobre el claro. Es lo que lo hace destacar en
 * los dos modos sin añadir ningún color nuevo.
 */
export default function CuentaAtras({ hoy = new Date() }: { hoy?: Date }) {
  const { superficies } = useTemaCms()
  const { fecha, anterior, dias, porcentaje } = cuentaAtrasEstacion(hoy)

  return (
    <Box
      component="section"
      aria-labelledby="cuenta-atras"
      sx={{ backgroundColor: superficies.inverso, color: superficies.inversoTexto, borderRadius: 1.75, p: 2.75 }}
    >
      <Typography
        id="cuenta-atras"
        sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: superficies.inversoTenue }}
      >
        Sábado de Pasión · {corta(fecha)}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, mt: 1, mb: 0.25 }}>
        <Typography component="span" sx={{ fontFamily: designTokens.fonts.heading, fontSize: 68, lineHeight: 1 }}>
          {dias}
        </Typography>
        <Typography component="span" sx={{ fontFamily: designTokens.fonts.heading, fontSize: 20, color: superficies.inversoTenue }}>
          {dias === 1 ? 'día' : 'días'}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 14, color: superficies.inversoTenue }}>para la estación de penitencia</Typography>

      <Box
        role="progressbar"
        aria-label="Parte del curso recorrida"
        aria-valuenow={porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        sx={{ mt: 2.25, height: 6, borderRadius: 3, backgroundColor: superficies.inversoPista, overflow: 'hidden' }}
      >
        <Box sx={{ width: `${porcentaje}%`, height: '100%', backgroundColor: designTokens.colors.secondary }} />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, fontSize: 11, color: superficies.inversoTenue }}>
        <span>{corta(anterior)}</span>
        <span>{porcentaje} % del curso</span>
        <span>{corta(fecha)}</span>
      </Box>
    </Box>
  )
}
```

```tsx
// src/features/cms/inicio/ProximosActos.tsx
import { Box, Paper, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import type { PanelResponse } from '../../../lib/api/panel'
import { designTokens } from '../../../theme'

const TIPO: Record<string, string> = {
  CULTO: 'Culto', PROCESION: 'Procesión', FORMACION: 'Formación', ENSAYO: 'Ensayo',
  REUNION: 'Reunión', SOCIAL: 'Social', OTRO: 'Otro',
}

/** Los cuatro primeros actos convocados. */
export default function ProximosActos({ eventos }: { eventos: PanelResponse['actividad']['proximosEventos'] }) {
  const proximos = eventos.slice(0, 4)

  return (
    <Paper component="section" aria-labelledby="proximos-actos" sx={{ borderRadius: 1.75 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', px: 2.75, pt: 2.25, pb: 1.5 }}>
        <Typography id="proximos-actos" variant="h5" component="h2">Próximos actos</Typography>
        <Typography component={Link} to="/cms/agenda" variant="body2" sx={{ fontWeight: 600, textDecoration: 'none', color: 'primary.main' }}>
          Agenda →
        </Typography>
      </Box>
      {proximos.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2.75, pb: 3, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
          No hay actos convocados.
        </Typography>
      )}
      {proximos.map((evento) => {
        const fecha = new Date(evento.startDate)
        return (
          <Box key={evento.id} sx={{ display: 'flex', gap: 1.75, alignItems: 'center', px: 2.75, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ width: 44, flexShrink: 0, textAlign: 'center' }}>
              <Typography sx={{ fontFamily: designTokens.fonts.heading, fontSize: 22, lineHeight: 1.1 }}>
                {fecha.getDate()}
              </Typography>
              <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.secondary' }}>
                {fecha.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}
              </Typography>
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{evento.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {fecha.toLocaleDateString('es-ES', { weekday: 'long' })} ·{' '}
                {fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · {TIPO[evento.type] ?? evento.type}
              </Typography>
            </Box>
          </Box>
        )
      })}
      <Box sx={{ pb: 1 }} />
    </Paper>
  )
}
```

```tsx
// src/features/cms/inicio/ActividadEquipo.tsx
import { Box, Paper, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import type { PanelResponse } from '../../../lib/api/panel'
import { NOMBRE_CARGO } from '../../../app/cmsNavegacion'
import { cuandoFue, describirAccion } from './actividad'

/**
 * Qué se ha tocado últimamente, por cargo y sin nombres. Solo contenido y
 * agenda: el registro completo vive en Auditoría, que solo ven ADMIN y
 * HERMANO_MAYOR, y por eso el enlace solo aparece para ellos.
 */
export default function ActividadEquipo({
  registro, role, ahora = new Date(),
}: {
  registro: PanelResponse['actividad']['registro']
  role?: string
  ahora?: Date
}) {
  const veAuditoria = role === 'ADMIN' || role === 'HERMANO_MAYOR'

  return (
    <Paper component="section" aria-labelledby="actividad-equipo" sx={{ borderRadius: 1.75 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', px: 2.75, pt: 2.25, pb: 1.5 }}>
        <Typography id="actividad-equipo" variant="h5" component="h2">Actividad del equipo</Typography>
        {veAuditoria ? (
          <Typography component={Link} to="/cms/auditoria" variant="body2" sx={{ fontWeight: 600, textDecoration: 'none', color: 'primary.main' }}>
            Ver auditoría →
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">Contenido y agenda</Typography>
        )}
      </Box>
      {registro.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2.75, pb: 3, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
          Todavía no se ha tocado nada.
        </Typography>
      )}
      {registro.map((fila, i) => (
        <Box
          key={`${fila.createdAt}-${i}`}
          sx={{ display: 'grid', gridTemplateColumns: '76px minmax(0, 1fr)', gap: 1.5, px: 2.75, py: 1.25, borderTop: 1, borderColor: 'divider' }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums', pt: 0.25 }}>
            {cuandoFue(fila.createdAt, ahora)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <Box component="strong" sx={{ color: 'text.primary' }}>
              {fila.cargo ? NOMBRE_CARGO[fila.cargo] ?? fila.cargo : 'Alguien'}
            </Box>{' '}
            {describirAccion(fila.accion, fila.entityType)}
          </Typography>
        </Box>
      ))}
      <Box sx={{ pb: 1 }} />
    </Paper>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/cms/inicio`
Expected: PASS, los tres ficheros de prueba nuevos más el de `tareas`.

- [ ] **Step 5: Commit**

```bash
rtk git add desamparados-web/src/features/cms/inicio
rtk git commit -m "Componer las piezas del Inicio: asuntos, cifras, cuenta atrás y actos"
```

---

### Task 16: «Cómo va el año»

La sección de abajo: un selector de ejercicio que gobierna las siete gráficas y nada más.

**Files:**
- Create: `desamparados-web/src/features/cms/inicio/ComoVaElAnio.tsx`
- Test: `desamparados-web/src/features/cms/inicio/__tests__/ComoVaElAnio.test.tsx`

**Interfaces:**
- Consumes: `getPanel` (Task 9), `useTemaCms` (Task 8), las siete gráficas (Tasks 13 y 14), `euros`/`eurosResumen`/`numero`/`etiquetaPunto`/`etiquetaPuntoLarga` de `../contabilidad/formato`.
- Produces: `<ComoVaElAnio panelDeHoy={panel} />`

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/cms/inicio/__tests__/ComoVaElAnio.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import { TemaCmsProvider } from '../../../../app/temaCms'
import ComoVaElAnio from '../ComoVaElAnio'
import type { PanelResponse } from '../../../../lib/api/panel'

const PANEL = {
  generadoEn: '2026-09-11T08:00:00.000Z',
  ejercicio: { anio: 2026, cerrado: false },
  censo: {
    activos: 1284, altas12m: 34, bajas12m: 12, sinNumeroHermano: 3,
    serieMensual: [{ mes: '2026-08', activos: 1282 }, { mes: '2026-09', activos: 1284 }],
    movimientosMensuales: [{ mes: '2026-08', altas: 3, bajas: 0 }, { mes: '2026-09', altas: 3, bajas: 1 }],
    porEdad: [{ tramo: '31-45', total: 312 }],
  },
  dinero: {
    porEstado: [
      { estado: 'PAGADO', total: 1126, importe: 33780 },
      { estado: 'DEVUELTO', total: 14, importe: 420 },
    ],
    ejercicio: { anio: 2026, ingresos: 48300, gastos: 35440, saldo: 12860 },
    serieMensual: [{ mes: '2026-08', ingresos: 4100, gastos: 2240 }, { mes: '2026-09', ingresos: 7600, gastos: 4600 }],
    porCategoria: [{ categoria: 'Cultos y liturgia', tipo: 'GASTO', total: 18, importe: 9800 }],
  },
  procesion: {
    anio: 2026, papeletas: 612,
    porAnio: [{ anio: 2025, total: 604 }, { anio: 2026, total: 612 }],
    porPuesto: [], porTalla: [], porAlturaHombro: [],
  },
  actividad: {
    proximosEventos: [], noticias: { publicadas: 4, borradores: 2 },
    publicaciones: { total: 7, ultima: null },
    reparto: { turnosProximos: 2, citasReservadas: 6, capacidadEstimada: 40 },
    registro: [],
  },
} as unknown as PanelResponse

const DE_2025 = {
  ...PANEL,
  ejercicio: { anio: 2025, cerrado: true },
  dinero: { ...PANEL.dinero, ejercicio: { anio: 2025, ingresos: 41000, gastos: 39000, saldo: 2000 } },
  procesion: { ...PANEL.procesion, anio: 2025, papeletas: 604 },
} as unknown as PanelResponse

function responder(cuerpo: unknown) {
  const espia = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(cuerpo), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  )
  vi.stubGlobal('fetch', espia)
  return espia
}

const montar = () =>
  renderWithProviders(<TemaCmsProvider><ComoVaElAnio panelDeHoy={PANEL} /></TemaCmsProvider>)

afterEach(() => { vi.unstubAllGlobals() })

describe('ComoVaElAnio', () => {
  it('arranca en el ejercicio en curso y no pide nada: ya tiene los datos', () => {
    const espia = responder(PANEL)
    montar()
    expect(screen.getByRole('combobox', { name: /ejercicio/i })).toHaveTextContent('2026')
    expect(espia).not.toHaveBeenCalled()
  })

  it('pinta las siete gráficas con su título', () => {
    responder(PANEL)
    montar()
    for (const titulo of [
      'Censo de hermanos', 'Altas y bajas', 'Ingresos y gastos por mes', 'En qué se gasta',
      'Cobro de recibos', 'Papeletas de sitio', 'Hermanos por edad',
    ]) {
      expect(screen.getByRole('heading', { name: titulo })).toBeInTheDocument()
    }
  })

  it('al elegir un año cerrado pide ese ejercicio y lo dice en la cabecera', async () => {
    const espia = responder(DE_2025)
    montar()
    await userEvent.click(screen.getByRole('combobox', { name: /ejercicio/i }))
    await userEvent.click(screen.getByRole('option', { name: '2025' }))

    await waitFor(() => expect(espia).toHaveBeenCalledWith('/api/panel?anio=2025', expect.anything()))
    expect(await screen.findByText(/Ejercicio 2025 · cerrado/)).toBeInTheDocument()
  })

  it('el gasto por categoría va en euros, no en número de apuntes', () => {
    responder(PANEL)
    montar()
    // La barra lleva el importe redondo; el número de apuntes (18) solo vive en
    // la tabla, como dato secundario.
    expect(screen.getByText('9.800 €')).toBeInTheDocument()
  })

  it('los tramos de edad son siempre de hoy, y el subtítulo lo dice', () => {
    responder(PANEL)
    montar()
    expect(screen.getByText(/a día de hoy/i)).toBeInTheDocument()
  })

  it('cada gráfica ofrece su tabla', () => {
    responder(PANEL)
    montar()
    expect(screen.getAllByText('Ver tabla').length).toBeGreaterThanOrEqual(6)
  })

  it('con las series vacías no revienta', () => {
    const vacio = {
      ...PANEL,
      censo: { ...PANEL.censo, serieMensual: [], movimientosMensuales: [], porEdad: [] },
      dinero: { ...PANEL.dinero, serieMensual: [], porCategoria: [], porEstado: [] },
      procesion: { ...PANEL.procesion, porAnio: [] },
    } as unknown as PanelResponse
    responder(vacio)
    renderWithProviders(<TemaCmsProvider><ComoVaElAnio panelDeHoy={vacio} /></TemaCmsProvider>)
    expect(screen.getAllByText(/todavía no hay datos/i).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/cms/inicio/__tests__/ComoVaElAnio.test.tsx`
Expected: FAIL, «Failed to resolve import '../ComoVaElAnio'».

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/cms/inicio/ComoVaElAnio.tsx
import { useState } from 'react'
import { Box, MenuItem, Paper, TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { getPanel, type PanelResponse } from '../../../lib/api/panel'
import { useTemaCms } from '../../../app/temaCms'
import LineaTemporal from '../../../components/charts/LineaTemporal'
import BarrasHorizontales from '../../../components/charts/BarrasHorizontales'
import ColumnasDivergentes from '../../../components/charts/ColumnasDivergentes'
import ColumnasPorPares from '../../../components/charts/ColumnasPorPares'
import ColumnasPorAnio from '../../../components/charts/ColumnasPorAnio'
import ProporcionEstados, { type FilaEstado } from '../../../components/charts/ProporcionEstados'
import TablaDeDatos from '../../../components/charts/TablaDeDatos'
import { euros, eurosResumen, numero, etiquetaPunto, etiquetaPuntoLarga } from '../contabilidad/formato'

/** Cuántos ejercicios ofrece el selector. Cinco cubre de sobra la reunión de enero. */
const EJERCICIOS = 5

/** Los estados de recibo que interesan, con su severidad. */
const ESTADOS = [
  { clave: 'PAGADO', etiqueta: 'Cobrados', estado: 'ok' as const },
  { clave: 'PENDIENTE', etiqueta: 'Pendientes', estado: 'aviso' as const },
  { clave: 'DEVUELTO', etiqueta: 'Devueltos por el banco', estado: 'error' as const },
]

function Tarjeta({
  titulo, subtitulo, ancha = false, children,
}: {
  titulo: string
  subtitulo: string
  ancha?: boolean
  children: React.ReactNode
}) {
  return (
    <Paper
      component="section"
      sx={{
        borderRadius: 1.75, p: 2.75, display: 'flex', flexDirection: 'column', gap: 1.75,
        gridColumn: { xs: '1 / -1', lg: ancha ? '1 / -1' : 'span 6' },
      }}
    >
      <Box>
        <Typography variant="h5" component="h3" sx={{ fontSize: 20 }}>{titulo}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.375 }}>{subtitulo}</Typography>
      </Box>
      {children}
    </Paper>
  )
}

/**
 * «Cómo va el año»: un selector de ejercicio que gobierna las siete gráficas y
 * nada más. La cabecera del Inicio, «Para hoy», los actos y la cuenta atrás no
 * cambian nunca; el selector existe porque el Inicio se enseña a la junta en la
 * reunión de principios de año, cuando lo que importa es el ejercicio cerrado.
 */
export default function ComoVaElAnio({ panelDeHoy }: { panelDeHoy: PanelResponse }) {
  const { graficas } = useTemaCms()
  const anioActual = panelDeHoy.ejercicio.anio
  const [anio, setAnio] = useState(anioActual)
  const esElActual = anio === anioActual

  // Con el año en curso no se pide nada: los datos ya están arriba. Al elegir
  // uno cerrado, la clave incluye el año, así que lo ya cargado no se borra y
  // volver atrás es instantáneo.
  const consulta = useQuery({
    queryKey: ['panel', anio],
    queryFn: () => getPanel(anio),
    enabled: !esElActual,
    placeholderData: (anterior) => anterior,
  })
  const datos = esElActual ? panelDeHoy : consulta.data

  const anios = Array.from({ length: EJERCICIOS }, (_, i) => anioActual - i)

  return (
    <Box component="section" aria-labelledby="como-va" sx={{ mt: 4, pt: 4, borderTop: 1, borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>
            El Grupo Parroquial en datos · igual para toda la junta
          </Typography>
          <Typography id="como-va" variant="h4" component="h2" sx={{ fontSize: 30, mt: 1 }}>
            Cómo va el año
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          Solo cifras de conjunto: aquí nunca aparecen datos de una persona.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 2.5, flexWrap: 'wrap' }}>
        <TextField
          select
          size="small"
          label="Ejercicio"
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          sx={{ minWidth: 140 }}
        >
          {anios.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
        </TextField>
        <Typography variant="body2" color="text.secondary">
          {esElActual
            ? 'Ejercicio en curso · el censo, en los últimos doce meses'
            : `Ejercicio ${anio} · cerrado · de enero a diciembre`}
        </Typography>
      </Box>

      {!datos ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
          Cargando el ejercicio {anio}…
        </Typography>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(12, minmax(0, 1fr))' }, gap: 2.5 }}>
          <Tarjeta titulo="Censo de hermanos" subtitulo="Hermanos activos al cierre de cada mes">
            <LineaTemporal
              etiqueta="Hermanos activos"
              paleta={graficas}
              puntos={datos.censo.serieMensual.map((p) => ({ x: p.mes, y: p.activos }))}
              etiquetaX={etiquetaPunto}
            />
            <TablaDeDatos
              titulo="Hermanos activos al cierre de cada mes"
              columnas={['Mes', 'Activos']}
              filas={datos.censo.serieMensual.map((p) => [etiquetaPuntoLarga(p.mes), numero(p.activos)])}
            />
          </Tarjeta>

          <Tarjeta titulo="Altas y bajas" subtitulo="Cuántos entran y cuántos se van cada mes">
            <ColumnasDivergentes
              meses={datos.censo.movimientosMensuales.map((m) => ({ mes: m.mes, arriba: m.altas, abajo: m.bajas }))}
              paleta={graficas}
              etiquetaArriba="Altas"
              etiquetaAbajo="Bajas"
              etiquetaX={etiquetaPunto}
            />
            <TablaDeDatos
              titulo="Altas y bajas por mes"
              columnas={['Mes', 'Altas', 'Bajas']}
              filas={datos.censo.movimientosMensuales.map((m) => [etiquetaPuntoLarga(m.mes), m.altas, m.bajas])}
            />
          </Tarjeta>

          <Tarjeta
            titulo="Ingresos y gastos por mes"
            subtitulo={`Lo que entra y lo que sale cada mes · saldo del ejercicio ${eurosResumen(datos.dinero.ejercicio.saldo)}`}
            ancha
          >
            <ColumnasPorPares
              puntos={datos.dinero.serieMensual.map((m) => ({ clave: m.mes, a: m.ingresos, b: m.gastos }))}
              paleta={graficas}
              etiquetaA="Ingresos"
              etiquetaB="Gastos"
              formatoValor={eurosResumen}
              etiquetaX={etiquetaPunto}
              etiquetaXLarga={etiquetaPuntoLarga}
            />
            <TablaDeDatos
              titulo="Ingresos y gastos por mes"
              columnas={['Mes', 'Ingresos', 'Gastos']}
              filas={datos.dinero.serieMensual.map((m) => [etiquetaPuntoLarga(m.mes), euros(m.ingresos), euros(m.gastos)])}
            />
          </Tarjeta>

          <Tarjeta titulo="En qué se gasta" subtitulo={`Gastos de ${datos.ejercicio.anio} por categoría contable`}>
            <BarrasHorizontales
              color={graficas.salida}
              formatoValor={eurosResumen}
              filas={datos.dinero.porCategoria
                .filter((c) => c.tipo === 'GASTO')
                .sort((a, b) => b.importe - a.importe)
                .map((c) => ({ etiqueta: c.categoria, valor: c.importe }))}
            />
            <TablaDeDatos
              titulo="Gasto por categoría"
              columnas={['Categoría', 'Importe', 'Apuntes']}
              filas={datos.dinero.porCategoria
                .filter((c) => c.tipo === 'GASTO')
                .sort((a, b) => b.importe - a.importe)
                .map((c) => [c.categoria, euros(c.importe), c.total])}
            />
          </Tarjeta>

          <Tarjeta titulo="Cobro de recibos" subtitulo={`Recibos del ejercicio ${datos.ejercicio.anio} según su estado`}>
            <ProporcionEstados
              paleta={graficas}
              formatoImporte={eurosResumen}
              estados={ESTADOS.map<FilaEstado>((e) => {
                const fila = datos.dinero.porEstado.find((f) => f.estado === e.clave)
                return { clave: e.clave, etiqueta: e.etiqueta, estado: e.estado, total: fila?.total ?? 0, importe: fila?.importe ?? 0 }
              })}
            />
            <TablaDeDatos
              titulo="Recibos por estado"
              columnas={['Estado', 'Recibos', 'Importe']}
              filas={datos.dinero.porEstado.map((f) => [f.estado, f.total, euros(f.importe)])}
            />
          </Tarjeta>

          <Tarjeta titulo="Papeletas de sitio" subtitulo="Últimos cinco años, con el ejercicio elegido destacado">
            <ColumnasPorAnio datos={datos.procesion.porAnio} paleta={graficas} destacado={datos.ejercicio.anio} />
            <TablaDeDatos
              titulo="Papeletas por año"
              columnas={['Año', 'Papeletas']}
              filas={datos.procesion.porAnio.map((a) => [String(a.anio), numero(a.total)])}
            />
          </Tarjeta>

          <Tarjeta titulo="Hermanos por edad" subtitulo="Hermanos activos por tramo de edad, a día de hoy">
            {/* De hoy siempre: la edad de quien estaba activo en 2023 no se puede
                reconstruir con agregados, y el subtítulo lo dice. */}
            <BarrasHorizontales
              color={graficas.neutro}
              formatoValor={numero}
              filas={panelDeHoy.censo.porEdad.map((t) => ({ etiqueta: t.tramo, valor: t.total }))}
            />
            <TablaDeDatos
              titulo="Hermanos activos por tramo de edad"
              columnas={['Tramo', 'Hermanos']}
              filas={panelDeHoy.censo.porEdad.map((t) => [t.tramo, numero(t.total)])}
            />
          </Tarjeta>
        </Box>
      )}
    </Box>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/cms/inicio`
Expected: PASS, los siete casos.

- [ ] **Step 5: Commit**

```bash
rtk git add desamparados-web/src/features/cms/inicio
rtk git commit -m "Añadir «Cómo va el año» con su selector de ejercicio"
```

---

### Task 17: El Inicio

`PanelPage.tsx` deja de ser un informe de cuatro bloques y pasa a montar las piezas.

**Files:**
- Modify: `desamparados-web/src/features/cms/PanelPage.tsx` (reescribir)
- Test: `desamparados-web/src/features/cms/__tests__/PanelPage.test.tsx` (reescribir)

**Interfaces:**
- Consumes: `usePanelDeHoy` (Task 9), `tareasDelDia` (Task 12) y las piezas de las Tasks 15 y 16.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/cms/__tests__/PanelPage.test.tsx (reescrito)
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import { TemaCmsProvider } from '../../../app/temaCms'
import PanelPage from '../PanelPage'
import { useAuthStore } from '../../members/auth/store'
import type { PanelResponse } from '../../../lib/api/panel'

const panel: PanelResponse = {
  generadoEn: '2026-09-11T08:00:00.000Z',
  ejercicio: { anio: 2026, cerrado: false },
  censo: {
    activos: 1284,
    altas12m: 34,
    bajas12m: 12,
    sinNumeroHermano: 3,
    serieMensual: [{ mes: '2026-08', activos: 1282 }, { mes: '2026-09', activos: 1284 }],
    movimientosMensuales: [{ mes: '2026-08', altas: 3, bajas: 0 }, { mes: '2026-09', altas: 3, bajas: 1 }],
    porEdad: [{ tramo: '31-45', total: 312 }],
  },
  dinero: {
    porEstado: [
      { estado: 'PAGADO', total: 1126, importe: 33780 },
      { estado: 'PENDIENTE', total: 57, importe: 1710 },
      { estado: 'DEVUELTO', total: 14, importe: 420 },
    ],
    ejercicio: { anio: 2026, ingresos: 48300, gastos: 35440, saldo: 12860 },
    serieMensual: [{ mes: '2026-08', ingresos: 4100, gastos: 2240 }, { mes: '2026-09', ingresos: 7600, gastos: 4600 }],
    porCategoria: [{ categoria: 'Cultos y liturgia', tipo: 'GASTO', total: 18, importe: 9800 }],
  },
  procesion: {
    anio: 2026,
    papeletas: 612,
    porAnio: [{ anio: 2025, total: 604 }, { anio: 2026, total: 612 }],
    porPuesto: [{ etiqueta: 'Nazarenos', total: 418 }],
    porTalla: [{ etiqueta: 'L', total: 90 }],
    porAlturaHombro: [{ tramo: '170-179', total: 41 }],
  },
  actividad: {
    proximosEventos: [
      { id: 1, title: 'Misa de hermandad', startDate: '2026-09-14T18:30:00.000Z', type: 'CULTO' },
    ],
    noticias: { publicadas: 4, borradores: 2 },
    publicaciones: { total: 7, ultima: '2026-06-01T00:00:00.000Z' },
    reparto: { turnosProximos: 2, citasReservadas: 6, capacidadEstimada: 40 },
    registro: [
      { accion: 'NOTICIA_CREAR', entityType: 'noticia', createdAt: '2026-09-11T08:05:00.000Z', cargo: 'REDES' },
    ],
  },
}

function responder(cuerpo: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }),
  ))
}

const entrarComo = (role: string) =>
  useAuthStore.setState({ status: 'autenticado', user: { id: 1, email: 'p@e.es', role, perfiles: [] } })

const montar = () => renderWithProviders(<TemaCmsProvider><PanelPage /></TemaCmsProvider>)

beforeEach(() => { localStorage.clear() })
afterEach(() => { vi.unstubAllGlobals() })

describe('Inicio del CMS', () => {
  it('saluda con el cargo y con lo que espera', async () => {
    responder(panel)
    entrarComo('HERMANO_MAYOR')
    montar()
    expect(await screen.findByRole('heading', { level: 1, name: /Buenos días, Hermano Mayor/ })).toBeInTheDocument()
    expect(screen.getByText(/4 asuntos esperando/)).toBeInTheDocument()
  })

  it('enseña las cuatro cifras de hoy', async () => {
    responder(panel)
    entrarComo('ADMIN')
    montar()
    // Se buscan DENTRO de su tarjeta: las mismas cifras salen también en las
    // gráficas y en sus tablas, y una búsqueda suelta sería ambigua.
    const tarjeta = async (etiqueta: string | RegExp) =>
      within((await screen.findByText(etiqueta)).closest('.MuiPaper-root') as HTMLElement)

    expect((await tarjeta('Hermanos activos')).getByText('1.284')).toBeInTheDocument()
    expect((await tarjeta(/^Papeletas 2026$/)).getByText('612')).toBeInTheDocument()
    expect((await tarjeta('Por cobrar')).getByText('2.130 €')).toBeInTheDocument() // pendientes + devueltos
    expect((await tarjeta(/^Saldo 2026$/)).getByText('12.860 €')).toBeInTheDocument()
  })

  it('reparte los asuntos según el cargo', async () => {
    responder(panel)
    entrarComo('REDES')
    montar()
    expect(await screen.findByRole('link', { name: /Publicar/ })).toBeInTheDocument()
    expect(screen.getByText('Lo lleva Tesorería')).toBeInTheDocument()
  })

  it('lleva cuenta atrás, próximos actos y actividad del equipo', async () => {
    responder(panel)
    entrarComo('ADMIN')
    montar()
    expect(await screen.findByText(/Sábado de Pasión/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Próximos actos' })).toBeInTheDocument()
    expect(screen.getByText('Misa de hermandad')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Actividad del equipo' })).toBeInTheDocument()
    expect(screen.getByText(/creó una noticia/)).toBeInTheDocument()
  })

  it('el enlace a Auditoría solo lo ven quienes pueden entrar', async () => {
    responder(panel)
    entrarComo('REDES')
    montar()
    await screen.findByRole('heading', { name: 'Actividad del equipo' })
    expect(screen.queryByRole('link', { name: /Ver auditoría/ })).not.toBeInTheDocument()
  })

  it('lleva «Cómo va el año» debajo', async () => {
    responder(panel)
    entrarComo('ADMIN')
    montar()
    expect(await screen.findByRole('heading', { name: 'Cómo va el año' })).toBeInTheDocument()
  })

  it('avisa mientras carga', () => {
    responder(panel)
    entrarComo('ADMIN')
    montar()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('explica el fallo si el servidor no responde', async () => {
    responder({}, 500)
    entrarComo('ADMIN')
    montar()
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se ha podido cargar/i)
  })

  it('aguanta un Grupo Parroquial recién instalado, con todo a cero', async () => {
    responder({
      ...panel,
      censo: { activos: 0, altas12m: 0, bajas12m: 0, sinNumeroHermano: 0, serieMensual: [], movimientosMensuales: [], porEdad: [] },
      dinero: { porEstado: [], ejercicio: { anio: 2026, ingresos: 0, gastos: 0, saldo: 0 }, serieMensual: [], porCategoria: [] },
      procesion: { anio: 2026, papeletas: 0, porAnio: [], porPuesto: [], porTalla: [], porAlturaHombro: [] },
      actividad: { ...panel.actividad, proximosEventos: [], noticias: { publicadas: 0, borradores: 0 }, reparto: { turnosProximos: 0, citasReservadas: 0, capacidadEstimada: 0 }, registro: [] },
    })
    entrarComo('ADMIN')
    montar()
    expect(await screen.findByText(/todo al día/i)).toBeInTheDocument()
    expect(screen.getAllByText(/todavía no hay datos/i).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/cms/__tests__/PanelPage.test.tsx`
Expected: FAIL: la página sigue siendo el panel de cuatro bloques.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/cms/PanelPage.tsx
import { Alert, Box, CircularProgress } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useAuthStore } from '../members/auth/store'
import { usePanelDeHoy } from '../../app/usePanelDeHoy'
import { tareasDelDia, repartirTareas } from './inicio/tareas'
import Cabecera from './inicio/Cabecera'
import ParaHoy from './inicio/ParaHoy'
import Cifras from './inicio/Cifras'
import CuentaAtras from './inicio/CuentaAtras'
import ProximosActos from './inicio/ProximosActos'
import ActividadEquipo from './inicio/ActividadEquipo'
import ComoVaElAnio from './inicio/ComoVaElAnio'

/**
 * El Inicio del CMS. Arriba, lo de hoy: qué hay que hacer, las cuatro cifras,
 * los próximos actos y cuánto queda para la estación. Debajo, «Cómo va el año»,
 * que es lo único que cambia con el selector de ejercicio.
 */
export default function PanelPage() {
  const role = useAuthStore((state) => state.user?.role)
  const { data, isPending, isError } = usePanelDeHoy()

  if (isPending) {
    return <CircularProgress aria-label="Cargando el Inicio" />
  }

  if (isError || !data) {
    return <Alert severity="error">No se ha podido cargar el Inicio. Inténtalo de nuevo en unos minutos.</Alert>
  }

  const tareas = tareasDelDia(data)
  const { tuyas, deLaJunta } = repartirTareas(tareas, role)

  return (
    <>
      <Helmet><title>Inicio | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>

      <Cabecera asuntosPropios={tuyas.length} asuntosDeLaJunta={deLaJunta.length} role={role} />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 352px' }, gap: 3, alignItems: 'start' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <ParaHoy tareas={tareas} role={role} />
          <Cifras panel={data} />
          <ActividadEquipo registro={data.actividad.registro} role={role} />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <CuentaAtras />
          <ProximosActos eventos={data.actividad.proximosEventos} />
        </Box>
      </Box>

      <ComoVaElAnio panelDeHoy={data} />
    </>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/cms && npx tsc -b`
Expected: PASS los nueve casos y el typecheck limpio.

- [ ] **Step 5: Commit**

```bash
rtk git add desamparados-web/src/features/cms
rtk git commit -m "Convertir el panel de /cms en el Inicio de la junta"
```

---

### Task 18: Limpieza y verificación

Quitar lo que ha quedado sin uso, pasar todo, y mirar con los ojos lo que los tests no ven: los formularios largos en oscuro.

**Files:**
- Delete: `desamparados-web/src/components/charts/BarraEstados.tsx` y su test
- Delete: `desamparados-web/src/features/cms/panel/Cifra.tsx` (y la carpeta `panel/`, ya vacía)
- Modify: `docs/superpowers/specs/2026-09-12-cms-inicio-a4-design.md` (estado y notas)

- [ ] **Step 1: Comprobar que lo que se borra no lo usa nadie**

```bash
rtk grep "BarraEstados" desamparados-web/src
rtk grep "panel/Cifra" desamparados-web/src
rtk grep "cmsTheme\|cmsSurfaces" desamparados-web/src
```
Expected: sin resultados (fuera de los propios ficheros que se van a borrar). Si `cmsTheme` o `cmsSurfaces` aparecen, quedó un uso sin migrar: arréglalo antes de seguir.

- [ ] **Step 2: Borrar**

```bash
rtk git rm desamparados-web/src/components/charts/BarraEstados.tsx desamparados-web/src/components/charts/__tests__/BarraEstados.test.tsx
rtk git rm desamparados-web/src/features/cms/panel/Cifra.tsx
```

- [ ] **Step 3: Pasar todo, de verdad**

```bash
cd desamparados-web && npm test && npx tsc -b && npm run lint
cd ../backend-desamparados && npx prisma generate && npm test
```
Expected: los dos `npm test` en verde, `tsc -b` sin salida y `lint` sin errores. **Pega la salida en el resumen final**: sin ella no se puede decir que pasa.

- [ ] **Step 4: Mirarlo con los ojos**

Levantar backend y frontend (`npm run dev` en los dos) y entrar en `/cms` con una cuenta de cada cargo, o al menos con ADMIN y con REDES. Comprobar, en los dos modos:

1. El Inicio en oscuro y en claro; que el bloque de la cuenta atrás va en el tono contrario en cada uno.
2. Que el interruptor recuerda la elección al recargar y al cambiar de pantalla.
3. Que el menú agrupa, que los contadores salen y que REDES no ve Cuentas ni Censo y enseres.
4. Que el selector de ejercicio cambia las siete gráficas y **no** las cuatro cifras de arriba, ni «Para hoy», ni los actos, ni la cuenta atrás.
5. **Los formularios largos en oscuro** (riesgo 4 de la spec): `/cms/tesoreria`, `/cms/contabilidad`, `/cms/hermanos/:id/editar` e `/cms/inventario`. Si alguno queda peor en oscuro, anótalo con una captura en el resumen y **no lo arregles a medias**: o es un retoque de una línea o se decide aparte.
6. Una pasada estrecha (ventana de móvil) para que nada se salga de la pantalla.

Capturas para el resumen final: Inicio oscuro completo, Inicio claro completo e Inicio de un cargo acotado (REDES).

- [ ] **Step 5: Dejar la spec al día y confirmar**

En `docs/superpowers/specs/2026-09-12-cms-inicio-a4-design.md`, cambiar el estado a implementado con fecha y anotar en §11 lo que se decidió de verdad sobre los riesgos 2 (aviso a Tesorería), 3 (la actividad se queda para toda la junta) y 4 (qué tal quedaron los formularios en oscuro).

```bash
rtk git add -A
rtk git commit -m "Retirar lo que sustituye el Inicio y anotar la spec como implementada"
rtk git push
```

- [ ] **Step 6: Cerrar la rama**

La rama `spec-cms-inicio-a4` ya tiene abierta la PR #7 con la spec. Al terminar, actualizar su descripción para que cuente también la implementación, o abrir una PR nueva si se prefiere separar spec de código. Seguir `superpowers:finishing-a-development-branch`.

---

## Repaso final del plan contra la spec

**Cobertura.** Cada punto de la spec tiene su tarea:

| Spec | Tarea |
|---|---|
| §5 Tema claro/oscuro, tokens, interruptor, memoria, bloque inverso | 7, 8, 10, 15 (`CuentaAtras`) |
| §6 Cabecera, «Para hoy», cifras, cuenta atrás, actos, actividad | 11, 12, 15, 17 |
| §7 «Cómo va el año», selector y las siete gráficas con «Ver tabla» | 13, 14, 16 |
| §8.1 Ejercicio elegible y validación | 1, 2 |
| §8.2 Altas y bajas por mes | 3 |
| §8.3 Gasto por categoría en euros | 4 |
| §8.4 Recibos del ejercicio | 5 |
| §8.5 Actividad de contenido y agenda | 6 |
| §9 Reparto de ficheros del frontend | 7–17 |
| §10 Pruebas (tareas, tema, menú, selector, gráficas, sábado, backend) | 1–17, cada una con las suyas |
| §11.4 Formularios largos en oscuro | 18, paso 4 |

**Lo que la spec dejaba fuera y sigue fuera:** buscador Ctrl K, «Parte del día», el estado «Todo al día» con recompensa, el Inicio de móvil apilado, comparar con el ejercicio anterior y exportar a PDF. El lienzo dibuja el buscador en la barra lateral: **no se implementa**.

**Lo que no se toca:** `rolesPorRutaCms`, las guardas de `routes/index.tsx`, `panel.routes.ts` y la web pública.
