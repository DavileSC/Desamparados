# Módulos del CMS activables por instalación: plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usar superpowers:subagent-driven-development (recomendada) o superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos llevan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** que cada instalación encienda y apague módulos (Tienda, Lotería, Procesión, Área de hermanos…) desde Sistema → «Módulos», solo Administración; apagado, un módulo no responde en la API (404), no sale en ningún menú ni ruta de la web y sus datos se conservan.

**Arquitectura:**
- Un **catálogo compartido** (`shared/modulos.json`) con una ficha por módulo (clave, nombre, grupo, descripción, requisitos) y una **copia tipada** de las claves en `domain/modulos.ts` de cada paquete, atadas por una prueba.
- El estado vive en la tabla `Modulo` (una fila por módulo) y el backend lo tiene **en memoria** (`ModulosService`): lo carga la primera vez que alguien pregunta y lo recarga al cambiar.
- Cada pieza lleva su **etiqueta `modulo`** (del catálogo o `nucleo`): los routers en `app.ts` (`conModulo(...)` / `nucleo`), las entradas de los tres menús, las rutas de `routes/index.tsx` (`pagina(Componente, modulo)`) y los tipos de bloque. Una **guardiana** lista lo que se quede sin etiqueta.
- Los enganches opcionales entre módulos (Procesión crea una noticia al abrir el plazo…) preguntan con `siModulo(...)`; las dependencias duras van en el catálogo (`requiere`).

**Stack:** Express 5 + TypeScript + Prisma 7 + MariaDB + arktype; React 19 + MUI 9 + React Query; `node:test` y Vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-modulos-del-cms-design.md` (leerlo antes de empezar).

## Restricciones globales

- Todo en español: código, comentarios (explican **por qué**), commits y textos. La corporación es «el Grupo Parroquial»; nunca «Hermandad» ni «Cofradía» en texto visible, y la guardiana `test/sin-corporacion-escrita.test.ts` impide escribir la corporación a mano: usar `domain/articulos.ts`.
- Solo `ADMIN` ve y cambia los módulos. Apagar es ocultar, no borrar.
- Un router apagado responde **404** `{ status: 'error', error: 'MODULO_NO_ACTIVADO', modulo, message }`. Lo fijo (núcleo) nunca pregunta por un módulo; solo los módulos preguntan por el núcleo o por otros módulos.
- Las 24 claves del catálogo, en este orden y sin inventar otras: `noticias`, `publicaciones`, `agenda`, `comunicados`, `alta-web`, `area-hermanos`, `procesion`, `puerta`, `cortejo-directo`, `inventario`, `cartas`, `difuntos`, `apadrinamientos`, `remesas`, `pago-en-linea`, `cuotas-en-linea`, `donativos`, `tienda`, `tienda-web`, `loteria`, `modelo-182`, `contabilidad`, `cabildos`, `informe-anual`. Lo que no está en esta lista es núcleo y lleva la marca `nucleo`.
- Migración de este PC (B): prefijo `…200000_`; la de este plan es `20261031200000_modulos_activables` (la última existente es `20261030200000_articulo_de_las_salidas`). Se escribe con `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, se aplica con `npx prisma migrate deploy` y después `npx prisma generate`. **Nunca `migrate dev`.**
- Comprobar tipos: backend `npm run comprobar-tipos`; web `npx tsc -b`. Pruebas: backend `npm test` (MariaDB en el contenedor `desamparados-mariadb`; una prueba con BD omitida no vale); web `npx vitest run --testTimeout=20000`. Lint de la web: `npm run lint`.
- `rtk` no funciona en este PC: usar `git` y `npm` directamente. Commits con `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Un commit por tarea, con título que diga qué cambia para quien usa la web.
- Las pruebas del backend que necesitan MariaDB se omiten **dentro del cuerpo** con `t.skip(SIN_DB)`; se levanta `app` en un puerto efímero y la cookie del CMS se fabrica con `generateToken` (patrón de `test/inventario-acceso.test.ts`). Datos propios con sufijo y limpieza en `after`; un módulo que una prueba apaga se vuelve a encender en `after`.
- Pruebas de la web: `renderWithProviders` (que desde la Tarea 7 siembra todos los módulos encendidos salvo que se pase `modulos: [...]`). Tras un diálogo de MUI, esperar a que se cierre antes de un `*ByRole`.
- Esta rama es `modulos-del-cms`; la hoja de ruta (`docs/hoja-de-ruta.md`, fila «Módulos del CMS activables por instalación») se actualiza en el último commit.

## Decisiones que afinan el spec (tomadas al escribir el plan)

1. **`itinerario` y `programa` son bloques del núcleo**, no de módulo: el itinerario es el recorrido de la procesión (sin él desaparecería la página Recorrido) y solo usa `cortejo-directo` para el punto en directo; el programa es editorial y solo usa `agenda` para la fecha del próximo culto. Los dos consultan su módulo **si está encendido** y se pintan igual sin él. (El spec los ponía en la lista de bloques de módulo.)
2. **Los avisos de la Junta no se filtran**: son textos manuales, no los genera ningún módulo. Lo que sí se filtra son las **tareas del día** del Inicio (`tareas.ts`): «citas de reparto» es de Procesión y «noticias en borrador» de Noticias.
3. **`Cortejo.tsx` también es código muerto** (solo lo importa `ComoVaElAnio.tsx`): se borran los dos con sus pruebas. El «anillo de papeletas» del spec era ese.
4. **Área de hermanos apagada**: el acceso `/acceso` rechaza a todo el mundo con «El área de hermanos no está activada en esta instalación.» (404) y la página enseña ese aviso con un enlace al acceso del CMS; una sesión de hermano que ya existiera se ignora en `middleware/session.ts`.
5. **URL del ropero**: las prendas, los cíngulos y la búsqueda por número de hermano pasan de `/api/inventario/...` a **`/api/ropero/...`** (router nuevo, módulo `procesion`). No hay usuarios todavía: no se mantiene la URL vieja.
6. **Remesas y Modelo 182 conservan su URL** (`/api/recibos/admin/remesas…`, `/api/recibos/admin/modelo-182…`): sus routers nuevos se montan **dentro** de `recibo.routes.ts` con su guarda. La web no cambia.
7. **El aviso del banco (`POST /api/pagos/redsys/notificacion`) nunca se apaga**: un pago empezado antes de apagar Pago en línea es dinero real. `/api/pagos` se monta como núcleo y dentro se guardan `/metodos` (pago-en-linea) y `/donativo…` (donativos).
8. **`/api/auth/reactivacion` queda en el núcleo** (reactivar una cuenta dada de baja no es «alta por la web»); solo `/register` es `alta-web`.
9. **Datos e informes** omite las áreas de módulos apagados (`procesion`, `inventario`, `agenda`); **el Informe anual** en PDF omite sus capítulos (III Cultos y actos, V Sábado de Pasión y Rosario, VII Patrimonio) y renumera; la página «de un vistazo» prescinde de la gráfica de papeletas sin Procesión.

## Mapa de ficheros

| Fichero | Qué hace |
|---|---|
| `shared/modulos.json` (nuevo) | El catálogo: 24 fichas con `clave`, `nombre`, `grupo`, `descripcion`, `requiere` |
| `shared/datos-entidad.json` | Bloque `modulos.activos`: el lote inicial de esta instalación (todos) |
| `shared/tipos-de-bloque.json` | Mapa `modulo` por tipo de bloque (`listado` por fuente) |
| `backend-desamparados/src/domain/modulos.ts` (nuevo) | Claves tipadas, catálogo, lote inicial, `requisitosQueFaltan`, `dependientesActivos` |
| `backend-desamparados/prisma/schema.prisma` + migración | Tabla `Modulo` |
| `backend-desamparados/src/services/modulos.service.ts` (nuevo) | Estado en memoria, siembra, `cambiar`, recuentos, `siModulo` |
| `backend-desamparados/src/middleware/modulos.ts` (nuevo) | `conModulo(clave)` y `nucleo` |
| `backend-desamparados/src/routes/modulos.routes.ts`, `controllers/modulos.controller.ts`, `schemas/modulos.schema.ts` (nuevos) | `GET /api/modulos`, `GET /api/cms/modulos`, `PUT /api/cms/modulos/:clave` |
| `backend-desamparados/src/app.ts` | Cada router montado con `conModulo(...)` o `nucleo` |
| `backend-desamparados/src/routes/remesas.routes.ts`, `modelo-182.routes.ts`, `ropero.routes.ts` (nuevos) | Las rutas que salen de `recibo.routes.ts` e `inventario.routes.ts` |
| `backend-desamparados/src/domain/datos-areas.ts`, `services/datos.service.ts`, `controllers/datos.controller.ts`, `services/informes/informes.ts` | Áreas y capítulos de módulos apagados fuera |
| `backend-desamparados/test/modulos-catalogo.test.ts`, `modulos-db.test.ts`, `modulos-api-db.test.ts`, `modulos-apagados-db.test.ts`, `modulos-cobertura.test.ts` (nuevos) | Las pruebas del backend y la guardiana |
| `desamparados-web/src/domain/modulos.ts` (nuevo) | La copia de la web: claves tipadas, `cumple(requisito, activos)` |
| `desamparados-web/src/lib/api/modulos.ts`, `hooks/useModulos.ts` (nuevos) | La lista de activos en React Query, una sola vez |
| `desamparados-web/src/routes/ExigeModulo.tsx` (nuevo), `routes/index.tsx` | La guarda de ruta y `pagina(Componente, modulo)` en todas las rutas |
| `desamparados-web/src/features/cms/ModuloNoActivadoPage.tsx`, `ModulosAdminPage.tsx` (nuevos) | «Este módulo no está activado» y la pantalla Sistema → Módulos |
| `desamparados-web/src/app/cmsNavegacion.ts`, `app/MarcoCms.tsx`, `app/areaHermanoNavegacion.ts` (nuevo), `app/MarcoAreaHermano.tsx`, `config/navegacion.ts`, `hooks/useMenuPublico.ts` (nuevo), `components/barra/*`, `components/PieDePagina.tsx`, `components/BarraDeNavegacion.tsx` | Los tres menús con `modulo` y filtrados |
| `desamparados-web/src/components/bloques/modulos.ts` (nuevo), `BloquesDePagina.tsx`, `RecorridoEnMapa.tsx`, `BloquePrograma.tsx`, `features/cms/constructor/GaleriaDeBloques.tsx`, `features/cms/bloques/formularios/breves.tsx` | Bloques de módulos apagados: no se pintan ni se ofrecen |
| `desamparados-web/src/features/cms/inicio/*`, `censo/FichaCenso.tsx`, `HermanoEditPage.tsx`, `TesoreriaAdminPage.tsx`, `HermanosAdminPage.tsx`, `ComunicadoEditPage.tsx`, `InventarioAdminPage.tsx`, `datos/InformeAnualPage.tsx`, `features/areaHermano/*` | Las pantallas mezcladas, condicionadas por trozos |
| `desamparados-web/src/test/AllTheProviders.tsx`, `test-utils.tsx` | Siembra de módulos en las pruebas |
| `docs/hoja-de-ruta.md`, `docs/notas-del-proyecto.md`, `docs/despliegue.md` | Estado, la trampa nueva y la migración |

---

## Fase A: cimientos del backend

### Tarea 1: El catálogo compartido y el dominio

**Ficheros:**
- Crear: `shared/modulos.json`, `backend-desamparados/src/domain/modulos.ts`, `backend-desamparados/test/modulos-catalogo.test.ts`
- Modificar: `shared/datos-entidad.json` (bloque `modulos` nuevo, al final, antes de `escudoUrl`)

**Interfaces que produce:**

```ts
// backend-desamparados/src/domain/modulos.ts
export const CLAVES_MODULO: readonly [ 'noticias', 'publicaciones', … ];   // las 24, en el orden del catálogo
export type ClaveModulo = (typeof CLAVES_MODULO)[number];
export const NUCLEO: 'nucleo';
export type Modulo = ClaveModulo | 'nucleo';
export interface FichaDeModulo { clave: ClaveModulo; nombre: string; grupo: string; descripcion: string; requiere: ClaveModulo[] }
export const CATALOGO_MODULOS: readonly FichaDeModulo[];
export const LOTE_INICIAL: readonly ClaveModulo[];
export function esClaveDeModulo(valor: unknown): valor is ClaveModulo;
export function fichaDe(clave: ClaveModulo): FichaDeModulo;
export function requisitosQueFaltan(clave: ClaveModulo, activos: ReadonlySet<string>): ClaveModulo[]; // transitivos, los más básicos primero
export function dependientesActivos(clave: ClaveModulo, activos: ReadonlySet<string>): ClaveModulo[]; // transitivos, en orden del catálogo
```

- [ ] **Paso 1: el catálogo**

Crear `shared/modulos.json`:

```json
{
  "_comentario": [
    "Los módulos que una instalación puede apagar desde Sistema → «Módulos» (solo Administración).",
    "Lo leen los dos lados: el servidor para montar cada router con su guarda y la web para",
    "filtrar menús, rutas y bloques. El núcleo (censo, recibos, el libro de apuntes, accesos,",
    "auditoría, Emails, subidas, la web básica, el Inicio y Datos e informes) NO está aquí:",
    "no se puede apagar, y cada pieza suya lleva la marca 'nucleo' para que la guardiana",
    "(backend-desamparados/test/modulos-cobertura.test.ts) vea que se decidió.",
    "",
    "requiere: dependencias duras (encender uno enciende antes lo que requiere; apagar uno",
    "con dependientes encendidos no se deja). Los enganches opcionales (Procesión crea una",
    "noticia si Noticias está) no van aquí: van en el código, preguntando con siModulo().",
    "grupo: el del menú del CMS (app/cmsNavegacion.ts), para agrupar la pantalla igual.",
    "",
    "Las claves van también escritas en src/domain/modulos.ts de cada paquete, para que una",
    "clave mal escrita no compile; una prueba a cada lado comprueba que las listas coinciden.",
    "El lote inicial de cada instalación va en shared/datos-entidad.json (modulos.activos)."
  ],
  "modulos": [
    { "clave": "noticias", "nombre": "Noticias", "grupo": "Web", "descripcion": "Las noticias de la web pública y su mesa en el CMS.", "requiere": [] },
    { "clave": "publicaciones", "nombre": "Publicaciones", "grupo": "Web", "descripcion": "Boletines, dossieres y demás publicaciones en PDF.", "requiere": [] },
    { "clave": "agenda", "nombre": "Agenda", "grupo": "Web", "descripcion": "Los cultos y actos de la Agenda pública y del Inicio del CMS.", "requiere": [] },
    { "clave": "comunicados", "nombre": "Boletín y avisos", "grupo": "Web", "descripcion": "El boletín por correo y los avisos a los hermanos, con sus suscripciones.", "requiere": [] },
    { "clave": "alta-web", "nombre": "Alta por la web", "grupo": "Web", "descripcion": "La página «Hazte hermano» y las solicitudes que llegan por ella; sin ella solo se da de alta en persona.", "requiere": [] },
    { "clave": "area-hermanos", "nombre": "Área de hermanos", "grupo": "Web", "descripcion": "El acceso de los hermanos a su perfil, su familia y sus recibos desde la web.", "requiere": [] },
    { "clave": "procesion", "nombre": "Procesión", "grupo": "Censo y procesión", "descripcion": "Salidas, plazo, turnos de reparto, mesa, papeletas, cortejo y el ropero (túnicas y cíngulos).", "requiere": ["agenda"] },
    { "clave": "puerta", "nombre": "Puerta del templo", "grupo": "Censo y procesión", "descripcion": "Leer el QR de las papeletas al entrar al templo.", "requiere": ["procesion"] },
    { "clave": "cortejo-directo", "nombre": "Cortejo en directo", "grupo": "Censo y procesión", "descripcion": "Dónde va el cortejo en la calle, en la web pública.", "requiere": [] },
    { "clave": "inventario", "nombre": "Inventario y patrimonio", "grupo": "Censo y procesión", "descripcion": "Los enseres, con su ficha de patrimonio.", "requiere": [] },
    { "clave": "cartas", "nombre": "Cartas y etiquetas", "grupo": "Censo y procesión", "descripcion": "Cartas y circulares de Secretaría a partir del censo.", "requiere": [] },
    { "clave": "difuntos", "nombre": "Difuntos y sufragios", "grupo": "Censo y procesión", "descripcion": "El registro de hermanos difuntos, sus sufragios y el pésame a la familia.", "requiere": [] },
    { "clave": "apadrinamientos", "nombre": "Apadrinamientos", "grupo": "Censo y procesión", "descripcion": "Apadrinar piezas sobre una foto, con pago en línea.", "requiere": ["pago-en-linea"] },
    { "clave": "remesas", "nombre": "Remesas SEPA y Norma 43", "grupo": "Cuentas", "descripcion": "El fichero de adeudos para el banco y la conciliación del extracto.", "requiere": [] },
    { "clave": "pago-en-linea", "nombre": "Pago en línea", "grupo": "Cuentas", "descripcion": "La pasarela del banco (Redsys) para cobrar con tarjeta o Bizum.", "requiere": [] },
    { "clave": "cuotas-en-linea", "nombre": "Cuotas en línea", "grupo": "Cuentas", "descripcion": "Que los hermanos paguen cuotas y papeletas desde su área.", "requiere": ["pago-en-linea", "area-hermanos"] },
    { "clave": "donativos", "nombre": "Donativos en línea", "grupo": "Cuentas", "descripcion": "El bloque «Donativo» de la web pública, sin cuenta.", "requiere": ["pago-en-linea"] },
    { "clave": "tienda", "nombre": "Tienda", "grupo": "Cuentas", "descripcion": "Los productos y la caja del CMS.", "requiere": [] },
    { "clave": "tienda-web", "nombre": "Tienda en la web", "grupo": "Cuentas", "descripcion": "Compra desde la web pública con pago en línea; la caja del CMS es el módulo «Tienda».", "requiere": ["tienda", "pago-en-linea"] },
    { "clave": "loteria", "nombre": "Lotería y talonarios", "grupo": "Cuentas", "descripcion": "Sorteos, talonarios y su contabilidad.", "requiere": [] },
    { "clave": "modelo-182", "nombre": "Modelo 182", "grupo": "Cuentas", "descripcion": "Los donativos del año para Hacienda y los certificados.", "requiere": [] },
    { "clave": "contabilidad", "nombre": "Contabilidad", "grupo": "Cuentas", "descripcion": "Las pantallas del libro de apuntes y la partida doble; los apuntes se registran siempre, esté o no encendida.", "requiere": [] },
    { "clave": "cabildos", "nombre": "Cabildos y actas", "grupo": "Junta", "descripcion": "Convocatorias, asistencia, votaciones y el libro de actas.", "requiere": [] },
    { "clave": "informe-anual", "nombre": "Informe anual", "grupo": "Junta", "descripcion": "La memoria del curso en PDF, con sus textos a mano.", "requiere": [] }
  ]
}
```

- [ ] **Paso 2: el lote inicial**

En `shared/datos-entidad.json`, antes de `"escudoUrl": null`, añadir:

```json
  "modulos": {
    "_comentario": [
      "Los módulos con los que arranca esta instalación (claves de shared/modulos.json). La",
      "siembra crea las filas que falten con este valor y NO toca las que ya existen: lo que",
      "Administración haya cambiado desde Sistema → «Módulos» manda. Un módulo del catálogo",
      "que no esté aquí arranca apagado. Desamparados arranca con todos."
    ],
    "activos": [
      "noticias", "publicaciones", "agenda", "comunicados", "alta-web", "area-hermanos",
      "procesion", "puerta", "cortejo-directo", "inventario", "cartas", "difuntos", "apadrinamientos",
      "remesas", "pago-en-linea", "cuotas-en-linea", "donativos", "tienda", "tienda-web", "loteria", "modelo-182", "contabilidad",
      "cabildos", "informe-anual"
    ]
  },
```

- [ ] **Paso 3: pruebas que fallan**

Crear `backend-desamparados/test/modulos-catalogo.test.ts`:

```ts
// El catálogo de módulos (shared/modulos.json) y el dominio que lo lee: que las
// claves escritas en domain/modulos.ts sean las del JSON, que los requisitos
// apunten a módulos que existen y no formen ciclos, y que las dos preguntas
// de la pantalla (qué falta para encender, qué impide apagar) salgan bien.
// Sin base de datos.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CATALOGO_MODULOS, CLAVES_MODULO, LOTE_INICIAL, dependientesActivos, esClaveDeModulo, fichaDe, requisitosQueFaltan,
} from '../src/domain/modulos.js';

const RAIZ = new URL('../../', import.meta.url);
const json = (ruta: string) => JSON.parse(readFileSync(fileURLToPath(new URL(ruta, RAIZ)), 'utf8'));
const GRUPOS_DEL_MENU = ['Web', 'Censo y procesión', 'Cuentas', 'Junta', 'Sistema'];

describe('el catálogo', () => {
  test('las claves escritas en domain/modulos.ts son las del JSON, en el mismo orden', () => {
    const delJson = (json('shared/modulos.json').modulos as { clave: string }[]).map((m) => m.clave);
    assert.deepEqual([...CLAVES_MODULO], delJson);
  });

  test('claves únicas, en minúsculas y con guiones; cada ficha con su nombre, grupo y descripción', () => {
    assert.equal(new Set(CLAVES_MODULO).size, CLAVES_MODULO.length);
    for (const m of CATALOGO_MODULOS) {
      assert.match(m.clave, /^[a-z0-9]+(-[a-z0-9]+)*$/, m.clave);
      assert.ok(m.nombre.trim() && m.descripcion.trim(), `${m.clave} sin nombre o descripción`);
      assert.ok(GRUPOS_DEL_MENU.includes(m.grupo), `${m.clave}: grupo «${m.grupo}» no es del menú del CMS`);
    }
  });

  test('los requisitos son módulos del catálogo, nadie se requiere a sí mismo y no hay ciclos', () => {
    for (const m of CATALOGO_MODULOS) {
      for (const r of m.requiere) {
        assert.ok(esClaveDeModulo(r), `${m.clave} requiere «${r}», que no existe`);
        assert.notEqual(r, m.clave);
      }
    }
    // Sin ciclos: encender cualquiera con todo apagado termina.
    for (const m of CATALOGO_MODULOS) requisitosQueFaltan(m.clave, new Set());
  });

  test('el lote inicial de esta instalación solo tiene claves del catálogo', () => {
    const activos = json('shared/datos-entidad.json').modulos.activos as string[];
    for (const c of activos) assert.ok(esClaveDeModulo(c), `datos-entidad.json enciende «${c}», que no existe`);
    assert.deepEqual([...LOTE_INICIAL], activos);
  });

  test('las dependencias que fija el spec', () => {
    assert.deepEqual(fichaDe('procesion').requiere, ['agenda']);
    assert.deepEqual(fichaDe('puerta').requiere, ['procesion']);
    assert.deepEqual(fichaDe('tienda-web').requiere, ['tienda', 'pago-en-linea']);
    assert.deepEqual(fichaDe('cuotas-en-linea').requiere, ['pago-en-linea', 'area-hermanos']);
    assert.deepEqual(fichaDe('donativos').requiere, ['pago-en-linea']);
    assert.deepEqual(fichaDe('apadrinamientos').requiere, ['pago-en-linea']);
  });
});

describe('qué falta para encender', () => {
  test('nada, si sus requisitos ya están', () => {
    assert.deepEqual(requisitosQueFaltan('puerta', new Set(['agenda', 'procesion'])), []);
  });

  test('los requisitos transitivos, los más básicos primero', () => {
    assert.deepEqual(requisitosQueFaltan('puerta', new Set()), ['agenda', 'procesion']);
    assert.deepEqual(requisitosQueFaltan('tienda-web', new Set(['tienda'])), ['pago-en-linea']);
    assert.deepEqual(requisitosQueFaltan('cuotas-en-linea', new Set()), ['pago-en-linea', 'area-hermanos']);
  });
});

describe('qué impide apagar', () => {
  test('nada, si nadie encendido lo requiere', () => {
    assert.deepEqual(dependientesActivos('pago-en-linea', new Set(['pago-en-linea', 'tienda'])), []);
    assert.deepEqual(dependientesActivos('tienda', new Set(['tienda', 'pago-en-linea'])), []);
  });

  test('los dependientes encendidos, también los transitivos', () => {
    const todos = new Set<string>(CLAVES_MODULO);
    assert.deepEqual(dependientesActivos('pago-en-linea', todos).sort(), ['apadrinamientos', 'cuotas-en-linea', 'donativos', 'tienda-web']);
    assert.deepEqual(dependientesActivos('agenda', todos).sort(), ['procesion', 'puerta']);
    assert.deepEqual(dependientesActivos('area-hermanos', new Set(['area-hermanos', 'pago-en-linea'])), []);
  });
});
```

- [ ] **Paso 4: ejecutar para verlas fallar**

```bash
cd backend-desamparados && npx tsx --test test/modulos-catalogo.test.ts
```
Esperado: falla al importar `../src/domain/modulos.js` (no existe).

- [ ] **Paso 5: el dominio**

Crear `backend-desamparados/src/domain/modulos.ts`:

```ts
import catalogo from '../../../shared/modulos.json' with { type: 'json' };
import datos from '../../../shared/datos-entidad.json' with { type: 'json' };

/**
 * Los módulos que una instalación puede apagar. Van escritos aquí, y no solo
 * en `shared/modulos.json`, para que `conModulo('tiend')` no compile: el
 * import de un JSON pierde los literales y deja `string`. La prueba
 * `test/modulos-catalogo.test.ts` comprueba que las dos listas son la misma,
 * en el mismo orden. La web lleva su copia en `src/domain/modulos.ts`.
 */
export const CLAVES_MODULO = [
  'noticias', 'publicaciones', 'agenda', 'comunicados', 'alta-web', 'area-hermanos',
  'procesion', 'puerta', 'cortejo-directo', 'inventario', 'cartas', 'difuntos', 'apadrinamientos',
  'remesas', 'pago-en-linea', 'cuotas-en-linea', 'donativos', 'tienda', 'tienda-web', 'loteria', 'modelo-182', 'contabilidad',
  'cabildos', 'informe-anual',
] as const;
export type ClaveModulo = (typeof CLAVES_MODULO)[number];

/**
 * La marca de lo que no se apaga. Existe para que cada pieza del núcleo lo
 * diga: la guardiana (`test/modulos-cobertura.test.ts`) no distingue «es del
 * núcleo» de «se olvidó la etiqueta» si no se escribe.
 */
export const NUCLEO = 'nucleo' as const;
export type Modulo = ClaveModulo | typeof NUCLEO;

export interface FichaDeModulo {
  clave: ClaveModulo;
  nombre: string;
  /** El grupo del menú del CMS, para agrupar la pantalla de Módulos igual. */
  grupo: string;
  descripcion: string;
  /** Dependencias duras: sin ellas encendidas, este no se enciende. */
  requiere: ClaveModulo[];
}

export const CATALOGO_MODULOS: readonly FichaDeModulo[] = catalogo.modulos as FichaDeModulo[];

export const esClaveDeModulo = (valor: unknown): valor is ClaveModulo =>
  typeof valor === 'string' && (CLAVES_MODULO as readonly string[]).includes(valor);

export function fichaDe(clave: ClaveModulo): FichaDeModulo {
  const ficha = CATALOGO_MODULOS.find((m) => m.clave === clave);
  if (!ficha) throw new Error(`El módulo «${clave}» no está en shared/modulos.json`);
  return ficha;
}

/** Con qué arranca esta instalación. Una clave que no sea del catálogo se ignora. */
export const LOTE_INICIAL: readonly ClaveModulo[] = (datos.modulos.activos as string[]).filter(esClaveDeModulo);

/**
 * Lo que hay que encender antes de encender `clave`: sus requisitos y los de
 * estos, sin los que ya están. Los más básicos primero, que es el orden en
 * que se encienden.
 */
export function requisitosQueFaltan(clave: ClaveModulo, activos: ReadonlySet<string>): ClaveModulo[] {
  const faltan: ClaveModulo[] = [];
  const vistos = new Set<ClaveModulo>([clave]);
  const visitar = (c: ClaveModulo) => {
    for (const r of fichaDe(c).requiere) {
      if (activos.has(r) || vistos.has(r)) continue;
      vistos.add(r);
      visitar(r);
      faltan.push(r);
    }
  };
  visitar(clave);
  return faltan;
}

/**
 * Los módulos encendidos que requieren `clave`, directa o indirectamente:
 * mientras haya alguno, `clave` no se puede apagar. En el orden del catálogo.
 */
export function dependientesActivos(clave: ClaveModulo, activos: ReadonlySet<string>): ClaveModulo[] {
  const dependientes = new Set<ClaveModulo>();
  const visitar = (c: ClaveModulo) => {
    for (const m of CATALOGO_MODULOS) {
      if (!activos.has(m.clave) || dependientes.has(m.clave) || !m.requiere.includes(c)) continue;
      dependientes.add(m.clave);
      visitar(m.clave);
    }
  };
  visitar(clave);
  return CLAVES_MODULO.filter((c) => dependientes.has(c));
}
```

- [ ] **Paso 6: ejecutar las pruebas**

```bash
cd backend-desamparados && npx tsx --test test/modulos-catalogo.test.ts && npm run comprobar-tipos
```
Esperado: todo en verde.

- [ ] **Paso 7: commit**

```bash
git add shared/modulos.json shared/datos-entidad.json backend-desamparados/src/domain/modulos.ts backend-desamparados/test/modulos-catalogo.test.ts
git commit -m "Módulos: el catálogo compartido y sus dependencias"
```

---

### Tarea 2: La tabla `Modulo`, el estado en memoria y la siembra

**Ficheros:**
- Modificar: `backend-desamparados/prisma/schema.prisma` (modelo nuevo tras `Configuracion`), `backend-desamparados/prisma/seed.ts`, `backend-desamparados/src/services/auditoria.service.ts` (dos acciones), `backend-desamparados/src/index.ts`
- Crear: `backend-desamparados/prisma/migrations/20261031200000_modulos_activables/migration.sql`, `backend-desamparados/src/services/modulos.service.ts`, `backend-desamparados/test/modulos-db.test.ts`

**Interfaces que produce:**

```ts
// backend-desamparados/src/services/modulos.service.ts
export interface RecuentoDeDatos { que: string; total: number }
export interface ModuloDelCms extends FichaDeModulo { activo: boolean; cambiadoEl: string | null; cambiadoPor: string | null; datos: RecuentoDeDatos[] }
export type ResultadoDeCambio =
  | { ok: true; cambiados: ClaveModulo[]; activos: ClaveModulo[] }
  | { ok: false; message: string; faltan: ClaveModulo[]; dependientes: ClaveModulo[] };
export class ModulosService {
  static sembrar(lote?: readonly ClaveModulo[]): Promise<number>;        // filas creadas
  static cargar(): Promise<ReadonlySet<ClaveModulo>>;                     // relee la base (sembrando lo que falte)
  static activos(): Promise<ReadonlySet<ClaveModulo>>;                    // en memoria; carga una sola vez
  static activo(clave: ClaveModulo): Promise<boolean>;
  static olvidar(): void;                                                 // para las pruebas
  static cambiar(clave: string, activar: boolean, opciones: { conRequisitos?: boolean }, quienId: number | undefined, meta: MetaDeAuditoria): Promise<ResultadoDeCambio>;
  static listarCms(): Promise<ModuloDelCms[]>;
}
export function siModulo<T>(clave: ClaveModulo, accion: () => Promise<T>): Promise<T | undefined>;
```
Acciones de auditoría nuevas: `MODULO_ENCENDER`, `MODULO_APAGAR`.

- [ ] **Paso 1: el modelo y la migración**

En `prisma/schema.prisma`, debajo del modelo `Configuracion`:

```prisma
/// Qué módulos tiene encendidos esta instalación. El catálogo (nombre, grupo,
/// requisitos) vive en shared/modulos.json; aquí solo el interruptor y quién
/// lo tocó. Apagar no borra nada: los datos del módulo siguen en sus tablas.
model Modulo {
  clave       String   @id @db.VarChar(40)
  activo      Boolean
  cambiadoEl  DateTime @default(now())
  /// El correo de quien lo cambió desde el CMS; null si lo puso la siembra.
  cambiadoPor String?  @db.VarChar(120)
}
```

Generar el SQL y guardarlo:

```bash
cd backend-desamparados && mkdir -p prisma/migrations/20261031200000_modulos_activables
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/20261031200000_modulos_activables/migration.sql
```

Revisar el fichero: solo debe traer el `CREATE TABLE` de `Modulo` (si trae otra cosa, la base local no está al día: `npx prisma migrate deploy` antes y repetir). Encabezarlo con el comentario y dejarlo así:

```sql
-- Módulos del CMS activables por instalación: una fila por módulo del catálogo
-- (shared/modulos.json) con su interruptor. La siembra crea las que falten con
-- el lote inicial de shared/datos-entidad.json y no toca las que ya existen.
-- CreateTable
CREATE TABLE `Modulo` (
    `clave` VARCHAR(40) NOT NULL,
    `activo` BOOLEAN NOT NULL,
    `cambiadoEl` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cambiadoPor` VARCHAR(120) NULL,

    PRIMARY KEY (`clave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Aplicar y regenerar:

```bash
npx prisma migrate deploy && npx prisma generate
```

- [ ] **Paso 2: las dos acciones de auditoría**

En `src/services/auditoria.service.ts`, dentro de `ACCIONES_AUDITORIA`, antes de `EMAIL_FALLIDO`:

```ts
  // Sistema → Módulos: encender o apagar un módulo de la instalación
  MODULO_ENCENDER: 'MODULO_ENCENDER',
  MODULO_APAGAR: 'MODULO_APAGAR',
```

- [ ] **Paso 3: pruebas que fallan**

Crear `backend-desamparados/test/modulos-db.test.ts`:

```ts
// El estado de los módulos contra MariaDB: la siembra crea lo que falta y no
// pisa lo que Administración cambió; cambiar respeta las dependencias y deja
// auditoría; el recuento dice cuántos datos tiene cada módulo.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import db from '../src/config/db.js';
import { ACCIONES_AUDITORIA } from '../src/services/auditoria.service.js';
import { ModulosService, siModulo } from '../src/services/modulos.service.js';
import { CLAVES_MODULO } from '../src/domain/modulos.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let dbDisponible = false;
/** Lo que había antes, para dejarlo igual. */
let estadoInicial: { clave: string; activo: boolean }[] = [];
const META = { userId: undefined, ip: '127.0.0.1', userAgent: 'prueba' };

before(async () => {
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (!dbDisponible) return;
  await ModulosService.sembrar();
  estadoInicial = await db.modulo.findMany({ select: { clave: true, activo: true } });
});

after(async () => {
  if (dbDisponible) {
    for (const fila of estadoInicial) await db.modulo.update({ where: { clave: fila.clave }, data: { activo: fila.activo } });
    await db.auditLog.deleteMany({ where: { action: { in: [ACCIONES_AUDITORIA.MODULO_ENCENDER, ACCIONES_AUDITORIA.MODULO_APAGAR] }, userAgent: 'prueba' } });
    ModulosService.olvidar();
  }
  await db.$disconnect();
});

const activosEnBase = async () => new Set((await db.modulo.findMany({ where: { activo: true }, select: { clave: true } })).map((f) => f.clave));

describe('la siembra', () => {
  test('crea una fila por módulo del catálogo y no toca las que existen', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await db.modulo.update({ where: { clave: 'loteria' }, data: { activo: false } });
    await db.modulo.delete({ where: { clave: 'cartas' } });
    const creadas = await ModulosService.sembrar();
    assert.equal(creadas, 1, 'solo la que faltaba');
    const filas = await db.modulo.findMany({ select: { clave: true, activo: true } });
    assert.equal(filas.length, CLAVES_MODULO.length);
    assert.equal(filas.find((f) => f.clave === 'loteria')?.activo, false, 'lo apagado sigue apagado');
    assert.equal(filas.find((f) => f.clave === 'cartas')?.activo, true, 'la nueva arranca con el lote');
    await db.modulo.update({ where: { clave: 'loteria' }, data: { activo: true } });
  });

  test('un módulo del catálogo que el lote no nombra arranca apagado', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await db.modulo.delete({ where: { clave: 'cabildos' } });
    await ModulosService.sembrar(['noticias']);
    assert.equal((await db.modulo.findUnique({ where: { clave: 'cabildos' } }))?.activo, false);
    await db.modulo.update({ where: { clave: 'cabildos' }, data: { activo: true } });
  });
});

describe('en memoria', () => {
  test('cargar lee la base y activo() responde sin volver a leerla', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    ModulosService.olvidar();
    const activos = await ModulosService.activos();
    assert.deepEqual([...activos].sort(), [...(await activosEnBase())].sort());
    await db.modulo.update({ where: { clave: 'loteria' }, data: { activo: false } });
    assert.equal(await ModulosService.activo('loteria'), true, 'la memoria no cambia hasta recargar');
    await ModulosService.cargar();
    assert.equal(await ModulosService.activo('loteria'), false);
    await db.modulo.update({ where: { clave: 'loteria' }, data: { activo: true } });
    await ModulosService.cargar();
  });

  test('siModulo hace la acción solo con el módulo encendido', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal(await siModulo('loteria', async () => 'hecho'), 'hecho');
    await ModulosService.cambiar('loteria', false, {}, undefined, META);
    assert.equal(await siModulo('loteria', async () => 'hecho'), undefined);
    await ModulosService.cambiar('loteria', true, {}, undefined, META);
  });
});

describe('cambiar', () => {
  test('encender con requisitos apagados: no lo hace y dice cuáles faltan', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await ModulosService.cambiar('tienda-web', false, {}, undefined, META);
    await ModulosService.cambiar('tienda', false, {}, undefined, META);
    const r = await ModulosService.cambiar('tienda-web', true, {}, undefined, META);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.deepEqual(r.faltan, ['tienda']);
      assert.match(r.message, /«Tienda»/);
    }
    assert.equal(await ModulosService.activo('tienda-web'), false);
  });

  test('con conRequisitos enciende primero lo que falta y lo audita todo', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const r = await ModulosService.cambiar('tienda-web', true, { conRequisitos: true }, undefined, META);
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.cambiados, ['tienda', 'tienda-web']);
    assert.equal(await ModulosService.activo('tienda'), true);
    assert.equal(await ModulosService.activo('tienda-web'), true);
    const auditados = await db.auditLog.findMany({ where: { action: ACCIONES_AUDITORIA.MODULO_ENCENDER, userAgent: 'prueba' }, orderBy: { id: 'asc' } });
    assert.deepEqual(auditados.map((a) => a.entityId), ['tienda', 'tienda-web']);
    assert.deepEqual(auditados[0].detalles, { porRequisitoDe: 'tienda-web' });
  });

  test('apagar con dependientes encendidos: no lo hace y dice cuáles', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const r = await ModulosService.cambiar('pago-en-linea', false, {}, undefined, META);
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.deepEqual(r.dependientes.sort(), ['apadrinamientos', 'cuotas-en-linea', 'donativos', 'tienda-web']);
      assert.match(r.message, /No se puede apagar «Pago en línea»/);
    }
    assert.equal(await ModulosService.activo('pago-en-linea'), true);
  });

  test('apagar uno sin dependientes: apaga, queda en la base y en la auditoría, con quién', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const admin = await db.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true, email: true } });
    const r = await ModulosService.cambiar('loteria', false, {}, admin?.id, META);
    assert.equal(r.ok, true);
    assert.equal(await ModulosService.activo('loteria'), false);
    const fila = await db.modulo.findUnique({ where: { clave: 'loteria' } });
    assert.equal(fila?.activo, false);
    assert.equal(fila?.cambiadoPor, admin?.email ?? null);
    const auditado = await db.auditLog.findFirst({ where: { action: ACCIONES_AUDITORIA.MODULO_APAGAR, entityId: 'loteria', userAgent: 'prueba' } });
    assert.ok(auditado);
    await ModulosService.cambiar('loteria', true, {}, undefined, META);
  });

  test('una clave que no es del catálogo es un 404', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    await assert.rejects(ModulosService.cambiar('tiendaa', true, {}, undefined, META), (e: Error & { status?: number }) => e.status === 404);
  });
});

describe('la lista del CMS', () => {
  test('una ficha por módulo, con su estado y cuántos datos tiene', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const lista = await ModulosService.listarCms();
    assert.deepEqual(lista.map((m) => m.clave), [...CLAVES_MODULO]);
    const tienda = lista.find((m) => m.clave === 'tienda')!;
    assert.equal(typeof tienda.activo, 'boolean');
    assert.deepEqual(tienda.datos.map((d) => d.que), ['productos', 'ventas de caja']);
    assert.ok(tienda.datos.every((d) => Number.isInteger(d.total) && d.total >= 0));
    assert.deepEqual(lista.find((m) => m.clave === 'contabilidad')!.datos, [], 'el libro es del núcleo: la pantalla no tiene datos propios');
  });
});
```

- [ ] **Paso 4: ejecutar para verlas fallar**

```bash
cd backend-desamparados && npx tsx --test test/modulos-db.test.ts
```
Esperado: falla al importar el servicio.

- [ ] **Paso 5: el servicio**

Crear `backend-desamparados/src/services/modulos.service.ts`:

```ts
import { EstadoPedido, OrigenPago, TipoPagoEnLinea } from '@prisma/client';
import db from '../config/db.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from './auditoria.service.js';
import { NotFoundError } from '../utils/error.handle.js';
import {
  CATALOGO_MODULOS, CLAVES_MODULO, LOTE_INICIAL, dependientesActivos, esClaveDeModulo, fichaDe, requisitosQueFaltan,
  type ClaveModulo, type FichaDeModulo,
} from '../domain/modulos.js';

export interface RecuentoDeDatos { que: string; total: number }

export interface ModuloDelCms extends FichaDeModulo {
  activo: boolean;
  cambiadoEl: string | null;
  cambiadoPor: string | null;
  /** Cuántos datos tiene («12 productos»): se enseñan antes de apagar, para que se sepa qué se oculta. */
  datos: RecuentoDeDatos[];
}

export type ResultadoDeCambio =
  | { ok: true; cambiados: ClaveModulo[]; activos: ClaveModulo[] }
  | { ok: false; message: string; faltan: ClaveModulo[]; dependientes: ClaveModulo[] };

/**
 * Lo que cada módulo tiene guardado: un `count` por modelo principal. Lo que
 * no tiene modelo propio (la Puerta lee papeletas, el Modelo 182 lee recibos,
 * Contabilidad lee el libro, que es del núcleo) devuelve la lista vacía.
 */
const RECUENTOS: Record<ClaveModulo, () => Promise<RecuentoDeDatos[]>> = {
  noticias: async () => [{ que: 'noticias', total: await db.noticia.count() }],
  publicaciones: async () => [{ que: 'publicaciones', total: await db.publicacion.count() }],
  agenda: async () => [{ que: 'actos', total: await db.evento.count() }],
  comunicados: async () => [{ que: 'comunicados', total: await db.comunicado.count() }],
  'alta-web': async () => [],
  'area-hermanos': async () => [],
  procesion: async () => [
    { que: 'salidas', total: await db.salida.count() },
    { que: 'papeletas', total: await db.papeletaSitio.count() },
    { que: 'turnos de reparto', total: await db.turno.count() },
    { que: 'prendas del ropero', total: await db.prenda.count() },
  ],
  puerta: async () => [],
  'cortejo-directo': async () => [],
  inventario: async () => [{ que: 'enseres', total: await db.enser.count() }],
  cartas: async () => [{ que: 'cartas', total: await db.carta.count() }],
  difuntos: async () => [{ que: 'sufragios', total: await db.sufragio.count() }],
  apadrinamientos: async () => [
    { que: 'campañas', total: await db.campanaApadrinamiento.count() },
    { que: 'apadrinamientos', total: await db.apadrinamiento.count() },
  ],
  remesas: async () => [{ que: 'remesas', total: await db.remesa.count() }],
  'pago-en-linea': async () => [{ que: 'pagos en línea', total: await db.pagoEnLinea.count() }],
  'cuotas-en-linea': async () => [{ que: 'pagos desde el área', total: await db.pagoEnLinea.count({ where: { origen: OrigenPago.AREA_HERMANOS } }) }],
  donativos: async () => [{ que: 'donativos', total: await db.pagoEnLinea.count({ where: { tipo: TipoPagoEnLinea.DONATIVO } }) }],
  tienda: async () => [
    { que: 'productos', total: await db.producto.count() },
    { que: 'ventas de caja', total: await db.cajaVenta.count() },
  ],
  'tienda-web': async () => [{ que: 'pedidos', total: await db.pedidoTienda.count({ where: { estado: { not: EstadoPedido.PENDIENTE_PAGO } } }) }],
  loteria: async () => [
    { que: 'sorteos', total: await db.sorteoLoteria.count() },
    { que: 'talonarios', total: await db.talonarioLoteria.count() },
  ],
  'modelo-182': async () => [],
  contabilidad: async () => [],
  cabildos: async () => [{ que: 'cabildos', total: await db.cabildo.count() }],
  'informe-anual': async () => [{ que: 'informes', total: await db.informeAnual.count() }],
};

const nombres = (claves: ClaveModulo[]) => claves.map((c) => `«${fichaDe(c).nombre}»`).join(', ');

/**
 * Los módulos encendidos, en memoria: es un solo proceso y cada petición
 * pregunta por ellos. Se cargan la primera vez que alguien pregunta (así los
 * tests, que importan `app` sin pasar por index.ts, no tienen que acordarse)
 * y se recargan al cambiar.
 */
let activos: Set<ClaveModulo> | null = null;
let cargando: Promise<ReadonlySet<ClaveModulo>> | null = null;

export class ModulosService {
  /** Crea las filas que falten con el lote; las que existen no se tocan. Devuelve cuántas creó. */
  static async sembrar(lote: readonly ClaveModulo[] = LOTE_INICIAL): Promise<number> {
    const existentes = new Set((await db.modulo.findMany({ select: { clave: true } })).map((f) => f.clave));
    const nuevas = CLAVES_MODULO.filter((c) => !existentes.has(c)).map((clave) => ({ clave, activo: lote.includes(clave) }));
    if (nuevas.length) await db.modulo.createMany({ data: nuevas });
    return nuevas.length;
  }

  /** Relee la base (sembrando lo que falte) y lo deja en memoria. */
  static async cargar(): Promise<ReadonlySet<ClaveModulo>> {
    await ModulosService.sembrar();
    const filas = await db.modulo.findMany({ where: { activo: true }, select: { clave: true } });
    // Una fila con una clave que ya no está en el catálogo se ignora.
    activos = new Set(filas.map((f) => f.clave).filter(esClaveDeModulo));
    return activos;
  }

  static async activos(): Promise<ReadonlySet<ClaveModulo>> {
    if (activos) return activos;
    // Varias peticiones a la vez comparten una sola carga.
    cargando ??= ModulosService.cargar().finally(() => { cargando = null; });
    return cargando;
  }

  static async activo(clave: ClaveModulo): Promise<boolean> {
    return (await ModulosService.activos()).has(clave);
  }

  /** Para las pruebas: como recién arrancado. */
  static olvidar(): void {
    activos = null;
  }

  /**
   * Enciende o apaga un módulo respetando el catálogo: encender uno con
   * requisitos apagados solo se hace con `conRequisitos` (y los enciende
   * antes, cada uno con su apunte de auditoría); apagar uno que otros
   * encendidos requieren no se hace nunca. Devuelve qué pasó en vez de lanzar:
   * la pantalla necesita las listas para proponer o explicar.
   */
  static async cambiar(
    clave: string, activar: boolean, opciones: { conRequisitos?: boolean }, quienId: number | undefined, meta: MetaDeAuditoria,
  ): Promise<ResultadoDeCambio> {
    if (!esClaveDeModulo(clave)) throw new NotFoundError('No hay ningún módulo con esa clave.');
    const antes = await ModulosService.activos();
    const ficha = fichaDe(clave);
    let cambiados: ClaveModulo[];
    if (activar) {
      const faltan = requisitosQueFaltan(clave, antes);
      if (faltan.length && !opciones.conRequisitos) {
        return { ok: false, faltan, dependientes: [], message: `Para encender «${ficha.nombre}» hay que encender también ${nombres(faltan)}.` };
      }
      cambiados = [...faltan, clave].filter((c) => !antes.has(c));
    } else {
      const dependientes = dependientesActivos(clave, antes);
      if (dependientes.length) {
        return { ok: false, faltan: [], dependientes, message: `No se puede apagar «${ficha.nombre}»: lo necesitan ${nombres(dependientes)}. Apaga antes esos módulos.` };
      }
      cambiados = antes.has(clave) ? [clave] : [];
    }
    const cambiadoPor = quienId === undefined ? null : (await db.user.findUnique({ where: { id: quienId }, select: { email: true } }))?.email ?? null;
    for (const c of cambiados) {
      await db.modulo.upsert({
        where: { clave: c },
        update: { activo: activar, cambiadoEl: new Date(), cambiadoPor },
        create: { clave: c, activo: activar, cambiadoPor },
      });
      await AuditoriaService.log(
        activar ? ACCIONES_AUDITORIA.MODULO_ENCENDER : ACCIONES_AUDITORIA.MODULO_APAGAR,
        meta, 'modulo', c, c === clave ? undefined : { porRequisitoDe: clave },
      );
    }
    const despues = await ModulosService.cargar();
    return { ok: true, cambiados, activos: CLAVES_MODULO.filter((c) => despues.has(c)) };
  }

  static async listarCms(): Promise<ModuloDelCms[]> {
    const encendidos = await ModulosService.activos();
    const filas = new Map((await db.modulo.findMany()).map((f) => [f.clave, f]));
    return Promise.all(CATALOGO_MODULOS.map(async (m) => ({
      ...m,
      activo: encendidos.has(m.clave),
      cambiadoEl: filas.get(m.clave)?.cambiadoEl.toISOString() ?? null,
      cambiadoPor: filas.get(m.clave)?.cambiadoPor ?? null,
      datos: await RECUENTOS[m.clave](),
    })));
  }
}

/**
 * Un enganche opcional entre módulos: la acción solo se hace con el módulo
 * encendido (Procesión crea una noticia al abrir el plazo si Noticias está).
 * Lo fijo nunca lo usa: el núcleo no pregunta por nadie.
 */
export async function siModulo<T>(clave: ClaveModulo, accion: () => Promise<T>): Promise<T | undefined> {
  return (await ModulosService.activo(clave)) ? accion() : undefined;
}
```

- [ ] **Paso 6: la siembra y el arranque**

En `prisma/seed.ts`, importar y llamar después de `sembrarSalidas()`:

```ts
import { ModulosService } from '../src/services/modulos.service';
// …en main(), tras await sembrarSalidas():
  const modulosNuevos = await ModulosService.sembrar();
  console.log(`   ${modulosNuevos} módulos nuevos (los que ya existían no se tocan)`);
```

En `src/index.ts`, justo después de `const { default: db } = await import('./config/db');`:

```ts
// Los módulos encendidos, en memoria antes de la primera petición. Si la base
// no responde, no se arranca a ciegas con todo apagado: se sale y systemd
// vuelve a intentarlo.
const { ModulosService } = await import('./services/modulos.service');
try {
  const encendidos = await ModulosService.cargar();
  console.log(`[Módulos] ${encendidos.size} encendidos: ${[...encendidos].join(', ') || 'ninguno'}`);
} catch (error) {
  console.error(`[Módulos] No se pudieron leer los módulos de la base de datos: ${describirErrorParaLog(error)}`);
  process.exit(1);
}
```

- [ ] **Paso 7: ejecutar las pruebas**

```bash
cd backend-desamparados && npx tsx --test test/modulos-db.test.ts test/modulos-catalogo.test.ts && npm run comprobar-tipos
```
Esperado: todo en verde, sin omisiones (MariaDB levantada).

- [ ] **Paso 8: commit**

```bash
git add backend-desamparados/prisma/schema.prisma backend-desamparados/prisma/migrations/20261031200000_modulos_activables backend-desamparados/prisma/seed.ts backend-desamparados/src/services/modulos.service.ts backend-desamparados/src/services/auditoria.service.ts backend-desamparados/src/index.ts backend-desamparados/test/modulos-db.test.ts
git commit -m "Módulos: el estado de cada instalación, en la base y en memoria

Migración 20261031200000_modulos_activables (hay que aplicarla al desplegar; la siembra crea las filas con todo encendido)."
```

---

### Tarea 3: La guarda `conModulo`, la API pública y la de Administración

**Ficheros:**
- Crear: `backend-desamparados/src/middleware/modulos.ts`, `backend-desamparados/src/schemas/modulos.schema.ts`, `backend-desamparados/src/controllers/modulos.controller.ts`, `backend-desamparados/src/routes/modulos.routes.ts`, `backend-desamparados/test/modulos-api-db.test.ts`
- Modificar: `backend-desamparados/src/app.ts` (montar los dos routers; el resto de montajes se etiquetan en la Tarea 4)

**Interfaces que produce:**

```ts
// middleware/modulos.ts
export const conModulo: (clave: ClaveModulo) => RequestHandler;   // apagado → 404 MODULO_NO_ACTIVADO
export const nucleo: RequestHandler;                               // deja pasar; es la marca para la guardiana
// API
// GET  /api/modulos                → 200 { activos: ClaveModulo[] }        (sin sesión)
// GET  /api/cms/modulos            → 200 ModuloDelCms[]                     (ADMIN)
// PUT  /api/cms/modulos/:clave     body { activo: boolean, conRequisitos?: boolean }
//      → 200 { ok: true, cambiados, activos } | 400 { status:'error', message, faltan, dependientes } | 404 clave desconocida
```

- [ ] **Paso 1: pruebas que fallan**

Crear `backend-desamparados/test/modulos-api-db.test.ts`:

```ts
// La API de los módulos: la lista pública que la web pide al arrancar, la
// pantalla de Administración (solo ADMIN) y la guarda conModulo, que
// responde 404 con el módulo apagado y deja pasar con él encendido.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { ModulosService } from '../src/services/modulos.service.js';
import { conModulo, nucleo } from '../src/middleware/modulos.js';
import { CLAVES_MODULO } from '../src/domain/modulos.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let dbDisponible = false;
let server: Server;
let baseUrl: string;
const usuarios: number[] = [];
const META = { ip: '127.0.0.1', userAgent: 'prueba-api' };

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  if (dbDisponible) {
    // Todo lo que estas pruebas apagan se vuelve a encender.
    for (const clave of ['loteria', 'tienda', 'tienda-web'] as const) await ModulosService.cambiar(clave, true, { conRequisitos: true }, undefined, META);
    await db.auditLog.deleteMany({ where: { userAgent: 'prueba-api' } });
    for (const id of usuarios) await borrarUsuarioPrueba(id);
  }
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  await db.$disconnect();
});

async function cargo(role: Role) {
  const u = await crearUsuarioPrueba(role);
  usuarios.push(u.id);
  return `${COOKIE_CMS}=${generateToken(u.id, role, false, 'cms')}`;
}
const pedir = (ruta: string, cookie?: string, method = 'GET', cuerpo?: unknown) =>
  fetch(`${baseUrl}${ruta}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
  });

describe('GET /api/modulos', () => {
  test('sin sesión, la lista de claves activas', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const r = await pedir('/api/modulos');
    assert.equal(r.status, 200);
    const { activos } = await r.json() as { activos: string[] };
    assert.ok(Array.isArray(activos));
    for (const c of activos) assert.ok((CLAVES_MODULO as readonly string[]).includes(c), c);
    assert.ok(activos.includes('noticias'));
  });
});

describe('Sistema → Módulos', () => {
  test('solo Administración lee y cambia', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    assert.equal((await pedir('/api/cms/modulos')).status, 401);
    const tesoreria = await cargo(Role.TESORERIA);
    assert.equal((await pedir('/api/cms/modulos', tesoreria)).status, 403);
    assert.equal((await pedir('/api/cms/modulos/loteria', tesoreria, 'PUT', { activo: false })).status, 403);
    const admin = await cargo(Role.ADMIN);
    const r = await pedir('/api/cms/modulos', admin);
    assert.equal(r.status, 200);
    const lista = await r.json() as { clave: string; activo: boolean; datos: { que: string; total: number }[] }[];
    assert.deepEqual(lista.map((m) => m.clave), [...CLAVES_MODULO]);
    assert.ok(lista.find((m) => m.clave === 'tienda')!.datos.some((d) => d.que === 'productos'));
  });

  test('encender sin requisitos es un 400 con lo que falta; con conRequisitos, enciende', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const admin = await cargo(Role.ADMIN);
    await ModulosService.cambiar('tienda-web', false, {}, undefined, META);
    await ModulosService.cambiar('tienda', false, {}, undefined, META);
    const no = await pedir('/api/cms/modulos/tienda-web', admin, 'PUT', { activo: true });
    assert.equal(no.status, 400);
    const cuerpo = await no.json() as { message: string; faltan: string[]; dependientes: string[] };
    assert.deepEqual(cuerpo.faltan, ['tienda']);
    assert.deepEqual(cuerpo.dependientes, []);
    const si = await pedir('/api/cms/modulos/tienda-web', admin, 'PUT', { activo: true, conRequisitos: true });
    assert.equal(si.status, 200);
    const hecho = await si.json() as { ok: boolean; cambiados: string[]; activos: string[] };
    assert.deepEqual(hecho.cambiados, ['tienda', 'tienda-web']);
    assert.ok(hecho.activos.includes('tienda-web'));
  });

  test('apagar con dependientes es un 400 con cuáles; una clave desconocida, 404; un cuerpo raro, 400', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const admin = await cargo(Role.ADMIN);
    const no = await pedir('/api/cms/modulos/tienda', admin, 'PUT', { activo: false });
    assert.equal(no.status, 400);
    assert.deepEqual((await no.json() as { dependientes: string[] }).dependientes, ['tienda-web']);
    assert.equal((await pedir('/api/cms/modulos/tiendaa', admin, 'PUT', { activo: false })).status, 404);
    assert.equal((await pedir('/api/cms/modulos/tienda', admin, 'PUT', { activo: 'no' })).status, 400);
  });
});

describe('conModulo', () => {
  test('apagado responde 404 con el nombre del módulo; encendido deja pasar; nucleo siempre pasa', async (t) => {
    if (!dbDisponible) return t.skip(SIN_DB);
    const mini = express();
    mini.get('/loteria', conModulo('loteria'), (_req, res) => { res.json({ ok: true }); });
    mini.get('/fijo', nucleo, (_req, res) => { res.json({ ok: true }); });
    const s = mini.listen(0);
    await new Promise<void>((resolve) => s.once('listening', resolve));
    const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    try {
      await ModulosService.cambiar('loteria', false, {}, undefined, META);
      const r = await fetch(`${url}/loteria`);
      assert.equal(r.status, 404);
      const cuerpo = await r.json() as { error: string; modulo: string; message: string };
      assert.equal(cuerpo.error, 'MODULO_NO_ACTIVADO');
      assert.equal(cuerpo.modulo, 'loteria');
      assert.match(cuerpo.message, /«Lotería y talonarios» no está activado en esta instalación/);
      assert.equal((await fetch(`${url}/fijo`)).status, 200);
      await ModulosService.cambiar('loteria', true, {}, undefined, META);
      assert.equal((await fetch(`${url}/loteria`)).status, 200);
    } finally {
      await new Promise<void>((resolve) => s.close(() => resolve()));
    }
  });
});
```

- [ ] **Paso 2: ejecutar para verlas fallar**

```bash
cd backend-desamparados && npx tsx --test test/modulos-api-db.test.ts
```
Esperado: falla al importar `../src/middleware/modulos.js`.

- [ ] **Paso 3: el middleware**

Crear `backend-desamparados/src/middleware/modulos.ts`:

```ts
import type { RequestHandler } from 'express';
import { ModulosService } from '../services/modulos.service.js';
import { fichaDe, type ClaveModulo } from '../domain/modulos.js';

/**
 * La guarda de un router (o de una ruta suelta) de un módulo: apagado,
 * responde 404 con un mensaje claro y la clave, para que la web distinga
 * «no existe» de «no está activado». Va en `app.ts` delante de cada router
 * (`app.use('/api/tienda', conModulo('tienda'), tiendaRoutes)`) y, dentro de
 * un router que mezcla módulos, delante de las rutas del otro.
 */
export const conModulo = (clave: ClaveModulo): RequestHandler => async (_req, res, next) => {
  try {
    if (await ModulosService.activo(clave)) return next();
    res.status(404).json({
      status: 'error',
      error: 'MODULO_NO_ACTIVADO',
      modulo: clave,
      message: `El módulo «${fichaDe(clave).nombre}» no está activado en esta instalación.`,
    });
  } catch (e) {
    next(e);
  }
};

/**
 * La marca de un router del núcleo: no hace nada. Existe para que
 * `test/modulos-cobertura.test.ts` pueda exigir que TODO montaje de `app.ts`
 * diga de qué módulo es, y un router nuevo sin decidirlo no pase.
 */
export const nucleo: RequestHandler = (_req, _res, next) => next();
```

- [ ] **Paso 4: esquema, controlador y rutas**

Crear `backend-desamparados/src/schemas/modulos.schema.ts`:

```ts
import { type } from 'arktype';

export const cambiarModuloSchema = type({
  params: { clave: type('string').matching(/^[a-z0-9]+(-[a-z0-9]+)*$/).describe('la clave de un módulo') },
  body: { activo: 'boolean', 'conRequisitos?': 'boolean' },
});
```

Crear `backend-desamparados/src/controllers/modulos.controller.ts`:

```ts
import { ModulosService } from '../services/modulos.service.js';
import { AuditoriaService } from '../services/auditoria.service.js';
import { manejar } from '../utils/manejar.js';

export class ModulosController {
  /** Sin sesión: la web lo pide al arrancar, antes de pintar ningún menú. */
  static activos = manejar('Error leyendo los módulos', async (_req, res) => {
    res.status(200).json({ activos: [...(await ModulosService.activos())] });
  });

  static listar = manejar('Error leyendo los módulos', async (_req, res) => {
    res.status(200).json(await ModulosService.listarCms());
  });

  static cambiar = manejar('Error cambiando el módulo', async (req, res) => {
    const resultado = await ModulosService.cambiar(
      String(req.params.clave), req.body.activo === true, { conRequisitos: req.body.conRequisitos === true },
      req.user?.id, AuditoriaService.metaFromReq(req),
    );
    // Lo que no se puede hacer no es un fallo del servidor: es un 400 con las
    // listas, para que la pantalla proponga encender lo que falta o diga qué
    // apagar antes.
    if (!resultado.ok) {
      res.status(400).json({ status: 'error', message: resultado.message, faltan: resultado.faltan, dependientes: resultado.dependientes });
      return;
    }
    res.status(200).json(resultado);
  });
}
```

Crear `backend-desamparados/src/routes/modulos.routes.ts`:

```ts
import { Router } from 'express';
import { Role } from '@prisma/client';
import { ModulosController } from '../controllers/modulos.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { cambiarModuloSchema } from '../schemas/modulos.schema.js';

/** La lista de activos: pública, porque la web la necesita antes de que nadie entre (barra, pie, rutas). */
const modulosRouter = Router();
modulosRouter.get('/', ModulosController.activos);

/** Sistema → Módulos: solo Administración. Encender un módulo es abrir pantallas y rutas a toda la junta. */
const modulosCmsRouter = Router();
modulosCmsRouter.use(authenticateToken);
modulosCmsRouter.use(checkRole([Role.ADMIN]));
modulosCmsRouter.get('/', ModulosController.listar);
modulosCmsRouter.put('/:clave', validate(cambiarModuloSchema), ModulosController.cambiar);

export { modulosRouter as modulosRoutes, modulosCmsRouter as modulosCmsRoutes };
```

En `src/app.ts`, importar y montar (al final del bloque 3, después de `/api/contenido`):

```ts
import { modulosRoutes, modulosCmsRoutes } from './routes/modulos.routes.js';
import { nucleo } from './middleware/modulos.js';
// …
app.use('/api/modulos', nucleo, modulosRoutes);         // Qué módulos están encendidos, para la web
app.use('/api/cms/modulos', nucleo, modulosCmsRoutes);  // Encenderlos y apagarlos, desde Sistema → Módulos
```

- [ ] **Paso 5: ejecutar las pruebas**

```bash
cd backend-desamparados && npx tsx --test test/modulos-api-db.test.ts && npm run comprobar-tipos
```
Esperado: todo en verde.

- [ ] **Paso 6: commit**

```bash
git add backend-desamparados/src/middleware/modulos.ts backend-desamparados/src/schemas/modulos.schema.ts backend-desamparados/src/controllers/modulos.controller.ts backend-desamparados/src/routes/modulos.routes.ts backend-desamparados/src/app.ts backend-desamparados/test/modulos-api-db.test.ts
git commit -m "Módulos: la guarda conModulo y la API para verlos y cambiarlos"
```

---
### Tarea 4: Cada router con su módulo, y las rutas mezcladas partidas

**Ficheros:**
- Modificar: `backend-desamparados/src/app.ts` (todos los montajes), `src/routes/recibo.routes.ts`, `src/routes/inventario.routes.ts`, `src/routes/procesion.routes.ts`, `src/routes/pago.routes.ts`, `src/routes/tienda.routes.ts`, `src/routes/hermano.routes.ts`, `src/routes/datos.routes.ts`, `src/routes/auth.routes.ts`, `backend-desamparados/test/inventario-ropero.test.ts`, `backend-desamparados/test/integration.test.ts` (las rutas del ropero), `desamparados-web/src/lib/api/inventario.ts` (URL del ropero)
- Crear: `backend-desamparados/src/routes/remesas.routes.ts`, `src/routes/modelo-182.routes.ts`, `src/routes/ropero.routes.ts`, `backend-desamparados/test/modulos-apagados-db.test.ts`

**Interfaces que produce:**
- `app.ts`: toda línea `app.use('/api/…', X, router)` lleva `X` = `conModulo('<clave>')` o `nucleo`.
- Rutas nuevas: `/api/ropero/prendas…`, `/api/ropero/cingulos`, `/api/ropero/hermanos/:numeroHermano` (módulo `procesion`). Las de remesas y Modelo 182 conservan su dirección.
- Guardas dentro de routers: `/api/recibos/mis-recibos/certificados*` (modelo-182), `/api/recibos/mis-recibos/pagar` y `/mis-recibos/pagos/:pedido` (cuotas-en-linea), `/api/procesion/admin/puerta*` (puerta), `/api/pagos/metodos` (pago-en-linea), `/api/pagos/donativo*` (donativos), `/api/tienda`, `/api/tienda/pedidos*` (tienda-web), `/api/hermanos/admin/difuntos*` y `/admin/sufragios/:id` (difuntos), `/api/datos/informe-anual*` (informe-anual), `/api/auth/register` (alta-web).

- [ ] **Paso 1: pruebas que fallan**

Crear `backend-desamparados/test/modulos-apagados-db.test.ts`:

```ts
// Apagado un módulo, sus rutas responden 404 MODULO_NO_ACTIVADO y las del
// núcleo siguen; encendido, vuelven. Se apaga escribiendo en la tabla (sin la
// regla de dependencias, que ya prueba modulos-db.test.ts) y recargando.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { ModulosService } from '../src/services/modulos.service.js';
import { CLAVES_MODULO, type ClaveModulo } from '../src/domain/modulos.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
let dbDisponible = false;
let server: Server;
let baseUrl: string;
let admin: { id: number; cookie: string };

/** Una ruta de cada módulo. Con el módulo encendido puede responder lo que sea (200, 400, un 404 natural): lo que no puede es decir MODULO_NO_ACTIVADO. */
const RUTAS: Record<ClaveModulo, { method?: string; ruta: string }[]> = {
  noticias: [{ ruta: '/api/news' }],
  publicaciones: [{ ruta: '/api/publications' }],
  agenda: [{ ruta: '/api/events' }],
  comunicados: [{ ruta: '/api/comunicados' }],
  'alta-web': [{ method: 'POST', ruta: '/api/auth/register' }],
  'area-hermanos': [], // se prueba en modulos-area-hermanos-db.test.ts
  procesion: [{ ruta: '/api/procesion/dias' }, { ruta: '/api/salidas' }, { ruta: '/api/cms/salidas' }, { ruta: '/api/ropero/cingulos' }],
  puerta: [{ ruta: '/api/procesion/admin/puerta' }],
  'cortejo-directo': [{ ruta: '/api/cortejo-directo' }],
  inventario: [{ ruta: '/api/inventario/enseres' }, { ruta: '/api/inventario/dashboard' }],
  cartas: [{ ruta: '/api/cartas' }],
  difuntos: [{ ruta: '/api/hermanos/admin/difuntos' }, { method: 'DELETE', ruta: '/api/hermanos/admin/sufragios/1' }],
  apadrinamientos: [{ ruta: '/api/apadrinamientos' }],
  remesas: [{ ruta: '/api/recibos/admin/remesas' }, { method: 'POST', ruta: '/api/recibos/admin/remesas/norma43/previa' }],
  'pago-en-linea': [{ ruta: '/api/pagos/metodos' }],
  'cuotas-en-linea': [{ method: 'POST', ruta: '/api/recibos/mis-recibos/pagar' }, { ruta: '/api/recibos/mis-recibos/pagos/abc' }],
  donativos: [{ method: 'POST', ruta: '/api/pagos/donativo' }, { ruta: '/api/pagos/donativo/abc' }],
  tienda: [{ ruta: '/api/tienda/admin' }],
  'tienda-web': [{ ruta: '/api/tienda' }, { ruta: '/api/tienda/pedidos/abc' }],
  loteria: [{ ruta: '/api/loteria' }],
  'modelo-182': [{ ruta: '/api/recibos/admin/modelo-182' }, { ruta: '/api/recibos/mis-recibos/certificados' }],
  contabilidad: [{ ruta: '/api/transacciones' }],
  cabildos: [{ ruta: '/api/cabildos' }],
  'informe-anual': [{ ruta: '/api/datos/informe-anual/2025' }],
};

/** Rutas del núcleo que tienen que seguir aunque TODO esté apagado. */
const NUCLEO = ['/api/modulos', '/api/auth/me', '/api/recibos/admin/resumen', '/api/datos', '/api/panel', '/api/cms/modulos'];

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
  if (!dbDisponible) return;
  const u = await crearUsuarioPrueba(Role.ADMIN);
  admin = { id: u.id, cookie: `${COOKIE_CMS}=${generateToken(u.id, Role.ADMIN, false, 'cms')}` };
});

after(async () => {
  if (dbDisponible) {
    await db.modulo.updateMany({ data: { activo: true } });
    await ModulosService.cargar();
    await borrarUsuarioPrueba(admin.id);
  }
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  await db.$disconnect();
});

async function ponerEnBase(claves: readonly string[], activo: boolean) {
  await db.modulo.updateMany({ where: { clave: { in: [...claves] } }, data: { activo } });
  await ModulosService.cargar();
}

async function respuesta(method: string, ruta: string) {
  const r = await fetch(`${baseUrl}${ruta}`, { method, headers: { Cookie: admin.cookie, 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : '{}' });
  const texto = await r.text();
  let error: string | undefined;
  try { error = (JSON.parse(texto) as { error?: string }).error; } catch { /* no es JSON (un PDF, un 404 de Express) */ }
  return { status: r.status, error };
}

test('cada módulo apagado responde MODULO_NO_ACTIVADO en sus rutas; encendido, no', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  for (const clave of CLAVES_MODULO) {
    for (const { method = 'GET', ruta } of RUTAS[clave]) {
      await ponerEnBase([clave], false);
      const apagado = await respuesta(method, ruta);
      assert.equal(apagado.status, 404, `${clave}: ${method} ${ruta} apagado respondió ${apagado.status}`);
      assert.equal(apagado.error, 'MODULO_NO_ACTIVADO', `${clave}: ${method} ${ruta} apagado`);
      await ponerEnBase([clave], true);
      const encendido = await respuesta(method, ruta);
      assert.notEqual(encendido.error, 'MODULO_NO_ACTIVADO', `${clave}: ${method} ${ruta} encendido`);
    }
  }
});

test('con todo apagado, el núcleo sigue respondiendo', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  await ponerEnBase(CLAVES_MODULO, false);
  for (const ruta of NUCLEO) {
    const r = await respuesta('GET', ruta);
    assert.notEqual(r.error, 'MODULO_NO_ACTIVADO', ruta);
    assert.ok(r.status < 500, `${ruta} respondió ${r.status}`);
  }
  await ponerEnBase(CLAVES_MODULO, true);
});

test('el aviso del banco no se apaga nunca: un pago empezado antes es dinero real', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  await ponerEnBase(['pago-en-linea', 'donativos'], false);
  const r = await fetch(`${baseUrl}/api/pagos/redsys/notificacion`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'a=1' });
  assert.notEqual(r.status, 404);
  await ponerEnBase(['pago-en-linea', 'donativos'], true);
});
```

- [ ] **Paso 2: ejecutar para verlas fallar**

```bash
cd backend-desamparados && npx tsx --test test/modulos-apagados-db.test.ts
```
Esperado: falla en la primera ruta (todo responde sin guarda).

- [ ] **Paso 3: `app.ts`, cada montaje con su módulo**

Importar `conModulo` junto a `nucleo` y dejar el bloque 3 así (mismos routers, mismos comentarios, cada uno con su etiqueta):

```ts
import { conModulo, nucleo } from './middleware/modulos.js';
import { roperoRoutes } from './routes/ropero.routes.js';
// …
// Cada router dice de qué módulo es: `conModulo('…')` responde 404 con el
// módulo apagado; `nucleo` es lo que no se apaga. Sin una de las dos marcas,
// test/modulos-cobertura.test.ts falla: un router nuevo tiene que decidirlo.
app.use('/api/auth', nucleo, authRoutes);       // Login y Registro (el registro lleva dentro la guarda de alta-web)
app.use('/api/hermanos', nucleo, hermanoRoutes); // Gestión de Cofrades (los difuntos llevan dentro su guarda)
app.use('/api/cartas', conModulo('cartas'), cartaRoutes);     // Cartas y circulares de Secretaría
app.use('/api/recibos', nucleo, reciboRoutes);   // Pagos y Tesorería (remesas, Modelo 182 y cuotas en línea, dentro con su guarda)
app.use('/api/pagos', nucleo, pagoRoutes);       // Avisos del banco (Redsys), sin sesión; nunca se apaga (dentro: métodos y donativo)
app.use('/api/pages', nucleo, paginaRoutes);     // Contenido estático
app.use('/api/events', conModulo('agenda'), agendaRoutes);    // Agenda
app.use('/api/news', conModulo('noticias'), noticiaRoutes);        // Noticias
app.use('/api/publications', conModulo('publicaciones'), publicacionRoutes); // Publicaciones
app.use('/api/contact', nucleo, contactoRoutes); // Formulario de contacto
app.use('/api/upload', nucleo, subidaRoutes); // Subida de archivos
app.use('/api/inventario', conModulo('inventario'), inventarioRoutes); // Inventario de enseres
app.use('/api/ropero', conModulo('procesion'), roperoRoutes); // Túnicas, prendas y cíngulos: parte de Procesión, no del Inventario
app.use('/api/admin', nucleo, adminRoutes); // GESTIÓN DE STAFF Y ROLES
app.use('/api/procesion', conModulo('procesion'), procesionRoutes); // Citas, papeletas y turnos (la Puerta lleva dentro su guarda)
app.use('/api/salidas', conModulo('procesion'), salidasRoutes);  // Las salidas activas, para la web y el área de hermanos
app.use('/api/cms/salidas', conModulo('procesion'), salidasCmsRoutes); // Alta, edición y fecha de las salidas, desde el CMS
app.use('/api/transacciones', conModulo('contabilidad'), transaccionRoutes); // Contabilidad: las pantallas; los apuntes se escriben siempre
app.use('/api/panel', nucleo, panelRoutes);      // Panel del CMS
app.use('/api/datos', nucleo, datosRoutes);      // Datos e informes de la junta (el Informe anual lleva dentro su guarda)
app.use('/api/comunicados', conModulo('comunicados'), comunicadosRoutes); // Boletín y avisos por correo
app.use('/api/cabildos', conModulo('cabildos'), cabildosRoutes); // Cabildos y libro de actas
app.use('/api/tienda', conModulo('tienda'), tiendaRoutes); // Tienda: la caja y los productos (la compra desde la web, dentro con tienda-web)
app.use('/api/plantillas-correo', nucleo, plantillasCorreoRoutes); // Emails: las plantillas de los correos
app.use('/api/loteria', conModulo('loteria'), loteriaRoutes); // Lotería: sorteos, talonarios y su contabilidad
app.use('/api/apadrinamientos', conModulo('apadrinamientos'), apadrinamientosRoutes); // Apadrinar piezas sobre una foto, sin sesión
app.use('/api/cortejo-directo', conModulo('cortejo-directo'), cortejoDirectoRoutes); // Dónde va el cortejo en la calle
app.use('/api/portada', nucleo, portadaRoutes);  // Fotos de la cabecera del inicio
app.use('/api/secciones', nucleo, seccionesRoutes); // Secciones guardadas del constructor de páginas
app.use('/api/contenido', nucleo, contenidoRoutes); // Textos editables de la portada, el recorrido y la historia
app.use('/api/modulos', nucleo, modulosRoutes);         // Qué módulos están encendidos, para la web
app.use('/api/cms/modulos', nucleo, modulosCmsRoutes);  // Encenderlos y apagarlos, desde Sistema → Módulos
```

- [ ] **Paso 4: remesas y Modelo 182 salen de `recibo.routes.ts`**

Crear `backend-desamparados/src/routes/remesas.routes.ts`:

```ts
import { Router } from 'express';
import { Role } from '@prisma/client';
import { type } from 'arktype';
import { RemesaController } from '../controllers/remesa.controller.js';
import { Norma43Controller } from '../controllers/norma43.controller.js';
import { ficheroDeDatosMiddleware } from '../middleware/upload.middleware.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { idParam } from '../config/common.js';
import { remesaSchema } from '../schemas/recibo.schema.js';

/**
 * Remesas SEPA y Norma 43: el módulo `remesas`. Se monta DENTRO de
 * recibo.routes.ts en `/admin/remesas`, detrás de su guarda, para que las
 * direcciones de siempre sigan valiendo y, apagado, respondan 404 sin que el
 * resto de los recibos (que es núcleo) se entere.
 */
const remesasRouter = Router();
const validateId = validate(type({ params: { id: idParam } }));
const rolesTesoreria = [Role.ADMIN, Role.TESORERIA, Role.HERMANO_MAYOR];

remesasRouter.get('/', checkRole(rolesTesoreria), RemesaController.estado);
remesasRouter.post('/previa', checkRole(rolesTesoreria), validate(remesaSchema), RemesaController.previa);
remesasRouter.post('/', checkRole(rolesTesoreria), validate(remesaSchema), RemesaController.generar);
// El extracto del banco en Norma 43: casa devoluciones y cobros de las remesas.
// El fichero va a memoria y no se guarda: se lee y se descarta.
remesasRouter.post('/norma43/previa', checkRole(rolesTesoreria), ficheroDeDatosMiddleware.single('fichero'), Norma43Controller.previa);
remesasRouter.post('/norma43/aplicar', checkRole(rolesTesoreria), ficheroDeDatosMiddleware.single('fichero'), Norma43Controller.aplicar);
remesasRouter.get('/:id/fichero', checkRole(rolesTesoreria), validateId, RemesaController.fichero);
remesasRouter.post('/:id/cobrar', checkRole(rolesTesoreria), validateId, RemesaController.darPorCobrada);

export { remesasRouter as remesasRoutes };
```

Crear `backend-desamparados/src/routes/modelo-182.routes.ts`:

```ts
import { Router } from 'express';
import { Role } from '@prisma/client';
import { Modelo182Controller } from '../controllers/modelo-182.controller.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { certificadosQuerySchema, configuracionModelo182Schema, ejercicioQuerySchema, ficheroModelo182Schema } from '../schemas/modelo-182.schema.js';

/**
 * El Modelo 182 (módulo `modelo-182`): los donativos del año para Hacienda y
 * los certificados. Montado dentro de recibo.routes.ts en `/admin/modelo-182`
 * con su guarda; los certificados propios del hermano (`/mis-recibos/
 * certificados`) se quedan allí con la misma guarda en línea.
 */
const modelo182Router = Router();
const rolesTesoreria = [Role.ADMIN, Role.TESORERIA, Role.HERMANO_MAYOR];

modelo182Router.get('/', checkRole(rolesTesoreria), validate(ejercicioQuerySchema), Modelo182Controller.resumen);
modelo182Router.put('/configuracion', checkRole([Role.ADMIN, Role.TESORERIA]), validate(configuracionModelo182Schema), Modelo182Controller.guardarConfiguracion);
modelo182Router.get('/fichero', checkRole(rolesTesoreria), validate(ficheroModelo182Schema), Modelo182Controller.fichero);
modelo182Router.get('/certificados', checkRole(rolesTesoreria), validate(certificadosQuerySchema), Modelo182Controller.certificados);
modelo182Router.post('/enviar', checkRole([Role.ADMIN, Role.TESORERIA]), validate(ejercicioQuerySchema), Modelo182Controller.enviar);

export { modelo182Router as modelo182Routes };
```

En `recibo.routes.ts`:
- Quitar las importaciones de `RemesaController`, `Norma43Controller`, `ficheroDeDatosMiddleware`, `configuracionModelo182Schema`, `ejercicioQuerySchema`, `ficheroModelo182Schema` y `remesaSchema` (se quedan `Modelo182Controller` y `certificadosQuerySchema`, que usan los certificados propios). Importar `conModulo` de `../middleware/modulos.js`, `remesasRoutes` y `modelo182Routes`.
- Las cuatro rutas de hermano que son de módulo, con su guarda en línea:

```ts
reciboRoutes.get('/mis-recibos/certificados', conModulo('modelo-182'), Modelo182Controller.misCertificados);
reciboRoutes.get('/mis-recibos/certificados/pdf', conModulo('modelo-182'), validate(certificadosQuerySchema), Modelo182Controller.miCertificado);
// …
reciboRoutes.post('/mis-recibos/pagar', conModulo('cuotas-en-linea'), validate(pagarEnLineaSchema), ReciboController.pagarEnLinea);
reciboRoutes.get('/mis-recibos/pagos/:pedido', conModulo('cuotas-en-linea'), validate(estadoDePagoSchema), ReciboController.estadoDelPago);
```
- Sustituir el bloque de las diez rutas de `/admin/modelo-182…`, `/admin/remesas…` y `/admin/remesas/norma43…` por:

```ts
// El Modelo 182 y las remesas (con la Norma 43) son módulos: cada uno en su
// router, montado aquí con su guarda para conservar la dirección. Antes de
// `/admin/:id`, que se tragaría «remesas» y «modelo-182» como un id.
reciboRoutes.use('/admin/modelo-182', conModulo('modelo-182'), modelo182Routes);
reciboRoutes.use('/admin/remesas', conModulo('remesas'), remesasRoutes);
```

- [ ] **Paso 5: el ropero sale de `inventario.routes.ts`**

Crear `backend-desamparados/src/routes/ropero.routes.ts` con las once rutas de prendas, cíngulos y la búsqueda por número (copiadas tal cual de `inventario.routes.ts`, con sus comentarios de orden, mismo `rolesGestores` y mismos esquemas):

```ts
import { Router } from 'express';
import { Role } from '@prisma/client';
import { type } from 'arktype';
import { InventarioController } from '../controllers/inventario.controller.js';
import { authenticateToken } from '../middleware/session.js';
import { checkRole } from '../middleware/checkRole.js';
import { validate } from '../config/validate.js';
import { idParam } from '../config/common.js';
import {
  createPrendaSchema, updatePrendaSchema, queryPrendaSchema,
  asignarPrendaSchema, devolverPrendaSchema, numeroHermanoParamSchema, prendasLavadasSchema, totalCingulosSchema,
} from '../schemas/inventario.schema.js';

/**
 * El ropero (túnicas, prendas y cíngulos) es parte de Procesión, no del
 * Inventario: toda corporación tiene túnica y la mesa escribe en `Prenda`.
 * Vivía en /api/inventario; con los módulos se monta en /api/ropero con la
 * guarda de `procesion`, para que apagar el Inventario (los enseres) no se
 * lleve el ropero. Los controladores siguen siendo los del inventario.
 */
const roperoRoutes = Router();
roperoRoutes.use(authenticateToken);
const validateId = validate(type({ params: { id: idParam } }));
const rolesGestores = [Role.ADMIN, Role.ALBACERIA, Role.HERMANO_MAYOR];

// LECTURA (solo gestores): cada prenda prestada lleva el nombre, los apellidos
// y el número de hermano de quien la tiene.
roperoRoutes.get('/prendas', checkRole(rolesGestores), validate(queryPrendaSchema), InventarioController.listPrendas);
// ':id' se traga cualquier segmento suelto: un GET literal nuevo ('/prendas/disponibles'…) va por encima de esta línea.
roperoRoutes.get('/prendas/:id', checkRole(rolesGestores), validateId, InventarioController.getOnePrenda);
roperoRoutes.post('/prendas', checkRole(rolesGestores), validate(createPrendaSchema), InventarioController.createPrenda);
roperoRoutes.put('/prendas/:id', checkRole(rolesGestores), validateId, validate(updatePrendaSchema), InventarioController.updatePrenda);
roperoRoutes.delete('/prendas/:id', checkRole(rolesGestores), validateId, InventarioController.deletePrenda);
// Antes de prestar, el CMS enseña a quién. Cuelga de '/hermanos' para que ningún '/prendas/:id' se lo trague.
roperoRoutes.get('/hermanos/:numeroHermano', checkRole(rolesGestores), validate(numeroHermanoParamSchema), InventarioController.buscarHermano);
roperoRoutes.post('/prendas/:id/asignar', checkRole(rolesGestores), validateId, validate(asignarPrendaSchema), InventarioController.asignarPrenda);
roperoRoutes.post('/prendas/:id/devolver', checkRole(rolesGestores), validateId, validate(devolverPrendaSchema), InventarioController.devolverPrenda);
// Las del lavado que ya están limpias vuelven a estar disponibles.
roperoRoutes.post('/prendas/lavadas', checkRole(rolesGestores), validate(prendasLavadasSchema), InventarioController.prendasLavadas);
// Los cíngulos no van numerados: se cuentan.
roperoRoutes.get('/cingulos', checkRole(rolesGestores), InventarioController.cingulos);
roperoRoutes.put('/cingulos', checkRole(rolesGestores), validate(totalCingulosSchema), InventarioController.cambiarCingulos);

export { roperoRoutes };
```

En `inventario.routes.ts` quitar el bloque «2. ROPERO» entero (de `/prendas` a `/cingulos`) y las importaciones de esquemas que ya no se usan; dejar `/dashboard` y los enseres, y en el comentario de cabecera decir que el ropero está en `ropero.routes.ts`.

En `test/inventario-ropero.test.ts` y `test/integration.test.ts`, cambiar `/api/inventario/prendas` → `/api/ropero/prendas`, `/api/inventario/cingulos` → `/api/ropero/cingulos` y `/api/inventario/hermanos/` → `/api/ropero/hermanos/` (buscar con `grep -n "inventario/prendas\|inventario/cingulos\|inventario/hermanos" test/*.ts`).

En `desamparados-web/src/lib/api/inventario.ts`, las mismas sustituciones (`/inventario/prendas` → `/ropero/prendas`, `/inventario/cingulos` → `/ropero/cingulos`, `/inventario/hermanos/` → `/ropero/hermanos/`), y un comentario encima del primer `listarPrendas`: «El ropero es de Procesión y vive en /api/ropero (ver backend ropero.routes.ts)». Comprobar con `grep -rn "inventario/prendas\|inventario/cingulos\|inventario/hermanos" src` que no queda ninguna (tampoco en `__tests__`; si una prueba de la web simula fetch por esa URL, cambiarla).

- [ ] **Paso 6: las guardas en línea del resto de routers**

`procesion.routes.ts` (importar `conModulo`): en las cuatro rutas de la Puerta, `conModulo('puerta')` detrás de `checkRole(rolesJunta)`:

```ts
// La Puerta del templo es un módulo aparte dentro de Procesión: su guarda va en cada ruta.
procesionRouter.get('/admin/puerta', checkRole(rolesJunta), conModulo('puerta'), validate(salidaQuerySchema), PuertaController.estado);
procesionRouter.post('/admin/puerta/escanear', checkRole(rolesJunta), conModulo('puerta'), validate(puertaEscanearSchema), PuertaController.escanear);
procesionRouter.post('/admin/puerta/papeletas/:id', checkRole(rolesJunta), conModulo('puerta'), validate(type({ params: { id: idParam } }).and(puertaEntradaSchema)), PuertaController.entrar);
procesionRouter.delete('/admin/puerta/papeletas/:id', checkRole(rolesJunta), conModulo('puerta'), validateId, PuertaController.deshacer);
```

`pago.routes.ts`:

```ts
// Lo que la web pública necesita para ofrecer un pago: solo con la pasarela encendida.
pagoRoutes.get('/metodos', conModulo('pago-en-linea'), PagoController.metodos);
// El donativo desde la web pública, sin cuenta: su propio módulo (que requiere la pasarela).
pagoRoutes.post('/donativo', conModulo('donativos'), limitadorDonativo, validate(donativoSchema), PagoController.donar);
pagoRoutes.get('/donativo/:pedido', conModulo('donativos'), validate(estadoDeDonativoSchema), PagoController.estadoDelDonativo);
```
y encima de `/redsys/notificacion` el porqué de que no lleve guarda: «Sin guarda a propósito: un pago empezado antes de apagar Pago en línea es dinero real y el banco avisa una sola vez».

`tienda.routes.ts`:

```ts
// La compra desde la web pública es el módulo tienda-web; la caja (/admin) es «tienda».
tiendaRoutes.get('/', conModulo('tienda-web'), TiendaController.catalogo);
tiendaRoutes.post('/pedidos', conModulo('tienda-web'), limitadorCompras, validate(compraSchema), TiendaController.comprar);
tiendaRoutes.get('/pedidos/:token', conModulo('tienda-web'), validate(tokenPedidoSchema), TiendaController.pedido);
```

`hermano.routes.ts`, justo encima de las rutas de difuntos (línea ~79):

```ts
// Los difuntos y sus sufragios son un módulo: todo lo que cuelga de /admin/difuntos, y el borrado de un sufragio.
hermanoRouter.use('/admin/difuntos', conModulo('difuntos'));
```
y en `DELETE /admin/sufragios/:id`, `conModulo('difuntos')` detrás de `checkRole(rolesGestionCenso)`.

`datos.routes.ts`, encima de las tres rutas de `/informe-anual/:anio`:

```ts
// El Informe anual es un módulo; Datos e informes, núcleo.
datosRoutes.use('/informe-anual', conModulo('informe-anual'));
```

`auth.routes.ts`, línea del registro:

```ts
authRoutes.post('/register', conModulo('alta-web'), authLimiter, recibirAlta, validate(registerSchema), comprobarDocumentosDelAlta, AuthController.register);
```

- [ ] **Paso 7: ejecutar las pruebas**

```bash
cd backend-desamparados && npm run comprobar-tipos && npx tsx --test test/modulos-apagados-db.test.ts test/inventario-ropero.test.ts test/inventario-acceso.test.ts test/integration.test.ts test/modelo-182-db.test.ts test/norma43.test.ts
cd ../desamparados-web && npx tsc -b && npx vitest run --testTimeout=20000 src/features/cms/__tests__/InventarioAdminPage.test.tsx src/features/cms/__tests__/InventarioEditPage.test.tsx
```
Esperado: todo en verde. Si una prueba existente sondeaba una ruta de remesas o del Modelo 182 por su dirección, sigue valiendo (no cambian).

- [ ] **Paso 8: commit**

```bash
git add backend-desamparados/src/app.ts backend-desamparados/src/routes backend-desamparados/test/modulos-apagados-db.test.ts backend-desamparados/test/inventario-ropero.test.ts backend-desamparados/test/integration.test.ts desamparados-web/src/lib/api/inventario.ts
git commit -m "Módulos: cada router con su guarda; el ropero pasa a /api/ropero

Las remesas (con la Norma 43) y el Modelo 182 salen de recibo.routes.ts a su router, montado dentro con su guarda para conservar la dirección. Las prendas y los cíngulos salen del inventario a /api/ropero (módulo Procesión): apagar el Inventario no se lleva el ropero."
```

---

### Tarea 5: El área de hermanos apagada

**Ficheros:**
- Modificar: `backend-desamparados/src/services/auth.service.ts` (`loginUser`), `backend-desamparados/src/middleware/session.ts` (`leerSesion`)
- Crear: `backend-desamparados/test/modulos-area-hermanos-db.test.ts`

**Interfaces que produce:**
- `POST /api/auth/login` con `contexto: 'hermanos'` y el módulo apagado → 404 `{ message: 'El área de hermanos no está activada en esta instalación.' }`.
- Una cookie de hermano con el módulo apagado no cuenta como sesión (`/api/auth/me` devuelve `hermano: null`; una ruta que exige sesión responde 401). La sesión del CMS no se ve afectada.

- [ ] **Paso 1: pruebas que fallan**

Crear `backend-desamparados/test/modulos-area-hermanos-db.test.ts`:

```ts
// Con el módulo «Área de hermanos» apagado nadie entra por /acceso (tampoco
// la junta: el CMS tiene su propio acceso) y una sesión de hermano que ya
// existiera deja de valer. La del CMS sigue igual.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS, COOKIE_HERMANO } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba, PASSWORD_PRUEBA } from './fixtures/usuarios.js';
import { ModulosService } from '../src/services/modulos.service.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
const META = { ip: '127.0.0.1', userAgent: 'prueba-area' };
let dbDisponible = false;
let server: Server;
let baseUrl: string;
const usuarios: number[] = [];

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  if (dbDisponible) {
    await ModulosService.cambiar('area-hermanos', true, {}, undefined, META);
    await ModulosService.cambiar('cuotas-en-linea', true, { conRequisitos: true }, undefined, META);
    await db.auditLog.deleteMany({ where: { userAgent: 'prueba-area' } });
    for (const id of usuarios) await borrarUsuarioPrueba(id);
  }
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  await db.$disconnect();
});

const entrar = (email: string) => fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: PASSWORD_PRUEBA, contexto: 'hermanos' }),
});
const yo = (cookie: string) => fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } }).then((r) => r.json() as Promise<{ cms: unknown; hermano: unknown }>);

test('apagado, /acceso no da sesión a nadie y las que había dejan de valer; el CMS sigue', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const hermano = await crearUsuarioPrueba(Role.USER);
  const admin = await crearUsuarioPrueba(Role.ADMIN);
  usuarios.push(hermano.id, admin.id);
  const cookieHermano = `${COOKIE_HERMANO}=${generateToken(hermano.id, Role.USER, false, 'hermanos')}`;
  const cookieCms = `${COOKIE_CMS}=${generateToken(admin.id, Role.ADMIN, false, 'cms')}`;

  assert.equal((await entrar(hermano.email)).status, 200, 'encendido, entra');
  assert.ok((await yo(cookieHermano)).hermano, 'encendido, la sesión vale');

  // cuotas-en-linea requiere el área: hay que apagarlo antes.
  await ModulosService.cambiar('cuotas-en-linea', false, {}, undefined, META);
  const r = await ModulosService.cambiar('area-hermanos', false, {}, undefined, META);
  assert.equal(r.ok, true);

  const rechazo = await entrar(hermano.email);
  assert.equal(rechazo.status, 404);
  assert.match((await rechazo.json() as { message: string }).message, /El área de hermanos no está activada en esta instalación/);
  assert.equal((await entrar(admin.email)).status, 404, 'tampoco la junta: el CMS tiene su acceso');
  assert.equal((await yo(cookieHermano)).hermano, null, 'la sesión de antes ya no vale');
  assert.equal((await fetch(`${baseUrl}/api/hermanos/mis-perfiles`, { headers: { Cookie: cookieHermano } })).status, 401);
  assert.ok((await yo(cookieCms)).cms, 'la del CMS sigue');
  assert.equal((await fetch(`${baseUrl}/api/cms/modulos`, { headers: { Cookie: cookieCms } })).status, 200);
});
```

- [ ] **Paso 2: ejecutar para verla fallar**

```bash
cd backend-desamparados && npx tsx --test test/modulos-area-hermanos-db.test.ts
```
Esperado: falla en el 404 (hoy entra).

- [ ] **Paso 3: el rechazo en el login y la sesión que no vale**

En `src/services/auth.service.ts`, importar `ModulosService` y, al principio de `loginUser`, antes de buscar al usuario (así no se da ninguna pista de si existe):

```ts
    // Con el área de hermanos apagada no se reparten sesiones de hermano a
    // nadie, tampoco a la junta: el CMS tiene su propio acceso (/cms/acceso).
    if (contexto === 'hermanos' && !(await ModulosService.activo('area-hermanos'))) {
      throw new HttpError('El área de hermanos no está activada en esta instalación.', 404);
    }
```
(`HttpError` ya está importado en ese fichero; si `contexto` se lee más abajo, mover esta comprobación justo detrás de donde se calcula.)

En `src/middleware/session.ts`, importar `ModulosService` y al principio de `leerSesion`:

```ts
  // Con el área de hermanos apagada, una sesión de hermano que ya existiera
  // no vale: la pantalla desaparece y la API responde como si no hubiera sesión.
  if (area === 'hermanos' && !(await ModulosService.activo('area-hermanos'))) return null;
```

- [ ] **Paso 4: ejecutar las pruebas**

```bash
cd backend-desamparados && npm run comprobar-tipos && npx tsx --test test/modulos-area-hermanos-db.test.ts test/auth-seguridad.test.ts test/cookies-sesion.test.ts
```
Esperado: en verde.

- [ ] **Paso 5: commit**

```bash
git add backend-desamparados/src/services/auth.service.ts backend-desamparados/src/middleware/session.ts backend-desamparados/test/modulos-area-hermanos-db.test.ts
git commit -m "Módulos: con el área de hermanos apagada nadie entra por /acceso"
```

---

### Tarea 6: Los enganches opcionales y las áreas de Datos e informes

**Ficheros:**
- Modificar: `backend-desamparados/src/services/procesion/plazo.service.ts`, `src/services/difuntos.service.ts`, `src/services/comunicados.service.ts`, `src/services/modelo-182.service.ts`, `src/domain/datos-areas.ts`, `src/services/datos.service.ts`, `src/controllers/datos.controller.ts`, `src/services/informes/informes.ts`
- Crear: `backend-desamparados/test/modulos-enganches-db.test.ts`

**Interfaces que produce:**

```ts
// domain/datos-areas.ts
export const MODULO_DE_AREA: Record<ClaveArea, Modulo>;   // hermanos, dinero, web → 'nucleo'; procesion, inventario, agenda → su módulo
export function areasActivas(areas: Area[], activos: ReadonlySet<string>): Area[];
```
- `GET /api/datos` devuelve solo las áreas de módulos encendidos; `GET /api/datos/informe/:area` de un área apagada → 404.
- El PDF del Informe anual omite los capítulos de módulos apagados y renumera; sin Procesión, la página «de un vistazo» no lleva la gráfica de papeletas.
- `PlazoPapeletasService.cambiar(true, { borradorNoticia: true }, …)` con `noticias` apagado devuelve `noticiaId: null` y no crea noticia. `DifuntosService.crearSufragio` con `enAgenda` y `agenda` apagada no crea acto (`eventoId: null`). Un comunicado segmentado «con papeleta de…» con `procesion` apagado ignora ese filtro. El Modelo 182 no mira donativos ni apadrinamientos con su módulo apagado.

- [ ] **Paso 1: pruebas que fallan**

Crear `backend-desamparados/test/modulos-enganches-db.test.ts`:

```ts
// Los enganches opcionales entre módulos: lo que un módulo hace en otro solo
// si el otro está encendido. Y Datos e informes: las áreas de módulos
// apagados no salen, ni su informe, ni su capítulo del Informe anual.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Role } from '@prisma/client';
import app from '../src/app.js';
import db from '../src/config/db.js';
import { generateToken } from '../src/utils/jwt.handle.js';
import { COOKIE_CMS } from '../src/utils/cookies.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { ModulosService } from '../src/services/modulos.service.js';
import { PlazoPapeletasService } from '../src/services/procesion/plazo.service.js';
import { SalidasService } from '../src/services/procesion/salidas.service.js';
import { areasActivas, MODULO_DE_AREA, type Area } from '../src/domain/datos-areas.js';

const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';
const META = { ip: '127.0.0.1', userAgent: 'prueba-enganches' };
let dbDisponible = false;
let server: Server;
let baseUrl: string;
const usuarios: number[] = [];

before(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  dbDisponible = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), timeout]);
});

after(async () => {
  if (dbDisponible) {
    await db.modulo.updateMany({ data: { activo: true } });
    await ModulosService.cargar();
    await db.auditLog.deleteMany({ where: { userAgent: 'prueba-enganches' } });
    for (const id of usuarios) await borrarUsuarioPrueba(id);
  }
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  await db.$disconnect();
});

async function apagar(claves: string[]) {
  await db.modulo.updateMany({ where: { clave: { in: claves } }, data: { activo: false } });
  await ModulosService.cargar();
}
async function encenderTodo() {
  await db.modulo.updateMany({ data: { activo: true } });
  await ModulosService.cargar();
}
async function cargo(role: Role) {
  const u = await crearUsuarioPrueba(role);
  usuarios.push(u.id);
  return `${COOKIE_CMS}=${generateToken(u.id, role, false, 'cms')}`;
}

test('Procesión abre el plazo sin crear la noticia si Noticias está apagado', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const salida = await SalidasService.porSlug('sabado-de-pasion');
  const abiertoAntes = salida.plazoAbierto;
  const noticiasAntes = await db.noticia.count();
  try {
    if (abiertoAntes) await PlazoPapeletasService.cambiar(false, {}, salida, META);
    await apagar(['noticias']);
    const r = await PlazoPapeletasService.cambiar(true, { borradorNoticia: true }, await SalidasService.porSlug('sabado-de-pasion'), META);
    assert.equal(r.noticiaId, null);
    assert.equal(r.abierto, true, 'el plazo se abre igual');
    assert.equal(await db.noticia.count(), noticiasAntes, 'ninguna noticia nueva');
  } finally {
    await encenderTodo();
    await PlazoPapeletasService.cambiar(abiertoAntes, {}, await SalidasService.porSlug('sabado-de-pasion'), META);
  }
});

test('un sufragio «en la Agenda» con la Agenda apagada no crea acto', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const secretaria = await cargo(Role.SECRETARIA);
  const cuenta = await crearUsuarioPrueba(Role.USER);
  usuarios.push(cuenta.id);
  const marca = `Enganche${Date.now().toString(36)}`;
  const hermano = await db.hermano.create({
    data: { userId: cuenta.id, nombre: 'Ana', apellidos: `${marca} Gil`, fechaNacimiento: new Date(Date.UTC(1950, 1, 1)), activo: true, esTitular: true, fechaAlta: new Date(Date.UTC(1990, 0, 10)) },
  });
  const pedir = (ruta: string, init: { method?: string; json?: unknown } = {}) => fetch(`${baseUrl}/api/hermanos${ruta}`, {
    method: init.method ?? 'GET',
    headers: { Cookie: secretaria, ...(init.json !== undefined && { 'Content-Type': 'application/json' }) },
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  try {
    assert.equal((await pedir(`/admin/${hermano.id}/baja`, { method: 'DELETE', json: { motivo: 'FALLECIMIENTO', fechaDefuncion: '2026-09-20' } })).status, 200);
    const eventosAntes = await db.evento.count();
    await apagar(['agenda', 'procesion', 'puerta']); // procesion requiere agenda: se apagan juntos
    const r = await pedir(`/admin/difuntos/${hermano.id}/sufragios`, { method: 'POST', json: { tipo: 'MISA_SUFRAGIO', fecha: '2026-12-01T19:00', enAgenda: true } });
    assert.equal(r.status, 200);
    assert.equal((await r.json() as { eventoId: number | null }).eventoId, null);
    assert.equal(await db.evento.count(), eventosAntes);
  } finally {
    await encenderTodo();
    await db.sufragio.deleteMany({ where: { hermanoId: hermano.id } });
    await db.hermano.deleteMany({ where: { id: hermano.id } });
  }
});

test('Datos e informes: fuera las áreas de módulos apagados, y su informe es un 404', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  assert.deepEqual(MODULO_DE_AREA, { hermanos: 'nucleo', dinero: 'nucleo', procesion: 'procesion', inventario: 'inventario', web: 'nucleo', agenda: 'agenda' });
  const areas = [{ clave: 'hermanos' }, { clave: 'procesion' }, { clave: 'agenda' }] as Area[];
  assert.deepEqual(areasActivas(areas, new Set(['agenda'])).map((a) => a.clave), ['hermanos', 'agenda']);

  const hermanoMayor = await cargo(Role.HERMANO_MAYOR);
  try {
    await apagar(['inventario']);
    const r = await fetch(`${baseUrl}/api/datos`, { headers: { Cookie: hermanoMayor } });
    assert.equal(r.status, 200);
    const claves = (await r.json() as { areas: { clave: string }[] }).areas.map((a) => a.clave);
    assert.ok(!claves.includes('inventario'), claves.join(','));
    assert.ok(claves.includes('procesion'));
    assert.equal((await fetch(`${baseUrl}/api/datos/informe/inventario`, { headers: { Cookie: hermanoMayor } })).status, 404);
    assert.equal((await fetch(`${baseUrl}/api/datos/informe/hermanos`, { headers: { Cookie: hermanoMayor } })).status, 200);
  } finally {
    await encenderTodo();
  }
});

test('el Informe anual en borrador sale sin el capítulo de Procesión cuando está apagada', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const hermanoMayor = await cargo(Role.HERMANO_MAYOR);
  const pdf = (cookie: string) => fetch(`${baseUrl}/api/datos/informe-anual/2001/pdf?borrador=1`, { headers: { Cookie: cookie } });
  try {
    const completo = await pdf(hermanoMayor);
    assert.equal(completo.status, 200);
    const paginasCompleto = (await completo.arrayBuffer()).byteLength;
    await apagar(['procesion', 'puerta']);
    const recortado = await pdf(hermanoMayor);
    assert.equal(recortado.status, 200);
    assert.ok((await recortado.arrayBuffer()).byteLength < paginasCompleto, 'con un capítulo menos pesa menos');
  } finally {
    await encenderTodo();
  }
});
```

- [ ] **Paso 2: ejecutar para verlas fallar**

```bash
cd backend-desamparados && npx tsx --test test/modulos-enganches-db.test.ts
```
Esperado: falla al importar `areasActivas` y, en el primer caso, porque la noticia se crea.

- [ ] **Paso 3: los cuatro enganches**

`services/procesion/plazo.service.ts` (importar `siModulo` de `../modulos.service.js`): el bloque de las líneas 111-121 pasa a:

```ts
    if (abrir && opciones.borradorNoticia) {
      // Con Noticias apagado no hay borrador que crear: el plazo se abre igual.
      noticiaId = (await siModulo('noticias', async () => {
        const articuloNoticia = articuloDe(salida);
        const noticia = await NoticiaService.crear({
          titulo: `Abierta la inscripción ${deArticulo(articuloNoticia, salida.nombre)} ${year}`,
          extracto: `Ya se puede pedir la papeleta ${deArticulo(articuloNoticia, salida.nombre)} desde el área de hermanos y elegir el día de reparto.`,
          contenido: contenidoNoticia(dias, year, salida),
          visible: false,
        });
        await AuditoriaService.log(ACCIONES_AUDITORIA.NOTICIA_CREAR, meta ?? {}, 'noticia', noticia.id);
        return noticia.id;
      })) ?? null;
    }
```

`services/difuntos.service.ts` (importar `siModulo`), en `crearSufragio`:

```ts
    // Con la Agenda apagada el sufragio se registra igual, pero sin acto en la web.
    const evento = dto.enAgenda
      ? (await siModulo('agenda', () => db.evento.create({ data: { title: `${NOMBRE_SUFRAGIO[dto.tipo]} por ${nombre}`, startDate: fecha, location: lugar, type: TipoEvento.CULTO } }))) ?? null
      : null;
```

`services/comunicados.service.ts` (importar `ModulosService`), en `fichasDelSegmento`, antes de construir `where`:

```ts
  // «Con papeleta de…» es de Procesión: apagada, el filtro no existe y se manda a todos los del segmento.
  const conPapeleta = s.conPapeleta && (await ModulosService.activo('procesion')) ? s.conPapeleta : null;
```
y en el `where`, usar `conPapeleta` en vez de `s.conPapeleta` (las dos veces).

`services/modelo-182.service.ts` (importar `siModulo`): las dos consultas pasan a

```ts
  // --- Donativos en línea desde la web: solo con su módulo (apagado, no hay nada que certificar).
  const donativos = (await siModulo('donativos', () => db.pagoEnLinea.findMany({ /* igual que antes */ }))) ?? [];
  // …
  // --- Apadrinamientos: igual.
  const apadrinados = (await siModulo('apadrinamientos', () => db.apadrinamiento.findMany({ /* igual que antes */ }))) ?? [];
```

- [ ] **Paso 4: las áreas y los capítulos**

`domain/datos-areas.ts`, junto a `ClaveArea` (importar `type Modulo` de `./modulos.js`):

```ts
/**
 * De qué módulo es cada área: apagado el módulo, el área no sale en Datos e
 * informes ni en el Informe anual. Hermanos, dinero y web son del núcleo.
 */
export const MODULO_DE_AREA: Record<ClaveArea, Modulo> = {
  hermanos: 'nucleo', dinero: 'nucleo', procesion: 'procesion', inventario: 'inventario', web: 'nucleo', agenda: 'agenda',
};

export function areasActivas(areas: Area[], activos: ReadonlySet<string>): Area[] {
  return areas.filter((a) => MODULO_DE_AREA[a.clave] === 'nucleo' || activos.has(MODULO_DE_AREA[a.clave]));
}
```

`services/datos.service.ts`, en `leer`:

```ts
    return { generadoEn: hoy.toISOString(), periodo, periodos: periodosDisponibles(hoy), areas: areasActivas(areasDe(crudos, p, hoy), await ModulosService.activos()) };
```

`controllers/datos.controller.ts`:
- `informe`: después de encontrar `area`, `if (!areasActivas([area], await ModulosService.activos()).length) throw new NotFoundError('Esa área es de un módulo que no está activado.');` (importar `NotFoundError` y `ModulosService`).
- `informeAnualPdf`: `informeAnual(periodo, areasActivas(areasDe(crudos, periodo, hoy), await ModulosService.activos()), crudos, informe.textos, { borrador, hoy })`.

`services/informes/informes.ts`, en `informeAnual`: los capítulos se declaran con su área y se filtran por las áreas recibidas (que ya vienen sin las apagadas); los numerales se asignan después, para que no queden huecos. Sustituir desde `const capitulos: Capitulo[] = [` hasta `CUERPOS.web(ctx('web'));` por:

```ts
  type Pieza = Capitulo & { area?: ClaveArea; escribir: () => void };
  // Las áreas llegan ya sin las de módulos apagados (areasActivas): un capítulo
  // cuya área no está, no se escribe ni se numera. El vistazo y los textos a
  // mano no tienen área: salen siempre.
  const todas: Omit<Pieza, 'numero'>[] = [
    { titulo: 'Presentación del Hermano Mayor', descripcion: 'Carta a los hermanos.', escribir: () => {
      if (textos.presentacion?.trim()) parrafos(p, textos.presentacion);
      else hueco(p, '[Falta la carta del Hermano Mayor: se escribe en «Datos e informes › Informe anual».]');
      p.y += 14;
      lugarYFecha(p, textos.lugarFecha);
      const yFirma = p.sitio(ALTO_FIRMA);
      firma(doc, MX + ANCHO_UTIL - 172, yFirma, 'El Hermano Mayor', textos.firmaPresentacion);
    } },
    { titulo: 'El año de un vistazo', descripcion: 'Las cifras clave, frente al año anterior.', escribir: () => paginaVistazo(p, periodo, porClave, crudos, hoy) },
    { titulo: 'Cultos y actos', descripcion: 'Cultos, formación, convivencias y cabildos, mes a mes.', area: 'agenda', escribir: () => CUERPOS.agenda(ctx('agenda')) },
    { titulo: 'Hermanos', descripcion: 'Censo al cierre, altas y bajas con sus motivos, edades.', area: 'hermanos', escribir: () => CUERPOS.hermanos(ctx('hermanos')) },
    { titulo: 'Sábado de Pasión y Rosario vespertino', descripcion: `Las dos salidas de ${periodo.anio}: papeletas de sitio y el cortejo por puestos.`, area: 'procesion', escribir: () => CUERPOS.procesion(ctx('procesion')) },
    { titulo: 'Cuentas', descripcion: 'Ingresos y gastos por partida, y lo que queda por cobrar.', area: 'dinero', escribir: () => CUERPOS.dinero(ctx('dinero')) },
    { titulo: 'Patrimonio', descripcion: 'Enseres, túnicas y capirotes; estrenos, restauraciones y donaciones.', area: 'inventario', escribir: () => CUERPOS.inventario(ctx('inventario')) },
    { titulo: 'Comunicación', descripcion: 'Noticias, publicaciones y páginas de la web.', area: 'web', escribir: () => CUERPOS.web(ctx('web')) },
  ];
  const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const piezas: Pieza[] = todas
    .filter((c) => !c.area || c.area in porClave)
    .map((c, i) => ({ ...c, numero: ROMANOS[i] }));
  const cEpilogo: Capitulo = { numero: '', titulo: 'Epílogo', descripcion: 'Del Secretario, con el visto bueno del Hermano Mayor.' };
  const capitulos: Capitulo[] = [...piezas, cEpilogo];

  const abrir = (c: Capitulo) => {
    p.nueva();
    c.pagina = doc.bufferedPageRange().count;
    p.seccion = c.numero ? `${c.numero} · ${c.titulo}` : c.titulo;
    bandaCapitulo(doc, { cabecera: titulo, antetitulo: c.numero ? `Capítulo ${c.numero}` : titulo, titulo: c.titulo, numeral: c.numero || undefined });
  };
  const ctx = (clave: ClaveArea): Contexto => ({ p, area: porClave[clave]!, crudos, periodo, hoy, notaPatrimonio: textos.notaPatrimonio });

  portada(doc, periodo, textos);
  p.nueva(); // el índice: las filas se escriben al final, cuando se saben las páginas
  bandaCapitulo(doc, { cabecera: titulo, antetitulo: titulo, titulo: 'Índice' });

  for (const pieza of piezas) {
    abrir(pieza);
    pieza.escribir();
  }
```
(`abrir` y `ctx` van declarados antes del bucle, como arriba; `porClave` pasa a `Partial<Record<ClaveArea, Area>>` porque ahora pueden faltar claves, de ahí el `!` de `ctx`, que solo se llama para áreas presentes). El epílogo sigue como estaba (`abrir(cEpilogo)` y lo que viene detrás). En `paginaVistazo`, el parámetro `areas` pasa a `Partial<Record<ClaveArea, Area>>` y la fila de gráficas:

```ts
  const hermanos = areas.hermanos!.cifras[0].grafica;
  // Sin Procesión (módulo apagado) no hay gráfica de papeletas: solo la de hermanos.
  const papeletas = areas.procesion?.cifras[1].grafica;
  fila(p, [
    [{ ...hermanos, titulo: 'Hermanos, cinco años', pie: undefined }],
    ...(papeletas ? [[{ ...papeletas, titulo: 'Papeletas, cinco salidas', pie: undefined }]] : []),
  ], { altoColumnas: 124 });
```

- [ ] **Paso 5: ejecutar las pruebas**

```bash
cd backend-desamparados && npm run comprobar-tipos && npx tsx --test test/modulos-enganches-db.test.ts test/datos-informes.test.ts test/difuntos-db.test.ts test/comunicados-db.test.ts test/modelo-182-db.test.ts test/cortejo.test.ts
```
Esperado: en verde; `datos-informes.test.ts` sin cambios (con todo encendido el PDF es idéntico: mismos capítulos y numerales).

- [ ] **Paso 6: commit**

```bash
git add backend-desamparados/src/services/procesion/plazo.service.ts backend-desamparados/src/services/difuntos.service.ts backend-desamparados/src/services/comunicados.service.ts backend-desamparados/src/services/modelo-182.service.ts backend-desamparados/src/domain/datos-areas.ts backend-desamparados/src/services/datos.service.ts backend-desamparados/src/controllers/datos.controller.ts backend-desamparados/src/services/informes/informes.ts backend-desamparados/test/modulos-enganches-db.test.ts
git commit -m "Módulos: los enganches entre módulos preguntan, y Datos e informes omite lo apagado"
```

---
## Fase B: cimientos de la web

### Tarea 7: `useModulos`, la guarda de ruta y todas las rutas con su módulo

**Ficheros:**
- Crear: `desamparados-web/src/domain/modulos.ts`, `desamparados-web/src/domain/__tests__/modulos.test.ts`, `desamparados-web/src/lib/api/modulos.ts`, `desamparados-web/src/hooks/useModulos.ts`, `desamparados-web/src/routes/ExigeModulo.tsx`, `desamparados-web/src/routes/__tests__/ExigeModulo.test.tsx`, `desamparados-web/src/features/cms/ModuloNoActivadoPage.tsx`
- Modificar: `desamparados-web/src/test/AllTheProviders.tsx`, `desamparados-web/src/test/test-utils.tsx`, `desamparados-web/src/routes/index.tsx`

**Interfaces que produce:**

```ts
// domain/modulos.ts
export const CLAVES_MODULO: readonly [...];                 // las 24, mismo orden que el catálogo
export type ClaveModulo; export type Modulo = ClaveModulo | 'nucleo';
export type Requisito = Modulo | Modulo[];                   // una lista = con cualquiera de ellos
export interface FichaDeModulo { clave: ClaveModulo; nombre: string; grupo: string; descripcion: string; requiere: ClaveModulo[] }
export const CATALOGO_MODULOS: FichaDeModulo[];
export const fichaDeModulo: (clave: ClaveModulo) => FichaDeModulo;
export const esClaveDeModulo: (v: unknown) => v is ClaveModulo;
export function cumple(requisito: Requisito, activos: ReadonlySet<string>): boolean;
// lib/api/modulos.ts
export const CLAVE_MODULOS = ['modulos'] as const;
export const modulosActivos: () => Promise<ClaveModulo[]>;
export interface ModuloDelCms extends FichaDeModulo { activo: boolean; cambiadoEl: string | null; cambiadoPor: string | null; datos: { que: string; total: number }[] }
export const modulosDelCms: () => Promise<ModuloDelCms[]>;
export const cambiarModulo: (clave: ClaveModulo, activo: boolean, conRequisitos?: boolean) => Promise<{ ok: true; cambiados: ClaveModulo[]; activos: ClaveModulo[] }>;
// hooks/useModulos.ts
export function useModulos(): { activos: ReadonlySet<string> | null; cargando: boolean; error: boolean; activo: (requisito: Requisito) => boolean };
// routes/ExigeModulo.tsx: <ExigeModulo modulo={Requisito}>…</ExigeModulo>
// routes/index.tsx: pagina(Componente, Requisito) en TODAS las rutas que pintan una página
// test-utils: renderWithProviders(ui, { ruta?, modulos?: readonly string[] })  — sin `modulos`, todos encendidos
```

- [ ] **Paso 1: pruebas que fallan (dominio y guarda)**

Crear `desamparados-web/src/domain/__tests__/modulos.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import CATALOGO from '../../../../shared/modulos.json'
import { CLAVES_MODULO, cumple, fichaDeModulo } from '../modulos'

describe('el catálogo de módulos en la web', () => {
  it('las claves escritas aquí son las de shared/modulos.json, en el mismo orden', () => {
    expect([...CLAVES_MODULO]).toEqual(CATALOGO.modulos.map((m) => m.clave))
  })

  it('cumple: nucleo siempre; una clave, si está; una lista, con cualquiera', () => {
    const activos = new Set(['noticias', 'tienda'])
    expect(cumple('nucleo', activos)).toBe(true)
    expect(cumple('noticias', activos)).toBe(true)
    expect(cumple('agenda', activos)).toBe(false)
    expect(cumple(['inventario', 'tienda'], activos)).toBe(true)
    expect(cumple(['inventario', 'procesion'], activos)).toBe(false)
    expect(cumple('agenda', new Set())).toBe(false)
  })

  it('la ficha trae nombre y requisitos', () => {
    expect(fichaDeModulo('tienda-web').requiere).toEqual(['tienda', 'pago-en-linea'])
    expect(fichaDeModulo('puerta').nombre).toBe('Puerta del templo')
  })
})
```

Crear `desamparados-web/src/routes/__tests__/ExigeModulo.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/test-utils'
import ExigeModulo from '../ExigeModulo'
import { useAuthStore } from '../../features/altas/auth/store'

const Dentro = () => <p>La tienda</p>

function montar(ruta: string, modulos?: string[]) {
  return renderWithProviders(
    <Routes>
      <Route path={ruta} element={<ExigeModulo modulo="tienda-web"><Dentro /></ExigeModulo>} />
    </Routes>,
    { ruta, modulos },
  )
}

describe('ExigeModulo', () => {
  it('con el módulo encendido pinta la página', () => {
    montar('/tienda')
    expect(screen.getByText('La tienda')).toBeInTheDocument()
  })

  it('en la web pública, apagado es la página de «no encontrado»', async () => {
    montar('/tienda', ['noticias'])
    expect(await screen.findByRole('heading', { name: /no encontrada/i })).toBeInTheDocument()
    expect(screen.queryByText('La tienda')).not.toBeInTheDocument()
  })

  it('en el CMS, apagado dice que el módulo no está activado y a Administración le enlaza Sistema → Módulos', async () => {
    useAuthStore.setState({ status: 'listo', cms: { id: 1, email: 'a@b.es', role: 'ADMIN', perfiles: [], origen: 'cms' }, hermano: null })
    montar('/cms/tienda', ['noticias'])
    expect(await screen.findByRole('heading', { name: /no está activado/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /módulos/i })).toHaveAttribute('href', '/cms/modulos')
  })

  it('en el CMS, a quien no es Administración no le enlaza nada', async () => {
    useAuthStore.setState({ status: 'listo', cms: { id: 1, email: 'a@b.es', role: 'REDES', perfiles: [], origen: 'cms' }, hermano: null })
    montar('/cms/tienda', ['noticias'])
    expect(await screen.findByRole('heading', { name: /no está activado/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /módulos/i })).not.toBeInTheDocument()
  })

  it('nucleo pasa sin esperar a la lista', () => {
    renderWithProviders(<ExigeModulo modulo="nucleo"><Dentro /></ExigeModulo>, { modulos: [] })
    expect(screen.getByText('La tienda')).toBeInTheDocument()
  })
})
```

- [ ] **Paso 2: ejecutar para verlas fallar**

```bash
cd desamparados-web && npx vitest run --testTimeout=20000 src/domain/__tests__/modulos.test.ts src/routes/__tests__/ExigeModulo.test.tsx
```
Esperado: fallan por módulos que no existen.

- [ ] **Paso 3: dominio, API y hook**

Crear `desamparados-web/src/domain/modulos.ts`:

```ts
import CATALOGO from '../../../shared/modulos.json'

/**
 * Los módulos que una instalación puede apagar: la copia tipada de la web.
 * Van escritos aquí, y no solo en `shared/modulos.json`, para que
 * `pagina(TiendaPage, 'tiend')` no compile (el import de un JSON pierde los
 * literales). `__tests__/modulos.test.ts` comprueba que las dos listas son
 * la misma, en el mismo orden; el backend tiene su copia en
 * `src/domain/modulos.ts`.
 */
export const CLAVES_MODULO = [
  'noticias', 'publicaciones', 'agenda', 'comunicados', 'alta-web', 'area-hermanos',
  'procesion', 'puerta', 'cortejo-directo', 'inventario', 'cartas', 'difuntos', 'apadrinamientos',
  'remesas', 'pago-en-linea', 'cuotas-en-linea', 'donativos', 'tienda', 'tienda-web', 'loteria', 'modelo-182', 'contabilidad',
  'cabildos', 'informe-anual',
] as const
export type ClaveModulo = (typeof CLAVES_MODULO)[number]

/** La marca de lo que no se apaga: cada pieza del núcleo lo dice, y la guardiana lo exige. */
export type Modulo = ClaveModulo | 'nucleo'
/** Lo que necesita una pieza: un módulo, o una lista que vale con cualquiera de ellos (el Inventario, con enseres o con ropero). */
export type Requisito = Modulo | Modulo[]

export interface FichaDeModulo {
  clave: ClaveModulo
  nombre: string
  /** El grupo del menú del CMS: la pantalla de Módulos agrupa igual. */
  grupo: string
  descripcion: string
  requiere: ClaveModulo[]
}

export const CATALOGO_MODULOS = CATALOGO.modulos as FichaDeModulo[]

export const esClaveDeModulo = (valor: unknown): valor is ClaveModulo =>
  typeof valor === 'string' && (CLAVES_MODULO as readonly string[]).includes(valor)

export const fichaDeModulo = (clave: ClaveModulo): FichaDeModulo => CATALOGO_MODULOS.find((m) => m.clave === clave)!

/** Si una pieza con este requisito se enseña con estos módulos encendidos. */
export function cumple(requisito: Requisito, activos: ReadonlySet<string>): boolean {
  const lista = Array.isArray(requisito) ? requisito : [requisito]
  return lista.some((m) => m === 'nucleo' || activos.has(m))
}
```

Crear `desamparados-web/src/lib/api/modulos.ts`:

```ts
import { llamarApi } from './cliente'
import type { ClaveModulo, FichaDeModulo } from '../../domain/modulos'

export const CLAVE_MODULOS = ['modulos'] as const

/** Qué módulos están encendidos. Sin sesión: la web lo necesita antes de pintar la barra. */
export const modulosActivos = () => llamarApi<{ activos: ClaveModulo[] }>('/modulos', { auth: false }).then((r) => r.activos)

export interface ModuloDelCms extends FichaDeModulo {
  activo: boolean
  cambiadoEl: string | null
  cambiadoPor: string | null
  /** Cuántos datos tiene («12 productos»): se enseña antes de apagar. */
  datos: { que: string; total: number }[]
}
export const modulosDelCms = () => llamarApi<ModuloDelCms[]>('/cms/modulos')

export interface ResultadoDeCambio { ok: true; cambiados: ClaveModulo[]; activos: ClaveModulo[] }
/**
 * Encender o apagar. Un 400 llega como ErrorDeApi con `payload.faltan` (lo
 * que habría que encender antes) o `payload.dependientes` (lo que impide apagar).
 */
export const cambiarModulo = (clave: ClaveModulo, activo: boolean, conRequisitos = false) =>
  llamarApi<ResultadoDeCambio>(`/cms/modulos/${clave}`, { method: 'PUT', json: { activo, conRequisitos } })

/** Las listas de un 400 de cambiarModulo, si las trae. */
export function listasDelRechazo(payload: unknown): { faltan: ClaveModulo[]; dependientes: ClaveModulo[] } {
  const p = (payload ?? {}) as { faltan?: unknown; dependientes?: unknown }
  const lista = (v: unknown) => (Array.isArray(v) ? (v as ClaveModulo[]) : [])
  return { faltan: lista(p.faltan), dependientes: lista(p.dependientes) }
}
```

Crear `desamparados-web/src/hooks/useModulos.ts`:

```ts
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CLAVE_MODULOS, modulosActivos } from '../lib/api/modulos'
import { cumple, type Requisito } from '../domain/modulos'

/**
 * Los módulos encendidos, pedidos una sola vez por sesión del navegador y
 * compartidos por toda la web (menús, rutas, bloques, pantallas). Mientras no
 * se saben, `activos` es `null` y nada de módulo se pinta: un menú que
 * apareciera y desapareciera sería peor que un instante en blanco. Las
 * pruebas lo siembran en el QueryClient (`renderWithProviders`), así que no
 * piden nada.
 */
export function useModulos() {
  const { data, isPending, isError } = useQuery({ queryKey: CLAVE_MODULOS, queryFn: modulosActivos, staleTime: Infinity, gcTime: Infinity })
  const activos = useMemo<ReadonlySet<string> | null>(() => (data ? new Set<string>(data) : null), [data])
  return {
    activos,
    cargando: isPending,
    error: isError,
    /** Sin la lista todavía, nada de módulo está activo; `nucleo` sí. */
    activo: (requisito: Requisito) => (activos ? cumple(requisito, activos) : requisito === 'nucleo'),
  }
}
```

- [ ] **Paso 4: la siembra en las pruebas**

`desamparados-web/src/test/AllTheProviders.tsx`:

```tsx
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import theme from '../theme'
import { CLAVES_MODULO } from '../domain/modulos'
import { CLAVE_MODULOS } from '../lib/api/modulos'

export default function AllTheProviders({ children, ruta = '/', modulos }: { children: React.ReactNode; ruta?: string; modulos?: readonly string[] }) {
  // Un cliente nuevo por render: si se compartiera, la caché de un test
  // contaminaría al siguiente. Sin reintentos, o los fallos tardan segundos.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  // Los módulos encendidos, ya en caché: ninguna pantalla tiene que pedirlos
  // (los tests simulan `fetch` para lo suyo y no sabrían responder a
  // /modulos). Sin `modulos`, todo encendido, que es como está esta instalación.
  queryClient.setQueryData(CLAVE_MODULOS, [...(modulos ?? CLAVES_MODULO)])

  return (
    <MemoryRouter initialEntries={[ruta]}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}
```

`desamparados-web/src/test/test-utils.tsx`:

```tsx
import type { ReactElement } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import AllTheProviders from './AllTheProviders'

export function renderWithProviders(
  ui: ReactElement,
  { ruta = '/', modulos, ...options }: Omit<RenderOptions, 'wrapper'> & { ruta?: string; modulos?: readonly string[] } = {},
) {
  return render(ui, {
    wrapper: ({ children }) => <AllTheProviders ruta={ruta} modulos={modulos}>{children}</AllTheProviders>,
    ...options,
  })
}
```

- [ ] **Paso 5: la guarda y la página de «no activado»**

Crear `desamparados-web/src/features/cms/ModuloNoActivadoPage.tsx`:

```tsx
import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuthStore } from '../altas/auth/store'
import { fichaDeModulo, type Requisito } from '../../domain/modulos'
import { site } from '../../config/site'

/**
 * Lo que ve quien llega a una pantalla del CMS de un módulo apagado (por un
 * enlace guardado, por la URL). Administración puede encenderlo desde aquí;
 * al resto solo se le dice que no está, sin enlace a una pantalla que no
 * podría abrir.
 */
export default function ModuloNoActivadoPage({ modulo }: { modulo: Requisito }) {
  const role = useAuthStore((state) => state.cms?.role)
  const claves = (Array.isArray(modulo) ? modulo : [modulo]).filter((m) => m !== 'nucleo')
  const nombres = claves.map((c) => fichaDeModulo(c).nombre)
  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', py: 8, textAlign: 'center' }}>
      <Helmet><title>{`Módulo no activado | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <Typography component="h1" variant="h5" sx={{ mb: 1.5 }}>Este módulo no está activado</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {nombres.length === 1 ? `«${nombres[0]}» no está activado en esta instalación.` : `Ninguno de estos módulos está activado en esta instalación: ${nombres.join(', ')}.`}
      </Typography>
      {role === 'ADMIN' && (
        <Typography>
          Se enciende desde <Link to="/cms/modulos">Sistema → Módulos</Link>.
        </Typography>
      )}
    </Box>
  )
}
```

Crear `desamparados-web/src/routes/ExigeModulo.tsx`:

```tsx
import { Suspense, lazy } from 'react'
import { useLocation } from 'react-router-dom'
import CargandoPagina from '../components/CargandoPagina'
import { useModulos } from '../hooks/useModulos'
import { cumple, type Requisito } from '../domain/modulos'

const NoEncontradaPage = lazy(() => import('../features/noEncontrado/NoEncontradaPage'))
const ModuloNoActivadoPage = lazy(() => import('../features/cms/ModuloNoActivadoPage'))

/**
 * La guarda de módulo de una ruta. `nucleo` pasa sin esperar a nada: la
 * portada no puede quedarse en blanco hasta que llegue la lista. Una ruta de
 * módulo espera a la lista; apagado, en la web pública es un «no encontrado»
 * como cualquier dirección que no existe y en el CMS una explicación. Si la
 * lista no llega (la API caída), se deja pasar: la propia pantalla enseñará
 * su error, que es más útil que un 404 falso.
 */
export default function ExigeModulo({ modulo, children }: { modulo: Requisito; children: React.ReactNode }) {
  const { activos, error } = useModulos()
  const { pathname } = useLocation()
  const esNucleo = Array.isArray(modulo) ? modulo.includes('nucleo') : modulo === 'nucleo'
  if (esNucleo) return <>{children}</>
  if (activos === null) return error ? <>{children}</> : <CargandoPagina />
  if (cumple(modulo, activos)) return <>{children}</>
  return (
    <Suspense fallback={<CargandoPagina />}>
      {pathname.startsWith('/cms') ? <ModuloNoActivadoPage modulo={modulo} /> : <NoEncontradaPage />}
    </Suspense>
  )
}
```

- [ ] **Paso 6: todas las rutas con su módulo**

En `routes/index.tsx`, sustituir `withSuspense` por `pagina`, que toma el módulo:

```tsx
import ExigeModulo from './ExigeModulo'
import type { Requisito } from '../domain/modulos'
// …
/**
 * Una página con su módulo: `nucleo` para lo que no se apaga, la clave para
 * lo demás. La guardiana (backend, test/modulos-cobertura.test.ts) exige que
 * toda ruta de este fichero pase por aquí o sea una redirección.
 */
function pagina(Component: React.ComponentType, modulo: Requisito) {
  return (
    <ExigeModulo modulo={modulo}>
      <Suspense fallback={<CargandoPagina />}>
        <Component />
      </Suspense>
    </ExigeModulo>
  )
}
```

y cada ruta queda así (misma estructura; solo cambia `withSuspense(X)` por `pagina(X, modulo)`):

- Web pública: `InicioPage`, `HistoriaPage`, `OrganosDeGobiernoPage`, `ParroquiaPage`, `NuestrosFinesPage`, `CaridadPage`, `FormacionPage`, `CultosPage`, `SabadoPasionPage`, `RecorridoPage`, `TronoPage`, `EnseresPage`, `RosarioPage`, `DesamparadosPage`, `AjuarPage`, `ContactoPage`, `AvisoLegalPage`, `PoliticaDePrivacidadPage`, `PoliticaDeCookiesPage`, `NoEncontradaPage` → `'nucleo'`. `AgendaPage` → `'agenda'`. `NoticiasPage`, `NoticiaDetallePage` → `'noticias'`. `PublicacionesPage`, `BoletinesPage`, `DossierPrensaPage` → `'publicaciones'`. `HazteHermanoPage` → `'alta-web'`. `TiendaPage`, `PedidoTiendaPage` → `'tienda-web'`. `ApadrinaPage`, `GraciasApadrinamientoPage` → `'apadrinamientos'`. Las de `DireccionAntigua` no cambian.
- `/boletin/baja`: `BajaBoletinPage` → `'comunicados'`. `/acceso`: `AccesoPage` → `'nucleo'` (la pantalla enseña el aviso del área apagada, Tarea 10). `/reset-password`: `'nucleo'`.
- `/area-hermano`: el marco entero exige el módulo: `element: (<ExigeModulo modulo="area-hermanos"><ExigeSesion><MarcoAreaHermano /></ExigeSesion></ExigeModulo>)`. Dentro: `PerfilPage`, `FamiliaPage`, `RecibosPage`, `ReciboPage` → `'nucleo'` (el marco ya guarda); `ProcesionPage`, `HistoricoPage` → `'procesion'`.
- `/cms/vista-previa/:slug`: `pagina(PaginaEnVivo, 'nucleo')`. `/cms/acceso`: `pagina(AccesoCmsPage, 'nucleo')`.
- CMS: `PanelPage`, `MiSeguridadPage`, `PaginasAdminPage`, `PaginaAdminPage`, `PortadaAdminPage`, `EmailsPage`, `EmailEditPage`, `HermanosAdminPage`, `HermanoEditPage`, `TesoreriaAdminPage`, `DatosInformesPage`, `AccesosAdminPage`, `AuditoriaAdminPage`, `AjustesInicioPage` → `'nucleo'`. `NoticiasAdminPage`, `NoticiaEditPage` → `'noticias'`. `ComunicadosAdminPage`, `ComunicadoEditPage` → `'comunicados'`. `CabildosAdminPage`, `CabildoPage` → `'cabildos'`. `PublicacionesAdminPage`, `PublicacionEditPage` → `'publicaciones'`. `AgendaAdminPage`, `AgendaEditPage` → `'agenda'`. `ProcesionAdminPage`, `SalidasAdminPage`, `SalidaEditPage`, `MesaProcesionPage` → `'procesion'`. `PuertaTemploPage` → `'puerta'`. `CortejoDirectoPage` → `'cortejo-directo'`. `InventarioAdminPage`, `InventarioEditPage` → `['inventario', 'procesion']` (la misma pantalla sirve los enseres y el ropero). `ContabilidadAdminPage`, `PartidaDoblePage` → `'contabilidad'`. `TiendaAdminPage` → `'tienda'`. `LoteriaAdminPage` → `'loteria'`. `ApadrinamientosAdminPage`, `CampanaApadrinamientoPage` → `'apadrinamientos'`. `CartasPage` → `'cartas'`. `InformeAnualPage` (las dos rutas) → `'informe-anual'`. Las redirecciones (`<Navigate …>`) no cambian.

Borrar `withSuspense`. Comprobar que `scripts/generar-sitemap.mjs` sigue sacando las mismas rutas (`npm run sitemap` no cambia `public/sitemap.xml`).

- [ ] **Paso 7: ejecutar las pruebas**

```bash
cd desamparados-web && npx tsc -b && npm run lint && npx vitest run --testTimeout=20000
```
Esperado: en verde (la siembra de módulos deja todas las pruebas antiguas como estaban). `npm run sitemap` sin cambios en `public/sitemap.xml`.

- [ ] **Paso 8: commit**

```bash
git add desamparados-web/src/domain/modulos.ts desamparados-web/src/domain/__tests__/modulos.test.ts desamparados-web/src/lib/api/modulos.ts desamparados-web/src/hooks/useModulos.ts desamparados-web/src/routes/ExigeModulo.tsx desamparados-web/src/routes/__tests__/ExigeModulo.test.tsx desamparados-web/src/features/cms/ModuloNoActivadoPage.tsx desamparados-web/src/test/AllTheProviders.tsx desamparados-web/src/test/test-utils.tsx desamparados-web/src/routes/index.tsx
git commit -m "Módulos: la web sabe qué módulos hay y cada ruta dice el suyo"
```

---

### Tarea 8: El menú del CMS filtrado, con la entrada «Módulos»

**Ficheros:**
- Modificar: `desamparados-web/src/app/cmsNavegacion.ts`, `desamparados-web/src/app/MarcoCms.tsx`, `desamparados-web/src/app/__tests__/MarcoCms.test.tsx`, `desamparados-web/src/routes/index.tsx` (la ruta `/cms/modulos`, que pinta una página provisional hasta la Tarea 9)

**Interfaces que produce:**

```ts
// cmsNavegacion.ts
export interface ItemMenu { …; modulo: Requisito; ocultoSiActivo?: ClaveModulo }
export function menuCmsVisible(items: ItemMenu[], role: string | undefined, activos: ReadonlySet<string>): ItemMenu[]
// rolesPorRutaCms.modulos = ['ADMIN']
```

- [ ] **Paso 1: pruebas que fallan**

Añadir a `desamparados-web/src/app/__tests__/MarcoCms.test.tsx` (dentro del `describe('MarcoCms')`, importando `menuCmsVisible` junto a `itemsMenu`):

```tsx
  it('con un módulo apagado, su entrada no está; el núcleo sigue', () => {
    entrarComo('ADMIN')
    const { container } = renderWithProviders(<MarcoCms />, { modulos: ['noticias', 'procesion', 'agenda'] })
    expect(enlace(container, '/cms/noticias')).toBeInTheDocument()
    expect(enlace(container, '/cms/tienda')).not.toBeInTheDocument()
    expect(enlace(container, '/cms/loteria')).not.toBeInTheDocument()
    expect(enlace(container, '/cms/hermanos')).toBeInTheDocument()
    expect(enlace(container, '/cms/tesoreria')).toBeInTheDocument()
  })

  it('Administración ve Sistema → Módulos; el Hermano Mayor, no', () => {
    entrarComo('ADMIN')
    const { container, unmount } = renderWithProviders(<MarcoCms />)
    expect(enlace(container, '/cms/modulos')).toBeInTheDocument()
    unmount()
    entrarComo('HERMANO_MAYOR')
    const otro = renderWithProviders(<MarcoCms />)
    expect(enlace(otro.container, '/cms/modulos')).not.toBeInTheDocument()
  })

  it('sin Inventario pero con Procesión, la entrada se llama «Ropero» y lleva a la misma pantalla', () => {
    const conTodo = menuCmsVisible(itemsMenu, 'ADMIN', new Set(['inventario', 'procesion', 'agenda']))
    expect(conTodo.filter((i) => i.href === '/cms/inventario').map((i) => i.label)).toEqual(['Inventario'])
    const soloRopero = menuCmsVisible(itemsMenu, 'ADMIN', new Set(['procesion', 'agenda']))
    expect(soloRopero.filter((i) => i.href === '/cms/inventario').map((i) => i.label)).toEqual(['Ropero'])
    const nada = menuCmsVisible(itemsMenu, 'ADMIN', new Set())
    expect(nada.filter((i) => i.href === '/cms/inventario')).toEqual([])
  })

  it('todas las entradas del menú llevan su módulo', () => {
    for (const item of itemsMenu) expect(item.modulo, item.label).toBeDefined()
  })
```

Si el fichero ya tiene una prueba que cruza `itemsMenu` con `rolesPorRutaCms` por `href`, la entrada «Ropero» comparte `href` con «Inventario»: comprobar que esa prueba tolera dos entradas con el mismo `href` (tienen los mismos roles) y, si no, de-duplicar por `href` dentro de la prueba.

- [ ] **Paso 2: ejecutar para verlas fallar**

```bash
cd desamparados-web && npx vitest run --testTimeout=20000 src/app/__tests__/MarcoCms.test.tsx
```

- [ ] **Paso 3: el menú con módulos**

En `app/cmsNavegacion.ts`:

```ts
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined'
import { cumple, type ClaveModulo, type Requisito } from '../domain/modulos'
// …
export interface ItemMenu {
  label: string
  href: string
  roles: string[]
  grupo: Lugar
  icono: ComponentType<{ fontSize?: 'small' | 'inherit' | 'medium' | 'large' }>
  /** El número dice cuántos hay; el tono, cuánta prisa corre. */
  contador?: { de: ClaveContador; tono: 'aviso' | 'error' }
  /** De qué módulo es la entrada: apagado, no sale. `nucleo` es lo que no se apaga. */
  modulo: Requisito
  /** Se esconde si este módulo está encendido: «Ropero» solo vale cuando no hay «Inventario», que ya lo lleva dentro. */
  ocultoSiActivo?: ClaveModulo
}
```

Y en `itemsMenu`, cada entrada con su `modulo` (añadido al final de cada objeto):

| Entrada | `modulo` |
|---|---|
| Inicio, Páginas, Portada, Emails, Hermanos, Tesorería, Datos e informes, Accesos, Auditoría, Ajustes del Inicio, Mi seguridad | `'nucleo'` |
| Noticias | `'noticias'` |
| Publicaciones | `'publicaciones'` |
| Boletín y avisos | `'comunicados'` |
| Agenda | `'agenda'` |
| Cartas | `'cartas'` |
| Procesión, Salidas, Mesa de procesión | `'procesion'` |
| Puerta del templo | `'puerta'` |
| Cortejo en directo | `'cortejo-directo'` |
| Inventario | `'inventario'` |
| Apadrinamientos | `'apadrinamientos'` |
| Tienda | `'tienda'` |
| Lotería | `'loteria'` |
| Contabilidad | `'contabilidad'` |
| Informe anual | `'informe-anual'` |
| Cabildos | `'cabildos'` |

Dos entradas nuevas:

```ts
  // Sin Inventario (los enseres) pero con Procesión, el ropero sigue existiendo: la
  // misma pantalla, con el nombre de lo único que enseña. Con Inventario encendido
  // no sale, porque Inventario ya lleva el ropero en su segunda pestaña.
  { label: 'Ropero', href: '/cms/inventario', roles: ['ADMIN', 'ALBACERIA', 'HERMANO_MAYOR'], grupo: 'Censo y procesión', icono: Inventory2OutlinedIcon, modulo: 'procesion', ocultoSiActivo: 'inventario' },
```
(justo detrás de «Inventario») y, en Sistema, detrás de «Accesos»:

```ts
  // Encender y apagar módulos abre pantallas a toda la junta: solo Administración.
  { label: 'Módulos', href: '/cms/modulos', roles: ['ADMIN'], grupo: 'Sistema', icono: ExtensionOutlinedIcon, modulo: 'nucleo' },
```

En `rolesPorRutaCms`, detrás de `accesos`:

```ts
  // Los módulos de la instalación: solo Administración, como los accesos.
  modulos: ['ADMIN'],
```

Y la función que filtra, debajo de `itemsMenu`:

```ts
/**
 * Lo que ve un cargo con estos módulos: su rol, el módulo de la entrada y la
 * regla de «Ropero». Fuera de los componentes para probarla sola.
 */
export function menuCmsVisible(items: ItemMenu[], role: string | undefined, activos: ReadonlySet<string>): ItemMenu[] {
  return items.filter((item) =>
    role !== undefined && item.roles.includes(role)
    && cumple(item.modulo, activos)
    && !(item.ocultoSiActivo && activos.has(item.ocultoSiActivo)))
}
```

En `app/MarcoCms.tsx`, en `Navegacion`:

```tsx
  const { activos } = useModulos()
  // Sin la lista de módulos no se pinta ningún menú: aparecería y cambiaría.
  const visibles = activos ? menuCmsVisible(itemsMenu, role, activos).filter((item) => item.grupo !== 'cuenta') : []
```
(importar `useModulos` de `../hooks/useModulos` y `menuCmsVisible` de `./cmsNavegacion`). Si el menú de la cuenta (abajo) filtra aparte por `grupo === 'cuenta'`, aplicarle también `menuCmsVisible`.

En `routes/index.tsx`, la ruta nueva (la pantalla de verdad llega en la Tarea 9; hasta entonces apunta a un componente mínimo creado en `features/cms/ModulosAdminPage.tsx` que pinta `<CabeceraSeccion titulo="Módulos" />`):

```tsx
const ModulosAdminPage = lazy(() => import('../features/cms/ModulosAdminPage'))
// …entre 'accesos' y 'auditoria':
          { path: 'modulos', element: <ExigeRol roles={rolesPorRutaCms.modulos}>{pagina(ModulosAdminPage, 'nucleo')}</ExigeRol> },
```

- [ ] **Paso 4: ejecutar las pruebas**

```bash
cd desamparados-web && npx tsc -b && npx vitest run --testTimeout=20000 src/app
```

- [ ] **Paso 5: commit**

```bash
git add desamparados-web/src/app/cmsNavegacion.ts desamparados-web/src/app/MarcoCms.tsx desamparados-web/src/app/__tests__/MarcoCms.test.tsx desamparados-web/src/routes/index.tsx desamparados-web/src/features/cms/ModulosAdminPage.tsx
git commit -m "CMS: el menú solo enseña los módulos encendidos, y Sistema gana «Módulos»"
```

---

### Tarea 9: La pantalla Sistema → Módulos

**Ficheros:**
- Modificar: `desamparados-web/src/features/cms/ModulosAdminPage.tsx` (la de verdad)
- Crear: `desamparados-web/src/features/cms/__tests__/ModulosAdminPage.test.tsx`

**Comportamiento:** los módulos por grupo (en el orden de `GRUPOS` de `cmsNavegacion`), cada uno con un interruptor (`aria-label` = su nombre), su descripción, «Requiere: …» si tiene requisitos y sus datos («12 productos, 40 pedidos» o «Sin datos propios»). Encender con requisitos apagados → el servidor responde 400 con `faltan` y la pantalla abre un diálogo que propone encenderlos también; aceptar llama con `conRequisitos`. Apagar → diálogo que repite los datos y explica que se conservan y se ocultan; si el servidor responde 400 con `dependientes`, un aviso con cuáles. Tras cada cambio se invalidan `['modulos']` (lo que usan menús y rutas) y `['modulos', 'cms']`.

- [ ] **Paso 1: pruebas que fallan**

Crear `desamparados-web/src/features/cms/__tests__/ModulosAdminPage.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import ModulosAdminPage from '../ModulosAdminPage'
import CATALOGO from '../../../../../shared/modulos.json'

const json = (cuerpo: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } }))

const lista = (apagados: string[] = []) => CATALOGO.modulos.map((m) => ({
  ...m, activo: !apagados.includes(m.clave), cambiadoEl: null, cambiadoPor: null,
  datos: m.clave === 'tienda' ? [{ que: 'productos', total: 12 }, { que: 'ventas de caja', total: 40 }] : [],
}))

/** Un servidor de mentira: la lista, y un PUT que responde lo que diga `alCambiar`. */
function servidor(apagados: string[], alCambiar: (clave: string, body: { activo: boolean; conRequisitos?: boolean }) => Promise<Response>) {
  let estado = apagados
  return vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    const ruta = String(url)
    if (init?.method === 'PUT') {
      const clave = ruta.split('/').pop()!
      const body = JSON.parse(String(init.body)) as { activo: boolean; conRequisitos?: boolean }
      return alCambiar(clave, body).then((r) => {
        if (r.ok) estado = body.activo ? estado.filter((c) => c !== clave) : [...estado, clave]
        return r
      })
    }
    if (ruta.endsWith('/cms/modulos')) return json(lista(estado))
    if (ruta.endsWith('/modulos')) return json({ activos: CATALOGO.modulos.map((m) => m.clave).filter((c) => !estado.includes(c)) })
    return json({ message: 'no esperado' }, 500)
  })
}

afterEach(() => { vi.unstubAllGlobals() })

describe('ModulosAdminPage', () => {
  it('lista los módulos por grupo, con su interruptor y sus datos', async () => {
    vi.stubGlobal('fetch', servidor(['loteria'], () => json({ ok: true })))
    renderWithProviders(<ModulosAdminPage />)
    expect(await screen.findByRole('heading', { name: 'Módulos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cuentas' })).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Tienda' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Lotería y talonarios' })).not.toBeChecked()
    expect(screen.getByText('12 productos, 40 ventas de caja')).toBeInTheDocument()
    expect(screen.getByText(/Requiere: Tienda, Pago en línea/)).toBeInTheDocument()
  })

  it('apagar pide confirmación con los datos que se ocultan, y luego apaga', async () => {
    const user = userEvent.setup({ delay: null })
    const put = vi.fn(() => json({ ok: true, cambiados: ['tienda'], activos: [] }))
    vi.stubGlobal('fetch', servidor(['tienda-web'], put))
    renderWithProviders(<ModulosAdminPage />)
    await user.click(await screen.findByRole('switch', { name: 'Tienda' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText(/12 productos, 40 ventas de caja/)).toBeInTheDocument()
    expect(within(dialogo).getByText(/se conservan/i)).toBeInTheDocument()
    await user.click(within(dialogo).getByRole('button', { name: /apagar/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(put).toHaveBeenCalledWith('tienda', { activo: false, conRequisitos: false })
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Tienda' })).not.toBeChecked())
  })

  it('apagar algo que otros necesitan: el servidor dice que no y la pantalla dice cuáles', async () => {
    const user = userEvent.setup({ delay: null })
    vi.stubGlobal('fetch', servidor([], () => json({ status: 'error', message: 'No se puede apagar «Pago en línea»: lo necesitan «Donativos en línea».', faltan: [], dependientes: ['donativos'] }, 400)))
    renderWithProviders(<ModulosAdminPage />)
    await user.click(await screen.findByRole('switch', { name: 'Pago en línea' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: /apagar/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/lo necesitan «Donativos en línea»/)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('switch', { name: 'Pago en línea' })).toBeChecked()
  })

  it('encender con requisitos apagados propone encenderlos en el mismo paso', async () => {
    const user = userEvent.setup({ delay: null })
    const put = vi.fn((_clave: string, body: { activo: boolean; conRequisitos?: boolean }) =>
      body.conRequisitos ? json({ ok: true, cambiados: ['tienda', 'tienda-web'], activos: [] }) : json({ status: 'error', message: 'Para encender «Tienda en la web» hay que encender también «Tienda».', faltan: ['tienda'], dependientes: [] }, 400))
    vi.stubGlobal('fetch', servidor(['tienda', 'tienda-web'], put))
    renderWithProviders(<ModulosAdminPage />)
    await user.click(await screen.findByRole('switch', { name: 'Tienda en la web' }))
    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText(/encender también/i)).toHaveTextContent('Tienda')
    await user.click(within(dialogo).getByRole('button', { name: /encender/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(put).toHaveBeenLastCalledWith('tienda-web', { activo: true, conRequisitos: true })
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Tienda' })).toBeChecked())
  })
})
```

- [ ] **Paso 2: ejecutar para verlas fallar**

```bash
cd desamparados-web && npx vitest run --testTimeout=20000 src/features/cms/__tests__/ModulosAdminPage.test.tsx
```

- [ ] **Paso 3: la pantalla**

`desamparados-web/src/features/cms/ModulosAdminPage.tsx`:

```tsx
import { useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Switch, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import CabeceraSeccion from './CabeceraSeccion'
import { GRUPOS } from '../../app/cmsNavegacion'
import { site } from '../../config/site'
import { ErrorDeApi } from '../../lib/api/cliente'
import { CLAVE_MODULOS, cambiarModulo, listasDelRechazo, modulosDelCms, type ModuloDelCms } from '../../lib/api/modulos'
import { fichaDeModulo, type ClaveModulo } from '../../domain/modulos'

const CLAVE_LISTA = ['modulos', 'cms'] as const

/** «12 productos, 40 ventas de caja», o nada. */
const datosEnPalabras = (m: ModuloDelCms) => m.datos.map((d) => `${d.total} ${d.que}`).join(', ')
const nombres = (claves: ClaveModulo[]) => claves.map((c) => fichaDeModulo(c).nombre).join(', ')

type Pregunta =
  | { tipo: 'apagar'; modulo: ModuloDelCms }
  | { tipo: 'encender-con'; modulo: ModuloDelCms; faltan: ClaveModulo[] }

/**
 * Qué módulos tiene encendidos esta instalación. Solo Administración: encender
 * uno abre pantallas y rutas a toda la junta. Las reglas (qué requiere qué, qué
 * impide apagar) las aplica el servidor: aquí solo se preguntan y se cuentan.
 */
export default function ModulosAdminPage() {
  const queryClient = useQueryClient()
  const { data, isPending, isError } = useQuery({ queryKey: CLAVE_LISTA, queryFn: modulosDelCms })
  const [pregunta, setPregunta] = useState<Pregunta | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const cambiar = useMutation({
    mutationFn: ({ clave, activo, conRequisitos }: { clave: ClaveModulo; activo: boolean; conRequisitos: boolean }) => cambiarModulo(clave, activo, conRequisitos),
    onSuccess: async () => {
      setAviso(null)
      // Los menús, las rutas y los bloques leen la lista pública: que la vuelvan a pedir.
      await Promise.all([queryClient.invalidateQueries({ queryKey: CLAVE_LISTA }), queryClient.invalidateQueries({ queryKey: CLAVE_MODULOS })])
    },
  })

  const alCambiar = (modulo: ModuloDelCms, activar: boolean) => {
    if (!activar) {
      setPregunta({ tipo: 'apagar', modulo })
      return
    }
    cambiar.mutate({ clave: modulo.clave, activo: true, conRequisitos: false }, {
      onError: (e) => {
        // Faltan requisitos: se proponen en el mismo paso, en vez de mandar a encenderlos uno a uno.
        const { faltan } = e instanceof ErrorDeApi ? listasDelRechazo(e.payload) : { faltan: [] }
        if (faltan.length) setPregunta({ tipo: 'encender-con', modulo, faltan })
        else setAviso(e.message)
      },
    })
  }

  const confirmar = () => {
    if (!pregunta) return
    const { modulo } = pregunta
    const activo = pregunta.tipo !== 'apagar'
    setPregunta(null)
    cambiar.mutate({ clave: modulo.clave, activo, conRequisitos: activo }, {
      onError: (e) => setAviso(e.message),
    })
  }

  return (
    <>
      <Helmet><title>{`Módulos | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <CabeceraSeccion titulo="Módulos" />
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 720 }}>
        Lo que esta instalación usa. Apagar un módulo lo quita del CMS, de la web y del área de hermanos y cierra sus rutas; sus datos se conservan y vuelven al encenderlo.
      </Typography>
      {aviso && <Alert severity="error" onClose={() => setAviso(null)} sx={{ mb: 2 }}>{aviso}</Alert>}
      {isError && <Alert severity="error">No se han podido cargar los módulos.</Alert>}
      {isPending && <Typography color="text.secondary">Cargando…</Typography>}
      {data && GRUPOS.map((grupo) => {
        const delGrupo = data.filter((m) => m.grupo === grupo)
        if (delGrupo.length === 0) return null
        return (
          <Box key={grupo} component="section" aria-labelledby={`modulos-${grupo}`} sx={{ mb: 4 }}>
            <Typography id={`modulos-${grupo}`} component="h2" variant="overline" color="text.secondary">{grupo}</Typography>
            <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
              {delGrupo.map((m) => (
                <Box key={m.clave} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', py: 1.5 }}>
                  <Switch
                    checked={m.activo}
                    disabled={cambiar.isPending}
                    onChange={(e) => alCambiar(m, e.target.checked)}
                    slotProps={{ input: { role: 'switch', 'aria-label': m.nombre } }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }}>{m.nombre}</Typography>
                    <Typography variant="body2" color="text.secondary">{m.descripcion}</Typography>
                    {m.requiere.length > 0 && (
                      <Typography variant="body2" color="text.secondary">Requiere: {nombres(m.requiere)}</Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">{m.datos.length ? datosEnPalabras(m) : 'Sin datos propios'}</Typography>
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
        )
      })}

      <Dialog open={pregunta !== null} onClose={() => setPregunta(null)}>
        {pregunta?.tipo === 'apagar' && (
          <>
            <DialogTitle>¿Apagar «{pregunta.modulo.nombre}»?</DialogTitle>
            <DialogContent>
              <Typography>
                {pregunta.modulo.datos.length ? `Tiene ${datosEnPalabras(pregunta.modulo)}. ` : ''}
                Sus datos se conservan: solo se ocultan, y vuelven al encenderlo. Sus pantallas desaparecen del CMS, de la web y del área de hermanos.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPregunta(null)}>Cancelar</Button>
              <Button variant="contained" color="error" onClick={confirmar}>Apagar</Button>
            </DialogActions>
          </>
        )}
        {pregunta?.tipo === 'encender-con' && (
          <>
            <DialogTitle>«{pregunta.modulo.nombre}» necesita otros módulos</DialogTitle>
            <DialogContent>
              <Typography>Para encenderlo hay que encender también: {nombres(pregunta.faltan)}. Se encienden todos en este paso.</Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPregunta(null)}>Cancelar</Button>
              <Button variant="contained" onClick={confirmar}>Encender todos</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  )
}
```

Si `CabeceraSeccion` exige `children`, pasarle `null`. Si el `Switch` de MUI 9 no admite `slotProps.input`, usar `inputProps={{ role: 'switch', 'aria-label': m.nombre }}`.

- [ ] **Paso 4: ejecutar las pruebas**

```bash
cd desamparados-web && npx tsc -b && npm run lint && npx vitest run --testTimeout=20000 src/features/cms/__tests__/ModulosAdminPage.test.tsx
```

- [ ] **Paso 5: commit**

```bash
git add desamparados-web/src/features/cms/ModulosAdminPage.tsx desamparados-web/src/features/cms/__tests__/ModulosAdminPage.test.tsx
git commit -m "Sistema → Módulos: encender y apagar módulos desde el CMS"
```

---

### Tarea 10: La web pública: barra, cajón, pie y el acceso

**Ficheros:**
- Modificar: `desamparados-web/src/config/navegacion.ts`, `desamparados-web/src/config/__tests__/navegacion.test.ts`, `desamparados-web/src/components/barra/MenuEscritorio.tsx`, `desamparados-web/src/components/barra/CajonMovil.tsx`, `desamparados-web/src/components/PieDePagina.tsx`, `desamparados-web/src/components/BarraDeNavegacion.tsx`, `desamparados-web/src/features/altas/auth/AccesoPage.tsx`
- Crear: `desamparados-web/src/hooks/useMenuPublico.ts`, `desamparados-web/src/components/__tests__/BarraDeNavegacion.modulos.test.tsx`

**Interfaces que produce:**

```ts
// config/navegacion.ts
export interface EntradaMenu { label; href; hijos?; exacta?; modulo: Modulo }
export function menuVisible(entradas: EntradaMenu[], activos: ReadonlySet<string>): EntradaMenu[]   // puro
// hooks/useMenuPublico.ts
export function useMenuPublico(): EntradaMenu[]   // [] mientras no se sabe
```

- [ ] **Paso 1: pruebas que fallan**

Añadir a `config/__tests__/navegacion.test.ts` (importando `menuVisible`):

```ts
  it('menuVisible quita las entradas de módulos apagados y una sección que se queda sin hijos', () => {
    const dibujo = (activos: string[]) => dibujar(menuVisible(menuPublico, new Set(activos))).join('\n')
    expect(dibujo(['agenda', 'noticias', 'publicaciones', 'area-hermanos', 'alta-web', 'apadrinamientos', 'tienda-web'])).toBe(dibujar(menuPublico).join('\n'))
    const sinTienda = dibujo(['agenda', 'noticias', 'publicaciones', 'area-hermanos', 'alta-web', 'apadrinamientos'])
    expect(sinTienda).not.toContain('Tienda /tienda')
    expect(sinTienda).toContain('Noticias /noticias')
    const sinActualidad = dibujo(['publicaciones', 'area-hermanos'])
    expect(sinActualidad).not.toContain('Actualidad')
    expect(sinActualidad).toContain('Corporación /corporacion')
    expect(sinActualidad).not.toContain('Hazte hermano')
    expect(sinActualidad).toContain('Acceso hermanos /acceso')
  })

  it('todas las entradas llevan su módulo', () => {
    for (const e of aplanarMenu(menuPublico)) expect(e.modulo, e.label).toBeDefined()
  })
```

Crear `desamparados-web/src/components/__tests__/BarraDeNavegacion.modulos.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import BarraDeNavegacion from '../BarraDeNavegacion'
import PieDePagina from '../PieDePagina'

describe('la barra y el pie con módulos apagados', () => {
  it('sin el área de hermanos no hay botón «Acceso hermanos»; sin tienda-web, el pie no enlaza la tienda', () => {
    renderWithProviders(<><BarraDeNavegacion /><PieDePagina /></>, { modulos: ['noticias', 'agenda', 'publicaciones'] })
    expect(screen.queryByRole('link', { name: 'Acceso hermanos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Tienda' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Noticias' }).length).toBeGreaterThan(0)
  })

  it('con todo encendido, los dos están', () => {
    renderWithProviders(<><BarraDeNavegacion /><PieDePagina /></>)
    expect(screen.getAllByRole('link', { name: 'Acceso hermanos' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Tienda' }).length).toBeGreaterThan(0)
  })
})
```

(Si `BarraDeNavegacion` necesita algo del contexto que no da `renderWithProviders`, mirar cómo la montan `components/__tests__/BarraDeNavegacion*.test.tsx` existentes y copiarlo.)

- [ ] **Paso 2: ejecutar para verlas fallar**

```bash
cd desamparados-web && npx vitest run --testTimeout=20000 src/config src/components/__tests__/BarraDeNavegacion.modulos.test.tsx
```

- [ ] **Paso 3: el mapa con módulos y el filtro**

En `config/navegacion.ts`:

```ts
import { cumple, type Modulo } from '../domain/modulos'

export interface EntradaMenu {
  label: string
  href: string
  hijos?: EntradaMenu[]
  exacta?: true
  /** De qué módulo es: apagado, la entrada no sale. Una sección que se queda sin hijos tampoco. */
  modulo: Modulo
}
```

Cada entrada con su `modulo`: Inicio, Corporación y todas las suyas, Sagrada titular, Desamparados, Ajuar, Actualidad (la sección), Publicaciones (la sección), Hermanos (la sección), Contacto → `'nucleo'`; Apadrina → `'apadrinamientos'`; Agenda → `'agenda'`; Noticias → `'noticias'`; Tienda → `'tienda-web'`; Todas las publicaciones, Boletines, Dossier prensa → `'publicaciones'`; Hazte hermano → `'alta-web'`; Acceso hermanos → `'area-hermanos'`.

**En la misma línea que `label`**, también en las entradas que ocupan varias líneas (las secciones con `hijos`): la guardiana (Tarea 17) lee el fichero línea a línea y exige `modulo:` en cada línea que lleve `label:`. Así: `label: 'Corporación', modulo: 'nucleo',` y debajo `href` e `hijos` como estaban. Dejarlo dicho en un comentario encima de `menuPublico`.

Debajo de `aplanarMenu`:

```ts
/**
 * El menú con estos módulos encendidos. Una sección (que no es enlace) que se
 * quede sin hijos desaparece: un título que no despliega nada confunde.
 */
export function menuVisible(entradas: EntradaMenu[], activos: ReadonlySet<string>): EntradaMenu[] {
  return entradas.flatMap((e) => {
    if (!cumple(e.modulo, activos)) return []
    if (!e.hijos) return [e]
    const hijos = menuVisible(e.hijos, activos)
    return hijos.length === 0 ? [] : [{ ...e, hijos }]
  })
}
```

Crear `hooks/useMenuPublico.ts`:

```ts
import { useMemo } from 'react'
import { menuPublico, menuVisible, type EntradaMenu } from '../config/navegacion'
import { useModulos } from './useModulos'

/** El menú de la web con los módulos encendidos; vacío mientras no se saben (no se pinta nada a medias). */
export function useMenuPublico(): EntradaMenu[] {
  const { activos } = useModulos()
  return useMemo(() => (activos ? menuVisible(menuPublico, activos) : []), [activos])
}
```

`components/barra/MenuEscritorio.tsx` y `components/barra/CajonMovil.tsx`: sustituir cada uso de `menuPublico` (el `.map` y el `.find`) por `const menu = useMenuPublico()` dentro del componente y usar `menu`. `components/PieDePagina.tsx`: `entradasMenu` deja de calcularse a nivel de módulo; dentro del componente, `const entradasMenu = new Map(aplanarMenu(useMenuPublico()).map((e) => [e.href, e.label]))`. Las rutas de `columnas` no cambian: una ruta que ya no está en el menú no se pinta (el pie ya lo hace así).

`components/BarraDeNavegacion.tsx`: el botón «Acceso hermanos» solo con `area-hermanos`:

```tsx
  const { activo } = useModulos()
  // …
  {activo('area-hermanos') && (
    <Button component={Link} to="/acceso" …>Acceso hermanos</Button>
  )}
```
(y lo mismo si el cajón móvil lleva su propio botón de acceso).

- [ ] **Paso 4: el acceso con el área apagada**

En `features/altas/auth/AccesoPage.tsx`, antes de pintar el formulario (después de la redirección de quien ya tiene sesión):

```tsx
  const { activo, activos } = useModulos()
  // Con el área apagada, el servidor rechaza el login con un 404; mejor decirlo
  // antes de que nadie escriba su contraseña. A la junta se le enseña su acceso.
  if (activos && !activo('area-hermanos')) {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Typography component="h1" variant="h5" sx={{ mb: 1.5 }}>El área de hermanos no está activada</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>En esta instalación los hermanos no entran por la web.</Typography>
        <Typography>Si eres de la Junta de Gobierno, entra por el <Link to="/cms/acceso">acceso del CMS</Link>.</Typography>
      </Box>
    )
  }
```
(importar `useModulos`, `Box`, `Typography` y `Link` de react-router si no están). Añadir en `features/altas/auth/__tests__/AccesoPage.test.tsx` (o el que exista para esa pantalla) un caso: con `modulos: ['noticias']` no hay campo de contraseña y sí el enlace al acceso del CMS.

- [ ] **Paso 5: ejecutar las pruebas**

```bash
cd desamparados-web && npx tsc -b && npm run lint && npx vitest run --testTimeout=20000 src/config src/components src/features/altas
```

- [ ] **Paso 6: commit**

```bash
git add desamparados-web/src/config/navegacion.ts desamparados-web/src/config/__tests__/navegacion.test.ts desamparados-web/src/hooks/useMenuPublico.ts desamparados-web/src/components/barra desamparados-web/src/components/PieDePagina.tsx desamparados-web/src/components/BarraDeNavegacion.tsx desamparados-web/src/components/__tests__/BarraDeNavegacion.modulos.test.tsx desamparados-web/src/features/altas/auth
git commit -m "Web pública: la barra, el cajón y el pie solo enlazan módulos encendidos"
```

---

### Tarea 11: El área de hermanos

**Ficheros:**
- Crear: `desamparados-web/src/app/areaHermanoNavegacion.ts`, `desamparados-web/src/app/__tests__/MarcoAreaHermano.test.tsx`
- Modificar: `desamparados-web/src/app/MarcoAreaHermano.tsx`, `desamparados-web/src/features/areaHermano/perfil/PerfilPage.tsx`, `desamparados-web/src/features/areaHermano/procesion/ProcesionPage.tsx`, `desamparados-web/src/features/areaHermano/recibos/RecibosPage.tsx`

**Interfaces que produce:**

```ts
// app/areaHermanoNavegacion.ts
export interface EntradaArea { label: string; href: string; icono: ComponentType; modulo: Modulo }
export const entradasDelArea: EntradaArea[]   // Mi perfil (nucleo), Mi familia (nucleo), Procesión (procesion), Recibos (nucleo)
```

- [ ] **Paso 1: prueba que falla**

Crear `desamparados-web/src/app/__tests__/MarcoAreaHermano.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import MarcoAreaHermano from '../MarcoAreaHermano'
import { entradasDelArea } from '../areaHermanoNavegacion'
import { useAuthStore } from '../../features/altas/auth/store'

describe('el menú del área de hermanos', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'listo', cms: null, hermano: { id: 1, email: 'h@ejemplo.es', role: 'USER', perfiles: [], origen: 'hermanos' } })
  })

  it('sin Procesión, la entrada «Procesión» no está; las demás sí', () => {
    renderWithProviders(<MarcoAreaHermano />, { ruta: '/area-hermano/perfil', modulos: ['area-hermanos'] })
    expect(screen.queryAllByRole('link', { name: 'Procesión' })).toHaveLength(0)
    expect(screen.getAllByRole('link', { name: 'Recibos' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Mi perfil' }).length).toBeGreaterThan(0)
  })

  it('todas las entradas llevan su módulo', () => {
    for (const e of entradasDelArea) expect(e.modulo, e.label).toBeDefined()
  })
})
```

- [ ] **Paso 2: ejecutar para verla fallar**

```bash
cd desamparados-web && npx vitest run --testTimeout=20000 src/app/__tests__/MarcoAreaHermano.test.tsx
```

- [ ] **Paso 3: el menú del área, fuera del componente**

Crear `desamparados-web/src/app/areaHermanoNavegacion.ts`:

```ts
import type { ComponentType } from 'react'
import PersonIcon from '@mui/icons-material/Person'
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom'
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk'
import ReceiptIcon from '@mui/icons-material/Receipt'
import type { Modulo } from '../domain/modulos'

export interface EntradaArea {
  label: string
  href: string
  icono: ComponentType
  /** De qué módulo es: apagado, no sale. Recibos es del núcleo; el pago en línea dentro de ella, no. */
  modulo: Modulo
}

/**
 * El menú del área de hermanos. Fuera del componente, como el del CMS
 * (`cmsNavegacion.ts`): la guardiana de módulos lo lee y los tests lo cruzan.
 */
export const entradasDelArea: EntradaArea[] = [
  { label: 'Mi perfil', href: '/area-hermano/perfil', icono: PersonIcon, modulo: 'nucleo' },
  // Las fichas de quienes están a su cargo: un menor apuntado por su padre, su
  // tío o su padrino. Sin esta pantalla, el alta de un menor solo se podía
  // hacer el día del registro y nunca más.
  { label: 'Mi familia', href: '/area-hermano/familia', icono: FamilyRestroomIcon, modulo: 'nucleo' },
  { label: 'Procesión', href: '/area-hermano/procesion', icono: DirectionsWalkIcon, modulo: 'procesion' },
  { label: 'Recibos', href: '/area-hermano/recibos', icono: ReceiptIcon, modulo: 'nucleo' },
]
```

En `MarcoAreaHermano.tsx`: quitar `entradasDelMenu` y las importaciones de iconos; `const { activo } = useModulos()` y `const entradas = entradasDelArea.filter((e) => activo(e.modulo))`; en el `.map`, `<item.icono />` en vez de `{item.icon}`.

- [ ] **Paso 4: las pantallas del área por trozos**

`features/areaHermano/perfil/PerfilPage.tsx`: `const { activo } = useModulos()`; `{activo('procesion') && <VidaCofrade ficha={ficha} onGuardada={guardada} />}` y `{activo('cuotas-en-linea') && <CuotaYPago ficha={ficha} onGuardada={guardada} />}`.

`features/areaHermano/procesion/ProcesionPage.tsx`: donde se monta `<PorPagar …/>`, `{activo('cuotas-en-linea') && <PorPagar …/>}` (y lo mismo con `<VueltaDelBanco …/>`, que solo tiene sentido con pago).

`features/areaHermano/recibos/RecibosPage.tsx`: `{activo('modelo-182') && <CertificadosDonativos />}`; si la pantalla tiene algún botón de pagar en línea (`grep -n "pagarEnLinea\|PorPagar" src/features/areaHermano/recibos/*.tsx`), también con `cuotas-en-linea`.

Añadir a las pruebas existentes de esas pantallas (`features/areaHermano/**/__tests__/`) un caso por pantalla con `modulos: ['area-hermanos']`: en el perfil no hay «Vida cofrade» ni la forma de pago; en recibos no hay certificados.

- [ ] **Paso 5: ejecutar las pruebas**

```bash
cd desamparados-web && npx tsc -b && npm run lint && npx vitest run --testTimeout=20000 src/app src/features/areaHermano
```

- [ ] **Paso 6: commit**

```bash
git add desamparados-web/src/app/areaHermanoNavegacion.ts desamparados-web/src/app/MarcoAreaHermano.tsx desamparados-web/src/app/__tests__/MarcoAreaHermano.test.tsx desamparados-web/src/features/areaHermano
git commit -m "Área de hermanos: menú y pantallas según los módulos encendidos"
```

---

### Tarea 12: Los bloques del constructor

**Ficheros:**
- Modificar: `shared/tipos-de-bloque.json`, `backend-desamparados/test/bloques-catalogo.test.ts`, `desamparados-web/src/components/bloques/BloquesDePagina.tsx`, `desamparados-web/src/components/bloques/RecorridoEnMapa.tsx`, `desamparados-web/src/components/bloques/BloquePrograma.tsx`, `desamparados-web/src/features/cms/constructor/GaleriaDeBloques.tsx`, `desamparados-web/src/features/cms/bloques/formularios/breves.tsx`
- Crear: `desamparados-web/src/components/bloques/modulos.ts`, `desamparados-web/src/components/bloques/__tests__/modulos.test.tsx`

**Interfaces que produce:**

```ts
// shared/tipos-de-bloque.json gana "modulo": { "<tipo>": "nucleo" | "<clave>" | { "porFuente": { "<fuente>": "<clave>" } } }
// components/bloques/modulos.ts
export function moduloDeTipo(tipo: string): Modulo | Modulo[]     // un listado: todos los de sus fuentes (se ofrece si alguna está)
export function moduloDeBloque(bloque: Bloque): Modulo             // un listado: el de su fuente
export function fuentesVisibles(activos: ReadonlySet<string>): FuenteListado[]
```

- [ ] **Paso 1: el catálogo**

En `shared/tipos-de-bloque.json`, añadir al `_comentario`:

```
    "",
    "modulo (02-10-2026): de qué módulo es cada tipo. 'nucleo' siempre se pinta; con una",
    "clave, el bloque no se pinta ni se ofrece con el módulo apagado. El listado va por",
    "fuente: noticias, agenda y publicaciones son módulos distintos. El itinerario y el",
    "programa son del núcleo: solo consultan el cortejo en directo y la agenda si están."
```
y, tras `"tipos": [...]`:

```json
  "modulo": {
    "texto": "nucleo", "foto": "nucleo", "galeria": "nucleo", "tarjetas": "nucleo", "llamada": "nucleo",
    "datos": "nucleo", "itinerario": "nucleo", "cronologia": "nucleo",
    "listado": { "porFuente": { "noticias-recientes": "noticias", "noticias": "noticias", "agenda-proxima": "agenda", "agenda": "agenda", "publicaciones": "publicaciones", "boletines": "publicaciones", "dossier": "publicaciones" } },
    "contacto": "nucleo", "fotoTexto": "nucleo", "cita": "nucleo", "video": "nucleo", "botones": "nucleo",
    "preguntas": "nucleo", "descargas": "nucleo", "mapa": "nucleo", "cuentaAtras": "nucleo", "espacio": "nucleo",
    "fotoFija": "nucleo", "horario": "nucleo", "dibujo": "nucleo", "anillos": "nucleo", "puertas": "nucleo",
    "programa": "nucleo", "relacion": "nucleo", "carrusel": "nucleo", "donativo": "donativos"
  }
```

Añadir a `backend-desamparados/test/bloques-catalogo.test.ts`:

```ts
import catalogo from '../../shared/tipos-de-bloque.json' with { type: 'json' };
import { esClaveDeModulo } from '../src/domain/modulos.js';
import { FUENTES_LISTADO } from '../src/schemas/bloques.schema.js';

  test('cada tipo dice de qué módulo es, con claves del catálogo; el listado, por cada fuente', () => {
    const modulo = catalogo.modulo as Record<string, string | { porFuente: Record<string, string> }>;
    assert.deepEqual(Object.keys(modulo).sort(), [...TIPOS_BLOQUE].sort());
    for (const [tipo, m] of Object.entries(modulo)) {
      if (typeof m === 'string') assert.ok(m === 'nucleo' || esClaveDeModulo(m), `${tipo}: «${m}»`);
      else {
        assert.deepEqual(Object.keys(m.porFuente).sort(), [...FUENTES_LISTADO].sort(), `${tipo}: una entrada por fuente`);
        for (const [fuente, clave] of Object.entries(m.porFuente)) assert.ok(esClaveDeModulo(clave), `${tipo}/${fuente}: «${clave}»`);
      }
    }
  });
```

- [ ] **Paso 2: pruebas de la web que fallan**

Crear `desamparados-web/src/components/bloques/__tests__/modulos.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BloquesDePagina from '../BloquesDePagina'
import { fuentesVisibles, moduloDeBloque, moduloDeTipo } from '../modulos'
import type { Bloque } from '../../../lib/api/contenido'

const texto: Bloque = { tipo: 'texto', titulo: 'Un texto', contenido: '<p>Hola</p>' } as Bloque
const donativo: Bloque = { tipo: 'donativo', titulo: 'Donativo', importes: [5, 10], destinos: [] } as unknown as Bloque

describe('los bloques y los módulos', () => {
  it('moduloDeTipo y moduloDeBloque leen el catálogo; el listado va por fuente', () => {
    expect(moduloDeTipo('texto')).toBe('nucleo')
    expect(moduloDeTipo('donativo')).toBe('donativos')
    expect(moduloDeTipo('listado')).toEqual(['noticias', 'noticias', 'agenda', 'agenda', 'publicaciones', 'publicaciones', 'publicaciones'])
    expect(moduloDeBloque({ tipo: 'listado', fuente: 'agenda-proxima' } as Bloque)).toBe('agenda')
    expect(fuentesVisibles(new Set(['agenda']))).toEqual(['agenda-proxima', 'agenda'])
  })

  it('un bloque de un módulo apagado no se pinta; el del núcleo sí', () => {
    renderWithProviders(<BloquesDePagina bloques={[texto, donativo]} />, { modulos: ['noticias'] })
    expect(screen.getByText('Hola')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Donativo' })).not.toBeInTheDocument()
  })
})
```

Si `Bloque` de tipo `donativo` exige otros campos, usar el bloque de donativo de `shared/contenido-por-defecto.json` (buscar `"tipo": "donativo"`).

- [ ] **Paso 3: ejecutar para verlas fallar**

```bash
cd backend-desamparados && npx tsx --test test/bloques-catalogo.test.ts
cd ../desamparados-web && npx vitest run --testTimeout=20000 src/components/bloques/__tests__/modulos.test.tsx
```

- [ ] **Paso 4: la web**

Crear `desamparados-web/src/components/bloques/modulos.ts`:

```ts
import CATALOGO from '../../../../shared/tipos-de-bloque.json'
import type { Modulo } from '../../domain/modulos'
import type { Bloque, FuenteListado } from '../../lib/api/contenido'

type EntradaDeModulo = Modulo | { porFuente: Record<string, Modulo> }
const MODULO_DE_TIPO = CATALOGO.modulo as Record<string, EntradaDeModulo>

/** Un tipo se ofrece en «Añadir bloque» si su módulo está; un listado, si está el de alguna de sus fuentes. */
export function moduloDeTipo(tipo: string): Modulo | Modulo[] {
  const m = MODULO_DE_TIPO[tipo]
  if (m === undefined) return 'nucleo'
  return typeof m === 'string' ? m : Object.values(m.porFuente)
}

/** El módulo de un bloque concreto: el de su tipo o, en un listado, el de su fuente. */
export function moduloDeBloque(bloque: Bloque): Modulo {
  const m = MODULO_DE_TIPO[bloque.tipo]
  if (m === undefined || typeof m === 'string') return m ?? 'nucleo'
  const fuente = (bloque as { fuente?: string }).fuente
  return (fuente && m.porFuente[fuente]) || 'nucleo'
}

/** Las fuentes de listado que se pueden elegir con estos módulos. */
export function fuentesVisibles(activos: ReadonlySet<string>): FuenteListado[] {
  const m = MODULO_DE_TIPO.listado
  if (typeof m === 'string') return []
  return (Object.entries(m.porFuente) as [FuenteListado, Modulo][]).filter(([, modulo]) => modulo === 'nucleo' || activos.has(modulo)).map(([fuente]) => fuente)
}
```

`components/bloques/BloquesDePagina.tsx`, en `BloqueDePagina`, antes de `const Componente`:

```tsx
  const { activos } = useModulos()
  const modulo = moduloDeBloque(bloque)
  // Un bloque de un módulo apagado no se pinta; en el constructor se dice por qué,
  // para que quien edita no crea que se ha perdido.
  if (modulo !== 'nucleo' && !(activos?.has(modulo))) {
    return modo !== null ? <AvisoDeModuloApagado modulo={modulo} bloque={bloque} indice={indice} /> : null
  }
```
con `modo` de `useModoEdicion()` (ya se usa en `BloquesDePagina`; en `BloqueDePagina` llamarlo también) y, en el mismo fichero:

```tsx
function AvisoDeModuloApagado({ modulo, bloque, indice }: { modulo: Exclude<Modulo, 'nucleo'>; bloque: Bloque; indice: number }) {
  return (
    <MarcoEditable bloque={bloque} indice={indice}>
      <Box sx={{ p: 2, border: '1px dashed', borderColor: 'warning.main', borderRadius: 1, color: 'text.secondary', fontSize: 14 }}>
        Este bloque es del módulo «{fichaDeModulo(modulo).nombre}», que no está activado: no se enseña en la web.
      </Box>
    </MarcoEditable>
  )
}
```
`BloquesDePagina` también salta los bloques de módulo apagado al repartir el aire (en el filtro de `aPintar`, fuera de la edición): `.filter(({ bloque }) => modo !== null || (visibilidadDe(bloque) === 'visible' && activo(moduloDeBloque(bloque))))` con `const { activo } = useModulos()`.

`components/bloques/RecorridoEnMapa.tsx`: `const { activo } = useModulos()` y en el `useQuery` del cortejo, `enabled: !enConstructor && activo('cortejo-directo')`. `components/bloques/BloquePrograma.tsx`: `enabled: activo('agenda')` en su `useQuery` (y `proximaFila` con `actos` indefinido ya marca ninguna fila: comprobarlo en `programa.ts`; si no, pasar `[]`).

`features/cms/constructor/GaleriaDeBloques.tsx`, en `Tipos`: `const { activo } = useModulos()` y `const tipos = TIPOS.tipos.filter((tipo) => FICHA_DE_BLOQUE[tipo]?.grupo === grupo && activo(moduloDeTipo(tipo)))`.

`features/cms/bloques/formularios/breves.tsx`: donde se listan las fuentes del listado (las opciones con `valor: 'noticias-recientes'`…), filtrarlas con `fuentesVisibles(activos)` (`useModulos` en el componente del formulario).

- [ ] **Paso 5: ejecutar las pruebas**

```bash
cd backend-desamparados && npx tsx --test test/bloques-catalogo.test.ts
cd ../desamparados-web && npx tsc -b && npm run lint && npx vitest run --testTimeout=20000 src/components/bloques src/features/cms/constructor src/features/cms/bloques
```

- [ ] **Paso 6: commit**

```bash
git add shared/tipos-de-bloque.json backend-desamparados/test/bloques-catalogo.test.ts desamparados-web/src/components/bloques desamparados-web/src/features/cms/constructor/GaleriaDeBloques.tsx desamparados-web/src/features/cms/bloques/formularios/breves.tsx
git commit -m "Constructor: los bloques de un módulo apagado no se pintan ni se ofrecen"
```

---
## Fase C: las pantallas mezcladas del CMS

### Tarea 13: El Inicio del CMS

**Ficheros:**
- Modificar: `desamparados-web/src/features/cms/inicio/tareas.ts`, `desamparados-web/src/features/cms/inicio/Cifras.tsx`, `desamparados-web/src/features/cms/PanelPage.tsx`, `desamparados-web/src/features/cms/inicio/__tests__/tareas.test.ts` (o el que pruebe `tareasDelDia`)
- Borrar: `desamparados-web/src/features/cms/inicio/ComoVaElAnio.tsx`, `desamparados-web/src/features/cms/inicio/__tests__/ComoVaElAnio.test.tsx`, `desamparados-web/src/features/cms/inicio/Cortejo.tsx` y su prueba si la tiene (`ls src/features/cms/inicio/__tests__/`)

**Interfaces que produce:**

```ts
// tareas.ts
export interface Tarea { …; modulo: Modulo }
export function tareasDelDia(panel: PanelResponse, hoy?: Date, activos?: ReadonlySet<string>): Tarea[]   // sin `activos`, todo encendido
```

- [ ] **Paso 1: código muerto fuera**

```bash
cd desamparados-web && git rm src/features/cms/inicio/ComoVaElAnio.tsx src/features/cms/inicio/__tests__/ComoVaElAnio.test.tsx src/features/cms/inicio/Cortejo.tsx
grep -rn "Cortejo'\|ComoVaElAnio" src   # tiene que quedar vacío (borrar también la prueba de Cortejo si existe)
```

- [ ] **Paso 2: pruebas que fallan**

En la prueba de `tareasDelDia` (buscar con `grep -rln tareasDelDia src/features/cms/inicio/__tests__`), añadir, reutilizando el panel de ejemplo que ya tenga:

```ts
  it('las tareas de un módulo apagado no salen; las del núcleo sí', () => {
    // Un panel con recibos devueltos, borradores y citas de reparto a la vez.
    const todas = tareasDelDia(PANEL_CON_TODO, HOY)
    expect(todas.map((t) => t.clave)).toEqual(expect.arrayContaining(['recibos-devueltos', 'noticias-borrador', 'citas-reparto']))
    const sinProcesionNiNoticias = tareasDelDia(PANEL_CON_TODO, HOY, new Set())
    expect(sinProcesionNiNoticias.map((t) => t.clave)).toContain('recibos-devueltos')
    expect(sinProcesionNiNoticias.map((t) => t.clave)).not.toContain('citas-reparto')
    expect(sinProcesionNiNoticias.map((t) => t.clave)).not.toContain('noticias-borrador')
  })
```
(`PANEL_CON_TODO` y `HOY`: los que use ya ese fichero, o uno construido ahí con `dinero.devueltosPendientes.total: 2`, `actividad.noticias.borradores: 1` y `actividad.reparto.citasReservadas: 3`.)

En `features/cms/__tests__/PanelPage.test.tsx`, un caso con `modulos: ['noticias', 'agenda']` en el que la pestaña Cifras no tiene el botón «Papeletas …» (`screen.queryByRole('button', { name: /papeletas/i })` es null) y sí «Hermanos activos».

- [ ] **Paso 3: tareas y cifras con módulo**

`tareas.ts`:

```ts
import { CLAVES_MODULO, cumple, type Modulo } from '../../../domain/modulos'
// en Tarea:
  /** De qué módulo es el asunto: apagado, no se enseña. Los avisos de la junta son del núcleo. */
  modulo: Modulo
```
Cada `tareas.push({...})` con su `modulo`: `recibos-devueltos` → `'nucleo'`; `noticias-borrador` → `'noticias'`; `hermanos-sin-numero` → `'nucleo'`; `citas-reparto` → `'procesion'`; en `tareaDeAviso`, `modulo: 'nucleo'`. La firma y el final:

```ts
export function tareasDelDia(panel: PanelResponse, hoy: Date = new Date(), activos: ReadonlySet<string> = new Set(CLAVES_MODULO)): Tarea[] {
  // …
  return tareas.filter((t) => cumple(t.modulo, activos)).sort((a, b) => ORDEN[a.prioridad] - ORDEN[b.prioridad])
}
```

`PanelPage.tsx`: `const { activos } = useModulos()` y `tareasDelDia(data, undefined, activos ?? new Set())` (sin lista aún, no se enseñan tareas de módulo: mejor que aparecer y desaparecer).

`Cifras.tsx`: cada objeto de `cifras` gana `modulo` (`'nucleo'` salvo «Papeletas …» → `'procesion'`), y después del array:

```tsx
  const { activo } = useModulos()
  const visibles = cifras.filter((c) => activo(c.modulo))
  const actual = visibles[Math.min(elegida, visibles.length - 1)]
```
usando `visibles` en el selector y en `gridTemplateRows: \`repeat(${visibles.length}, minmax(0, 1fr))\``.

- [ ] **Paso 4: ejecutar las pruebas**

```bash
cd desamparados-web && npx tsc -b && npm run lint && npx vitest run --testTimeout=20000 src/features/cms/inicio src/features/cms/__tests__/PanelPage.test.tsx
```

- [ ] **Paso 5: commit**

```bash
git add -A desamparados-web/src/features/cms/inicio desamparados-web/src/features/cms/PanelPage.tsx desamparados-web/src/features/cms/__tests__/PanelPage.test.tsx
git commit -m "Inicio del CMS: cifras y tareas solo de módulos encendidos; fuera el código muerto"
```

---

### Tarea 14: Censo, Tesorería, Hermanos y Boletín, por trozos

**Ficheros:**
- Modificar: `desamparados-web/src/features/cms/censo/FichaCenso.tsx`, `desamparados-web/src/features/cms/HermanoEditPage.tsx`, `desamparados-web/src/features/cms/TesoreriaAdminPage.tsx`, `desamparados-web/src/features/cms/HermanosAdminPage.tsx`, `desamparados-web/src/features/cms/ComunicadoEditPage.tsx`, y sus pruebas en `features/cms/__tests__/`

- [ ] **Paso 1: pruebas que fallan**

Un caso nuevo en cada prueba existente, con `renderWithProviders(<Pantalla />, { modulos: [...] })`:

- `HermanoEditPage.test.tsx`: con `modulos: []`, no hay encabezado «Procesión» (`screen.queryByRole('heading', { name: 'Procesión' })` null) ni campo «Talla de túnica»; con todo, sí.
- `HermanosAdminPage.test.tsx`: con `modulos: []`, no hay pestaña «Difuntos»; y con la URL `?vista=difuntos` se ve el censo.
- `TesoreriaAdminPage.test.tsx`: con `modulos: []`, no hay pestañas «Remesas» ni «Modelo 182» (`screen.queryByRole('tab', { name: 'Remesas' })`); con `modulos: ['remesas']`, está «Remesas» y no «Modelo 182».
- `ComunicadoEditPage.test.tsx`: con `modulos: ['comunicados']`, no está el filtro «con papeleta de» (buscar su etiqueta exacta en la pantalla con `grep -n "papeleta" src/features/cms/ComunicadoEditPage.tsx`).
- La prueba de `FichaCenso` (buscar con `grep -rln FichaCenso src/features/cms/__tests__ src/features/cms/censo`): con `modulos: []`, no están «Papeleta de sitio» ni «Del ropero»; sí «Último recibo».

- [ ] **Paso 2: ejecutar para verlas fallar**

```bash
cd desamparados-web && npx vitest run --testTimeout=20000 src/features/cms/__tests__/HermanoEditPage.test.tsx src/features/cms/__tests__/HermanosAdminPage.test.tsx src/features/cms/__tests__/TesoreriaAdminPage.test.tsx src/features/cms/__tests__/ComunicadoEditPage.test.tsx
```

- [ ] **Paso 3: cada pantalla**

En todas, `const { activo } = useModulos()` (importar de `../../hooks/useModulos` o la ruta relativa que toque).

`censo/FichaCenso.tsx` (líneas ~196-228): los dos `Resumen` de Procesión condicionados:

```tsx
  {activo('procesion') && (
    <Resumen titulo="Papeleta de sitio">…</Resumen>
  )}
  {activo('procesion') && (
    <Resumen titulo="Del ropero">…</Resumen>
  )}
```

`HermanoEditPage.tsx` (líneas ~405-416): el `<Divider />` y el `<Box>` de la sección «Procesión» dentro de `{activo('procesion') && (<>…</>)}`.

`TesoreriaAdminPage.tsx`:

```tsx
  const conRemesas = activo('remesas')
  const conModelo182 = activo('modelo-182')
  const vistaPedida = params.get('vista')
  // Una vista de un módulo apagado (un enlace guardado) cae en Recibos.
  const vista = vistaPedida === 'impagos' || (vistaPedida === 'remesas' && conRemesas) || (vistaPedida === 'modelo182' && conModelo182) ? vistaPedida : 'recibos'
  // …
  <Tab value="impagos" label="Impagos" />
  {conRemesas && <Tab value="remesas" label="Remesas" />}
  {conModelo182 && <Tab value="modelo182" label="Modelo 182" />}
```

`HermanosAdminPage.tsx`: igual con `const conDifuntos = activo('difuntos')`: `pedida === 'difuntos' && conDifuntos`, y `{conDifuntos && <Tab value="difuntos" label="Difuntos" />}`.

`ComunicadoEditPage.tsx`: el control del filtro «con papeleta de…» (y lo que lo acompañe, como el desplegable de salidas) dentro de `{activo('procesion') && (…)}`; al guardar con el módulo apagado, `conPapeleta: null` (el servidor ya lo ignora, pero no se guarda un filtro que la pantalla no enseña).

- [ ] **Paso 4: ejecutar las pruebas**

```bash
cd desamparados-web && npx tsc -b && npm run lint && npx vitest run --testTimeout=20000 src/features/cms
```

- [ ] **Paso 5: commit**

```bash
git add desamparados-web/src/features/cms
git commit -m "CMS: la ficha del censo, Tesorería, Hermanos y el boletín esconden lo de módulos apagados"
```

---

### Tarea 15: Inventario y Ropero en la misma pantalla

**Ficheros:**
- Modificar: `desamparados-web/src/features/cms/InventarioAdminPage.tsx`, `desamparados-web/src/features/cms/__tests__/InventarioAdminPage.test.tsx`

**Comportamiento:** con `inventario` y `procesion` encendidos, como hoy (dos pestañas). Solo `procesion`: título «Ropero», sin pestañas, solo prendas y cíngulos, botón «Nueva prenda». Solo `inventario`: título «Inventario», sin pestañas, solo enseres. (Con los dos apagados la ruta ya no se abre: Tarea 7.)

- [ ] **Paso 1: pruebas que fallan**

Añadir a `InventarioAdminPage.test.tsx`. `servidor()` es aquí el simulador de `fetch` que ya tenga ese fichero (si se llama de otra forma o recibe argumentos, usar el suyo tal cual):

```tsx
  it('solo con Procesión es «Ropero»: sin pestañas, prendas y cíngulos, y «Nueva prenda»', async () => {
    vi.stubGlobal('fetch', servidor())
    renderWithProviders(<InventarioAdminPage />, { modulos: ['procesion', 'agenda'] })
    expect(await screen.findByRole('heading', { name: 'Ropero' })).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nueva prenda/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Buscar en el ropero')).toBeInTheDocument()
  })

  it('solo con Inventario no hay ropero', async () => {
    vi.stubGlobal('fetch', servidor())
    renderWithProviders(<InventarioAdminPage />, { modulos: ['inventario'] })
    expect(await screen.findByRole('heading', { name: 'Inventario' })).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /nuevo enser/i })).toBeInTheDocument()
    expect(screen.queryByLabelText('Buscar en el ropero')).not.toBeInTheDocument()
  })
```

- [ ] **Paso 2: ejecutar para verlas fallar**

```bash
cd desamparados-web && npx vitest run --testTimeout=20000 src/features/cms/__tests__/InventarioAdminPage.test.tsx
```

- [ ] **Paso 3: la pantalla**

En `InventarioAdminPage.tsx`:

```tsx
  const { activo } = useModulos()
  // El ropero es de Procesión y los enseres del Inventario: la pantalla enseña lo que haya.
  const conEnseres = activo('inventario')
  const conRopero = activo('procesion')
  const [params, setParams] = useSearchParams()
  const tab = !conEnseres ? 1 : !conRopero ? 0 : params.get('vista') === 'ropero' ? 1 : 0
  const titulo = conEnseres ? 'Inventario' : 'Ropero'
```
y:
- `<Helmet><title>{\`${titulo} | CMS ${site.nombreCorto}\`}</title>…` y `<CabeceraSeccion titulo={titulo}>`.
- Las pestañas solo con los dos: `{conEnseres && conRopero && <Tabs …>…</Tabs>}`.
- Las cargas de datos de cada pestaña (`useEffect` que piden enseres/opciones y prendas/cíngulos) solo si su módulo está (`if (!conEnseres) return` / `if (!conRopero) return` al principio de cada efecto, y en sus dependencias).

- [ ] **Paso 4: ejecutar las pruebas**

```bash
cd desamparados-web && npx tsc -b && npm run lint && npx vitest run --testTimeout=20000 src/features/cms/__tests__/InventarioAdminPage.test.tsx src/features/cms/__tests__/InventarioEditPage.test.tsx
```

- [ ] **Paso 5: commit**

```bash
git add desamparados-web/src/features/cms/InventarioAdminPage.tsx desamparados-web/src/features/cms/__tests__/InventarioAdminPage.test.tsx
git commit -m "CMS: sin Inventario, la pantalla es solo el Ropero"
```

---

### Tarea 16: El Informe anual en la web

**Ficheros:**
- Modificar: `desamparados-web/src/features/cms/datos/InformeAnualPage.tsx`, su prueba en `features/cms/datos/__tests__/` (buscar `InformeAnualPage.test.tsx`)

(Datos e informes no necesita cambios: sus pestañas salen de `data.areas`, que el servidor ya filtra desde la Tarea 6.)

- [ ] **Paso 1: prueba que falla**

En la prueba de `InformeAnualPage`, con `modulos: ['informe-anual']`: en la navegación «Capítulos del Informe anual» no están «Cultos y actos», «Sábado de Pasión y Rosario» ni «Patrimonio», y los que quedan van seguidos: Presentación «I», El año de un vistazo «II», Hermanos «III», Cuentas «IV», Comunicación «V». Con todo encendido, como hasta ahora (Hermanos «IV»).

- [ ] **Paso 2: los capítulos con módulo y renumerados**

```tsx
interface Capitulo { numero: string; titulo: string; clave: ClaveCapitulo; modulo: Modulo }

const CAPITULOS: Capitulo[] = [
  { numero: '', titulo: 'Portada', clave: 'portada', modulo: 'nucleo' },
  { numero: 'I', titulo: 'Presentación del Hermano Mayor', clave: 'presentacion', modulo: 'nucleo' },
  { numero: 'II', titulo: 'El año de un vistazo', clave: 'datos', modulo: 'nucleo' },
  { numero: 'III', titulo: 'Cultos y actos', clave: 'datos', modulo: 'agenda' },
  { numero: 'IV', titulo: 'Hermanos', clave: 'datos', modulo: 'nucleo' },
  { numero: 'V', titulo: 'Sábado de Pasión y Rosario', clave: 'datos', modulo: 'procesion' },
  { numero: 'VI', titulo: 'Cuentas', clave: 'datos', modulo: 'nucleo' },
  { numero: 'VII', titulo: 'Patrimonio', clave: 'patrimonio', modulo: 'inventario' },
  { numero: 'VIII', titulo: 'Comunicación', clave: 'datos', modulo: 'nucleo' },
  { numero: '—', titulo: 'Epílogo del Secretario', clave: 'epilogo', modulo: 'nucleo' },
]

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

/** Los capítulos con estos módulos, renumerados como los numera el PDF (sin huecos). */
export function capitulosVisibles(activos: ReadonlySet<string>): Capitulo[] {
  let n = 0
  return CAPITULOS.filter((c) => cumple(c.modulo, activos)).map((c) => (c.numero && c.numero !== '—' ? { ...c, numero: ROMANOS[n++] } : c))
}
```
y en el componente, `const { activos } = useModulos()` y `capitulosVisibles(activos ?? new Set()).map(…)` donde hoy está `CAPITULOS.map(…)`. Si `elegido` es `patrimonio` y el Inventario está apagado, caer en `presentacion`.

- [ ] **Paso 3: ejecutar las pruebas**

```bash
cd desamparados-web && npx tsc -b && npm run lint && npx vitest run --testTimeout=20000 src/features/cms/datos
```

- [ ] **Paso 4: commit**

```bash
git add desamparados-web/src/features/cms/datos
git commit -m "Informe anual: los capítulos de módulos apagados no salen, y se renumeran como en el PDF"
```

---
## Fase D: la guardiana y el cierre

### Tarea 17: La guardiana de cobertura

**Ficheros:**
- Crear: `backend-desamparados/test/modulos-cobertura.test.ts`

**Qué fija:** que toda pieza que se monta o se enlaza diga de qué módulo es. Lee los ficheros como texto (como `sin-corporacion-escrita.test.ts`): la web no se puede importar desde `node:test`.

- [ ] **Paso 1: la prueba**

```ts
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
    leer('desamparados-web/src/routes/index.tsx').forEach((linea, i) => {
      // Una ruta en una línea: `{ path: '…', element: … }` o `{ index: true, element: … }`.
      if (!/\b(path:\s*'[^']*'|index:\s*true)\b/.test(linea) || !/\belement:/.test(linea)) return;
      if (/<Navigate\b|<DireccionAntigua\b/.test(linea)) return;
      const pagina = /\bpagina\(\w+,\s*('[a-z0-9-]+'|\[[^\]]*\])\)/.exec(linea);
      if (!pagina) { fallos.push(`routes/index.tsx:${i + 1}: sin pagina(…, modulo) → ${linea.trim()}`); return; }
      for (const c of clavesDe(pagina[1])) if (!esModulo(c)) fallos.push(`routes/index.tsx:${i + 1}: «${c}» no es del catálogo`);
    });
    assert.deepEqual(fallos, [], fallos.join('\n'));
    // Y que de verdad hay rutas: si el fichero cambia de forma, esto avisa en vez de pasar en vacío.
    assert.ok(leer('desamparados-web/src/routes/index.tsx').filter((l) => /\bpagina\(/.test(l)).length > 60);
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
```

- [ ] **Paso 2: ejecutarla**

```bash
cd backend-desamparados && npx tsx --test test/modulos-cobertura.test.ts
```
Esperado: en verde si las Tareas 4, 7, 8, 10, 11 y 12 dejaron todo etiquetado. Si lista algo, es una pieza olvidada: etiquetarla (no aflojar la guardiana). Si `catalogo.tipos` no se tipa como `string[]` en el import JSON, castear `(catalogo.tipos as string[])`.

- [ ] **Paso 3: commit**

```bash
git add backend-desamparados/test/modulos-cobertura.test.ts
git commit -m "Módulos: la guardiana que exige la etiqueta en rutas, menús y bloques"
```

---

### Tarea 18: De punta a punta, con la app arrancada

**Ficheros:** ninguno nuevo (si algo falla, se arregla donde esté, con su prueba).

- [ ] **Paso 1: las suites enteras**

```bash
cd backend-desamparados && npm run comprobar-tipos && npm test
cd ../desamparados-web && npx tsc -b && npm run lint && npx vitest run --testTimeout=20000 && npm run sitemap && git diff --exit-code public/sitemap.xml
```
Esperado: todo en verde y sin omisiones por falta de MariaDB.

- [ ] **Paso 2: arrancar y recorrer**

Comprobar qué escucha en el 3001 (`docs/notas-del-proyecto.md` §5) y arrancar backend y web. Entrar al CMS como ADMIN y en Sistema → Módulos:

1. Apagar **Lotería**: el menú pierde «Lotería»; `/cms/loteria` dice «Este módulo no está activado» con el enlace a Módulos; `GET /api/loteria` responde 404 `MODULO_NO_ACTIVADO`. Encenderla: vuelve todo y los sorteos siguen ahí.
2. Apagar **Tienda**: el diálogo enseña «N productos, N ventas de caja» y, si **Tienda en la web** está encendida, el servidor lo impide y la pantalla dice que la necesita «Tienda en la web». Apagar primero Tienda en la web: en la web pública desaparece «Tienda» de la barra y del pie y `/tienda` es «Página no encontrada».
3. Apagar **Procesión** (antes, la Puerta del templo, que la requiere; el servidor lo recuerda si se olvida): en el CMS desaparecen Procesión, Salidas, Mesa, Puerta; Inventario pierde la pestaña Ropero; la ficha del censo no enseña papeleta ni ropero; en el Inicio no está «Papeletas»; en el área de hermanos no está «Procesión» ni «Vida cofrade». Apagar **Inventario** dejando Procesión: la entrada se llama «Ropero» y la pantalla es solo el ropero.
4. Apagar **Área de hermanos**: el botón «Acceso hermanos» desaparece; `/acceso` enseña el aviso con el enlace al CMS; `/area-hermano/perfil` es «no encontrado».
5. Encender **Tienda en la web** con Tienda apagada: el diálogo propone encender también «Tienda» y las enciende las dos.
6. Mirar la Auditoría: `MODULO_ENCENDER` y `MODULO_APAGAR` con cada cambio.
7. Dejar todo encendido.

Si algo de esto no cuadra, es un fallo: arreglarlo con su prueba antes de seguir (es lo que dice la memoria del proyecto sobre verificar de punta a punta).

- [ ] **Paso 3: commit de lo que haya hecho falta arreglar**

```bash
git add <lo tocado>
git commit -m "Módulos: lo que destapó recorrer la app con módulos apagados"
```

---

### Tarea 19: Documentación y hoja de ruta

**Ficheros:**
- Modificar: `docs/hoja-de-ruta.md`, `docs/notas-del-proyecto.md`, `docs/despliegue.md`, `.claude/skills/backend/SKILL.md`, `.claude/skills/frontend/SKILL.md`, `.claude/skills/cms/SKILL.md`

- [ ] **Paso 1: la hoja de ruta**

La fila «Módulos del CMS activables por instalación» pasa a ✅ con el commit, y su texto dice: catálogo en `shared/modulos.json`, pantalla Sistema → Módulos (ADMIN), guarda `conModulo` en la API, `pagina(…, modulo)` en la web, guardiana `modulos-cobertura.test.ts`; migración `20261031200000_modulos_activables`.

- [ ] **Paso 2: las notas del proyecto**

Añadir una sección «12. Los módulos activables» con las trampas que no se ven en el código:

- Todo router de `app.ts`, toda entrada de los tres menús, toda ruta de `routes/index.tsx` y todo tipo de bloque **llevan etiqueta de módulo** (`conModulo(...)`/`nucleo`, `modulo:`, `pagina(X, modulo)`): la guardiana `test/modulos-cobertura.test.ts` lee esos ficheros como texto y exige una entrada por línea. Una ruta nueva sin decidirlo no pasa el CI.
- Las claves van escritas en `domain/modulos.ts` de cada paquete además de en el JSON (para que compilen); si se añade un módulo, son tres sitios y dos pruebas lo dicen.
- El estado vive en memoria en el backend: en las pruebas, apagar un módulo escribiendo en la tabla exige `ModulosService.cargar()` después, y dejarlo encendido en `after`.
- En las pruebas de la web, `renderWithProviders` siembra todos los módulos encendidos; una pantalla que pida `/api/modulos` por su cuenta no lo hace nunca gracias a eso. Para probar con módulos apagados, `modulos: [...]`.
- El ropero está en `/api/ropero` (Procesión), no en `/api/inventario`.
- El aviso del banco no se apaga nunca.

- [ ] **Paso 3: despliegue y skills**

`docs/despliegue.md`, en «Despliegues posteriores»: `npx prisma migrate deploy` (la tabla `Modulo`) y `npx prisma db seed` (crea las filas con todo encendido; no toca nada más que lo que falte), y que una instalación nueva ajusta `modulos.activos` en `shared/datos-entidad.json` antes de sembrar.

`.claude/skills/backend/SKILL.md` (en «Rutas y permisos»): «Todo router se monta en `app.ts` con `conModulo('…')` o `nucleo`; los enganches opcionales entre módulos, con `siModulo`». `.claude/skills/frontend/SKILL.md` (en «Estructura»): «`routes/index.tsx`: todas las rutas con `pagina(Componente, modulo)`; menús con `modulo:`; `useModulos()` para condicionar trozos». `.claude/skills/cms/SKILL.md` (en «Añadir un tipo de bloque»): el paso de `tipos-de-bloque.json` incluye su entrada en `modulo`.

- [ ] **Paso 4: commit y subida**

```bash
git add docs/hoja-de-ruta.md docs/notas-del-proyecto.md docs/despliegue.md .claude/skills
git commit -m "Hoja de ruta: módulos del CMS activables, hechos"
```
Subir solo si el usuario lo pide (skill `git`). Si lo pide, abrir el PR de `modulos-del-cms` contra `main` con el resumen de las decisiones de la cabecera de este plan.

---

## Autorrevisión del plan (hecha al escribirlo)

- **Cobertura del spec:** §2.1 catálogo → T1; §2.2 estado y siembra → T2; §2.3 lectura en los dos lados → T2, T3, T7; §3.1 API y partición de rutas → T4; §3.2 enganches → T6 (Procesión→Agenda no hace falta: es dependencia dura); §3.3 CMS (menú, página «no activado», pantallas mezcladas, Datos) → T7, T8, T13-T16, T6; §3.4 web pública (menús, rutas, bloques) → T7, T10, T12; §3.5 área de hermanos → T5, T11; §3.6 dependencias → T1-T3, T9; §4 pantalla → T9; §5 pruebas → cada tarea y T17-T18; §1.5 código muerto → T13.
- **Desviaciones del spec**, declaradas en la cabecera: itinerario y programa como núcleo; avisos de la Junta sin filtrar; `Cortejo.tsx` borrado; el área apagada rechaza a todos; URL del ropero; remesas y Modelo 182 sin cambiar de URL; el aviso del banco siempre abierto; `reactivacion` en el núcleo.
- **Nombres cruzados entre tareas:** `ModulosService.{sembrar,cargar,activos,activo,olvidar,cambiar,listarCms}`, `siModulo`, `conModulo`, `nucleo` (T2-T6, T17); `CLAVES_MODULO`, `cumple`, `Requisito`, `fichaDeModulo` (T7-T16); `useModulos().{activos,activo}` (T8-T16); `renderWithProviders(ui, { modulos })` (T7-T16); `pagina(X, modulo)` (T7, T8, T17); `menuCmsVisible`, `menuVisible`, `entradasDelArea` (T8, T10, T11, T17); `moduloDeTipo`, `moduloDeBloque`, `fuentesVisibles` (T12); `areasActivas`, `MODULO_DE_AREA` (T6).
