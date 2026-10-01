# El género de la corporación: plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usar superpowers:subagent-driven-development (recomendada) o superpowers:executing-plans para ejecutar este plan tarea a tarea. Los pasos llevan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** que ninguna frase de la aplicación lleve escrito «el Grupo Parroquial», «del Grupo» o «del ${nombre de la salida}»: que salgan del artículo de la corporación y del de cada salida.

**Arquitectura:**
- `identidad` gana `articulo` y `tipoCorto`; `Salida` gana `articulo`.
- Unas funciones puras (`domain/articulos.ts`, una copia en el backend y otra en la web) construyen «del», «al» y «nuestro». Las dos copias se prueban contra la misma tabla `shared/casos-articulos.json`.
- Las plantillas de correo ganan campos comunes para la corporación y para la salida.
- Una prueba guardiana impide que vuelvan a escribirse a mano.

**Stack:** Express 5 + TypeScript + Prisma 7 + MariaDB + arktype; React 19 + MUI 9; `node:test` y Vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-genero-de-la-corporacion-design.md` (leerlo antes de empezar).

## Restricciones globales

- Todo en español: código, comentarios (explican **por qué**), commits y textos.
- Artículos válidos: `'el' | 'la' | 'los' | 'las'`. Solo dos contracciones: de + el = «del», a + el = «al».
- Desamparados: `articulo: "el"`, `tipo: "Grupo Parroquial"`, `tipoCorto: "Grupo"`. Las dos salidas de siempre: `articulo: "el"`.
- Migración de este PC: prefijo `…200000_`; la de este plan, `20261030200000_articulo_de_las_salidas`. Se aplica con `npx prisma migrate deploy` (la skill `database` prohíbe `migrate dev`) y después `npx prisma generate`.
- El contenido de la web pública (`shared/contenido-por-defecto.json`) **no** se toca.
- Comprobar tipos: backend `npm run comprobar-tipos`; web `npx tsc -b`. Pruebas: backend `npm test` (MariaDB en el contenedor `desamparados-mariadb`; una prueba con BD omitida no vale); web `npx vitest run --testTimeout=20000`. Fallo conocido y ajeno: `contenido-api.test.ts:65`.
- `rtk` no funciona en este PC: usar `git` y `npm` directamente. Commits con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Mapa de ficheros

| Fichero | Qué hace |
|---|---|
| `shared/casos-articulos.json` (nuevo) | Tabla de casos que comparten las pruebas del backend y de la web |
| `shared/datos-entidad.json` | `identidad.articulo` y `identidad.tipoCorto` |
| `backend-desamparados/src/domain/articulos.ts` (nuevo) | Funciones y atajos sobre la identidad |
| `desamparados-web/src/domain/articulos.ts` (nuevo) | La misma copia para la web |
| `backend-desamparados/src/domain/datos-entidad.ts` | Tipo `Identidad` con los dos campos |
| `prisma/schema.prisma` y la migración | `Salida.articulo` |
| `shared/usos-de-correo.json`, `domain/plantillas-correo.ts`, `services/correos/componer.ts`, `services/plantillas-correo.service.ts` | Campos comunes de la corporación y campos de la salida |
| `backend-desamparados/test/sin-corporacion-escrita.test.ts` (nuevo) | La guardiana |

---

### Tarea 1: Funciones de artículos e identidad

**Ficheros:**
- Crear: `shared/casos-articulos.json`, `backend-desamparados/src/domain/articulos.ts`, `backend-desamparados/test/articulos.test.ts`, `desamparados-web/src/domain/articulos.ts`, `desamparados-web/src/domain/__tests__/articulos.test.ts`
- Modificar: `shared/datos-entidad.json` (bloque `identidad` y su `_comentario`), `backend-desamparados/src/domain/datos-entidad.ts` (interfaz `Identidad`)

**Interfaces que produce (iguales en los dos paquetes):**

```ts
export type Articulo = 'el' | 'la' | 'los' | 'las';
export const ARTICULOS: readonly Articulo[];
export function conArticulo(art: Articulo, nombre: string): string;
export function deArticulo(art: Articulo, nombre: string): string;
export function aArticulo(art: Articulo, nombre: string): string;
export function nuestro(art: Articulo): string;
export function mayuscula(texto: string): string;
interface OpcionesCorporacion { corto?: boolean; identidad?: { articulo: Articulo; tipo: string; tipoCorto: string } }
export function laCorporacion(o?: OpcionesCorporacion): string;      // «el Grupo Parroquial» / con corto «el Grupo»
export function deLaCorporacion(o?: OpcionesCorporacion): string;    // «del Grupo Parroquial»
export function aLaCorporacion(o?: OpcionesCorporacion): string;     // «al Grupo Parroquial»
export function nuestraCorporacion(o?: OpcionesCorporacion): string; // «nuestro Grupo Parroquial»
```

- [ ] **Paso 1: la tabla de casos**

```json
{
  "_comentario": "Casos que comprueban las dos copias de domain/articulos.ts (backend y web): son dos paquetes sin código compartido, y esta tabla es lo que impide que se separen.",
  "con":  [["el", "Grupo Parroquial", "el Grupo Parroquial"], ["la", "Hermandad", "la Hermandad"], ["los", "Santos Oficios", "los Santos Oficios"], ["las", "Cofradías Fusionadas", "las Cofradías Fusionadas"]],
  "de":   [["el", "Grupo Parroquial", "del Grupo Parroquial"], ["la", "Hermandad", "de la Hermandad"], ["los", "Santos Oficios", "de los Santos Oficios"], ["las", "Cofradías Fusionadas", "de las Cofradías Fusionadas"]],
  "a":    [["el", "Grupo Parroquial", "al Grupo Parroquial"], ["la", "Hermandad", "a la Hermandad"], ["los", "Santos Oficios", "a los Santos Oficios"], ["las", "Cofradías Fusionadas", "a las Cofradías Fusionadas"]],
  "nuestro": [["el", "nuestro"], ["la", "nuestra"], ["los", "nuestros"], ["las", "nuestras"]],
  "mayuscula": [["del Grupo", "Del Grupo"], ["él", "Él"], ["", ""]]
}
```

- [ ] **Paso 2: pruebas que fallan (backend)**

```ts
// backend-desamparados/test/articulos.test.ts
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  aArticulo, aLaCorporacion, conArticulo, deArticulo, deLaCorporacion, laCorporacion, mayuscula, nuestraCorporacion, nuestro, type Articulo,
} from '../src/domain/articulos.js';

const casos = JSON.parse(readFileSync(fileURLToPath(new URL('../../shared/casos-articulos.json', import.meta.url)), 'utf8'));

describe('artículos', () => {
  test('con, de y a, con sus contracciones', () => {
    for (const [art, nombre, esperado] of casos.con) assert.equal(conArticulo(art as Articulo, nombre), esperado);
    for (const [art, nombre, esperado] of casos.de) assert.equal(deArticulo(art as Articulo, nombre), esperado);
    for (const [art, nombre, esperado] of casos.a) assert.equal(aArticulo(art as Articulo, nombre), esperado);
  });
  test('el posesivo concuerda con el artículo', () => {
    for (const [art, esperado] of casos.nuestro) assert.equal(nuestro(art as Articulo), esperado);
  });
  test('la mayúscula de comienzo de frase', () => {
    for (const [texto, esperado] of casos.mayuscula) assert.equal(mayuscula(texto), esperado);
  });
});

describe('la corporación', () => {
  const hermandad = { articulo: 'la' as const, tipo: 'Hermandad', tipoCorto: 'Hermandad' };
  test('la de esta instalación', () => {
    assert.equal(laCorporacion(), 'el Grupo Parroquial');
    assert.equal(deLaCorporacion(), 'del Grupo Parroquial');
    assert.equal(deLaCorporacion({ corto: true }), 'del Grupo');
    assert.equal(aLaCorporacion(), 'al Grupo Parroquial');
    assert.equal(nuestraCorporacion(), 'nuestro Grupo Parroquial');
  });
  test('otra instalación', () => {
    assert.equal(deLaCorporacion({ identidad: hermandad }), 'de la Hermandad');
    assert.equal(nuestraCorporacion({ identidad: hermandad }), 'nuestra Hermandad');
    assert.equal(mayuscula(laCorporacion({ identidad: hermandad })), 'La Hermandad');
  });
});
```

Ejecutar `npx tsx --test test/articulos.test.ts`. Esperado: FALLA porque no encuentra el módulo.

- [ ] **Paso 3: implementar (backend)**

```ts
// backend-desamparados/src/domain/articulos.ts
import { identidad as deEstaInstalacion } from './datos-entidad.js';

/**
 * El artículo de la corporación o de una salida, y las frases que salen de él.
 * Se guarda el artículo y no el género porque hay corporaciones y salidas en
 * plural (las Cofradías Fusionadas, los Santos Oficios). En castellano solo se
 * contraen «de el» y «a el»: con eso basta para no escribir nunca «del Grupo»
 * a mano. La misma copia vive en desamparados-web/src/domain/articulos.ts.
 */
export type Articulo = 'el' | 'la' | 'los' | 'las';
export const ARTICULOS: readonly Articulo[] = ['el', 'la', 'los', 'las'];

export const conArticulo = (art: Articulo, nombre: string) => `${art} ${nombre}`;
export const deArticulo = (art: Articulo, nombre: string) => (art === 'el' ? `del ${nombre}` : `de ${art} ${nombre}`);
export const aArticulo = (art: Articulo, nombre: string) => (art === 'el' ? `al ${nombre}` : `a ${art} ${nombre}`);
export const nuestro = (art: Articulo) => ({ el: 'nuestro', la: 'nuestra', los: 'nuestros', las: 'nuestras' })[art];
export const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

interface OpcionesCorporacion {
  /** «el Grupo» en vez de «el Grupo Parroquial», dentro de un texto ya situado. */
  corto?: boolean;
  /** Otra instalación: para las pruebas. */
  identidad?: { articulo: Articulo; tipo: string; tipoCorto: string };
}

const partes = ({ corto = false, identidad = deEstaInstalacion }: OpcionesCorporacion = {}) =>
  [identidad.articulo, corto ? identidad.tipoCorto : identidad.tipo] as const;

export const laCorporacion = (o?: OpcionesCorporacion) => conArticulo(...partes(o));
export const deLaCorporacion = (o?: OpcionesCorporacion) => deArticulo(...partes(o));
export const aLaCorporacion = (o?: OpcionesCorporacion) => aArticulo(...partes(o));
export const nuestraCorporacion = (o?: OpcionesCorporacion) => {
  const [art, nombre] = partes(o);
  return `${nuestro(art)} ${nombre}`;
};
```

En `datos-entidad.ts`, `Identidad` gana `articulo: Articulo` y `tipoCorto: string`, con el comentario de para qué sirve cada uno. `identidad` se lee del JSON con `as Identidad` si arktype o TS no estrechan el literal. En `shared/datos-entidad.json`, añadir `"articulo": "el"` y `"tipoCorto": "Grupo"`, y ampliar el `_comentario` del bloque.

Cuidado con el import circular: si `datos-entidad.ts` importara `Articulo` desde `articulos.ts` y este a su vez la identidad, mover `type Articulo` a `datos-entidad.ts` y reexportarlo desde `articulos.ts`.

- [ ] **Paso 4: la copia de la web**, igual, en `desamparados-web/src/domain/articulos.ts`. La identidad sale de `shared/datos-entidad.json`, como hace `config/site.ts`. Prueba Vitest en `desamparados-web/src/domain/__tests__/articulos.test.ts`, contra la misma tabla (import del JSON) y con los mismos casos de la corporación.

- [ ] **Paso 5: ejecutar.** Backend `npx tsx --test test/articulos.test.ts` y `npm run comprobar-tipos`; web `npx vitest run src/domain --testTimeout=20000` y `npx tsc -b`. Todo PASA.

- [ ] **Paso 6: commit** «Género de la corporación: artículo en la identidad y funciones que lo conjugan».

---

### Tarea 2: El artículo de cada salida

**Ficheros:**
- Modificar: `backend-desamparados/prisma/schema.prisma` (`Salida.articulo String @default("el") @db.VarChar(3)`)
- Crear: la migración `backend-desamparados/prisma/migrations/20261030200000_articulo_de_las_salidas/migration.sql`
- Modificar: `backend-desamparados/prisma/seed-salidas.ts`; `src/schemas/salidas.schema.ts` (`articulo: "'el' | 'la' | 'los' | 'las'"` en `datosSalida`); `src/dtos/procesion.dto.ts` (`SalidaWeb.articulo`); `src/services/procesion/salidas.service.ts` (`paraLaWeb`, `normalizar`)
- Modificar: `desamparados-web/src/lib/api/salidas.ts` (`articulo: Articulo` en `Salida` y `DatosSalida`); `src/features/cms/salidas/SalidaEditPage.tsx` (sección Datos: desplegable «Artículo» y vista previa); `VentanaNuevaSalida.tsx` (el mismo desplegable, con «el» por defecto)
- Pruebas: `backend-desamparados/test/salidas-api-db.test.ts`, `desamparados-web/src/features/cms/__tests__/SalidasAdminPage.test.tsx`

**Interfaces:** consume `Articulo`, `ARTICULOS` y `deArticulo` de la tarea 1; produce `Salida.articulo` en la API y en la web.

- [ ] **Paso 1: prueba que falla.** En `salidas-api-db.test.ts`: crear una salida con `articulo: 'la'` la devuelve con `articulo: 'la'`; un `articulo: 'lo'` da 400; editar solo el artículo funciona. En la prueba de la web: la ventana manda `articulo: 'el'` por defecto, y la vista previa de la ficha dice «Papeleta de la Procesión Magna» con `articulo: 'la'` y `nombre: 'Procesión Magna'`.
- [ ] **Paso 2: migración.**

```sql
-- El artículo de cada salida («el Sábado de Pasión», «la Procesión Magna»,
-- «los Santos Oficios»): con él se escribe «del», «de la» o «de los» en los
-- correos y las pantallas. Las de siempre son masculinas.
ALTER TABLE `Salida` ADD COLUMN `articulo` VARCHAR(3) NOT NULL DEFAULT 'el';
```

Aplicar con `npx prisma migrate deploy` y luego `npx prisma generate`.

- [ ] **Paso 3: implementar** el esquema, el DTO, `paraLaWeb`, la siembra (`articulo: 'el'` en las dos), el tipo de la web, el desplegable (`TextField select` con las cuatro opciones; en la ficha, la ayuda «Para escribir "del Sábado de Pasión" o "de la Procesión Magna"») y la vista previa `Papeleta ${deArticulo(articulo, nombre)}`.
- [ ] **Paso 4: ejecutar** las dos pruebas y los tipos de los dos lados. PASAN.
- [ ] **Paso 5: commit** «Salidas: el artículo de cada una, para escribir "del" o "de la"».

---

### Tarea 3: Plantillas de correo

**Ficheros:**
- Modificar: `shared/usos-de-correo.json`, `backend-desamparados/src/services/correos/componer.ts` (`comunes()`), `backend-desamparados/src/services/plantillas-correo.service.ts` (`cuerpoParaElEditor`), `backend-desamparados/src/services/email.service.ts` (las llamadas de `papeleta`, `apertura` y `papeleta_sin_recoger`)
- Pruebas: `backend-desamparados/test/plantillas-correo.test.ts` (o el que pruebe `componer`)

**Interfaces:** consume `laCorporacion`, `deLaCorporacion`, `aLaCorporacion`, `nuestraCorporacion`, `deArticulo` y `conArticulo` (tarea 1) y `salida.articulo` (tarea 2).

- [ ] **Paso 1: prueba que falla.** Una plantilla con «Bienvenido {{a_la_corporacion}}. Gracias por confiar en {{nuestra_corporacion}}; los datos {{de_la_corporacion_corto}}.» compone «Bienvenido al Grupo Parroquial. Gracias por confiar en nuestro Grupo Parroquial; los datos del Grupo.». El correo de la papeleta de una salida con `articulo: 'la'` y nombre «Procesión Magna» lleva «Papeleta de la Procesión Magna» en el asunto.
- [ ] **Paso 2: campos comunes.** En `shared/usos-de-correo.json`, `comunes` añade, con su `ayuda` y su `ejemplo`:
  - `la_corporacion`: «el Grupo Parroquial»;
  - `de_la_corporacion`: «del Grupo Parroquial»;
  - `a_la_corporacion`: «al Grupo Parroquial»;
  - `nuestra_corporacion`: «nuestro Grupo Parroquial»;
  - `la_corporacion_corto`: «el Grupo»;
  - `de_la_corporacion_corto`: «del Grupo».

  `comunes()` de `componer.ts` y `cuerpoParaElEditor` los rellenan con las funciones de la tarea 1. La expresión regular de `cuerpoParaElEditor` deja de listar los campos a mano: recorre todos los comunes.
- [ ] **Paso 3: campos de la salida.** En `papeleta`, `apertura` y `papeleta_sin_recoger`, añadir `de_la_salida` («del Sábado de Pasión») y `la_salida` («el Sábado de Pasión»). `email.service.ts` los rellena con `deArticulo(salida.articulo, salida.nombre)` y `conArticulo(...)`; la firma de la salida que reciben esas funciones gana `articulo`, y quien las llama lo pasa.
- [ ] **Paso 4: los textos originales.** Recorrer `shared/usos-de-correo.json`:
  - toda mención escrita de la corporación («Grupo Parroquial», «el Grupo», «del Grupo», «nuestro Grupo Parroquial»…) pasa al campo correspondiente;
  - toda frase «del {{salida}}», «al {{salida}}» o «en el {{salida}}» pasa a `{{de_la_salida}}` y sus hermanos;
  - las `ayuda` del JSON que dicen «el nombre del Grupo» pasan a «el nombre de la corporación»;
  - el `_comentario` del principio explica los campos nuevos.
- [ ] **Paso 5: ejecutar** las pruebas de plantillas y de correos (`plantillas-correo`, `contacto`, `correos-*`), y `npm run comprobar-tipos`. PASAN.
- [ ] **Paso 6: commit** «Correos: la corporación y la salida con su artículo en las plantillas».

---

### Tarea 4: Barrido del backend

**Ficheros:** los de `backend-desamparados/src` que nombran la corporación. Lista de partida (frases fuera de comentarios):
- `services/modelo-182.service.ts` (4), `services/correos/plantilla.ts` (4), `services/informes/informes.ts` (3), `services/comunicados.service.ts` (2), `domain/entradillas.ts` (2);
- uno cada uno: `services/tienda.service.ts`, `services/remesa.service.ts`, `services/email.service.ts`, `index.ts`, `dtos/email.dto.ts`, `domain/password-debil.ts`, `controllers/hermano.controller.ts`.

Sirve de lista de comprobación: `grep -rnP "Grupo Parroquial|\b(el|del|al|nuestro|El)\s+Grupo\b" backend-desamparados/src`. Las frases con la salida, con `grep -rnP "(del|al|en el) \\$\{[^}]*nombre" backend-desamparados/src`.

- Crear: `backend-desamparados/test/otra-corporacion.test.ts`

**Interfaces:** consume las funciones de la tarea 1 y `salida.articulo` de la tarea 2.

- [ ] **Paso 1: la instalación de mentira (falla).** `otra-corporacion.test.ts` compone, con una identidad «la Hermandad» pasada por parámetro (añadir el parámetro opcional `identidad` donde haga falta, con la de la instalación por defecto, igual que en la tarea 1):
  - el pie de los correos (`correos/plantilla.ts`, «Recibe este correo por su relación con…»);
  - el correo de alta aprobada y el de pésame (`email.service.ts`, si sus textos no salen ya de plantillas);
  - la portada del informe anual (`informes.ts`).

  Comprueba que dicen «de la Hermandad» / «la Hermandad» / «nuestra Hermandad» y que **no** contienen «Grupo». Si alguno de esos textos se monta en un sitio al que no se puede pasar la identidad sin desmontarlo, prueba al menos la función que lo escribe, y apúntalo en el informe.
- [ ] **Paso 2: barrer**, según la tabla del spec:
  - «el Grupo Parroquial» pasa a `laCorporacion()`, y a `mayuscula(...)` al empezar frase;
  - «del Grupo Parroquial» pasa a `deLaCorporacion()`;
  - la forma corta («del Grupo» en «Datos del Grupo», «el NIF del Grupo») pasa a `{ corto: true }`;
  - «Grupo Parroquial» suelto pasa a `identidad.tipo`;
  - «Grupo» suelto en un rótulo pasa a `identidad.tipoCorto`;
  - las frases con la salida pasan a `deArticulo(salida.articulo, salida.nombre)`.

  Los comentarios no se tocan salvo que mientan.
- [ ] **Paso 3: ejecutar** `otra-corporacion.test.ts`, las pruebas de los ficheros tocados, `npm run comprobar-tipos` y `npm test` completo. PASAN (salvo el conocido).
- [ ] **Paso 4: commit** «Género de la corporación: el backend escribe con su artículo».

---

### Tarea 5: Barrido de la web

**Ficheros:** los de `desamparados-web/src` que nombran la corporación. Lista de partida:
- `features/cms/tesoreria/Modelo182.tsx` (8), `features/legal/AvisoLegalPage.tsx` (5), `features/legal/PoliticaDePrivacidadPage.tsx` (4), `features/altas/public/HazteHermanoPage.tsx` (4);
- uno cada uno en: `TiendaPage`, `PublicacionesDestacadas`, `EscenaProcesion`, `HistoriaPage`, `cms/tienda/Caja`, `cms/tesoreria/Remesas`, `cms/salidas/SalidasAdminPage`, `cms/puerta/PuertaTemploPage`, `cms/inventario/TarjetaCingulos`, `cms/inicio/ComoVaElAnio`, `cms/difuntos/VistaDifuntos`, `cms/bloques/formularios/nuevos`, `cms/ProcesionAdminPage`, `cms/PortadaAdminPage`, `cms/InventarioAdminPage`, `cms/HermanoEditPage`, `cms/ComunicadosAdminPage`, `boletin/BajaBoletinPage`, `areaHermano/recibos/CertificadosDonativos`, `areaHermano/procesion/ProcesionPage`, `areaHermano/perfil/apartados`, `areaHermano/perfil/PerfilPage`, `areaHermano/familia/FamiliaPage`, `altas/auth/AccesoCmsPage`, `actualidad/agenda/AgendaDeCultos`, `config/site.ts`, `components/bloques/BloqueContacto`, `components/barra/CajonMovil` y `components/PieDePagina`.

Sirve de lista de comprobación: `grep -rnP "Grupo Parroquial|\b(el|del|al|nuestro|El)\s+Grupo\b" desamparados-web/src --include=*.tsx --include=*.ts`. Las frases con la salida, con `grep -rnP "(del|al|en el) \{[^}]*\.nombre\}" desamparados-web/src`. De partida: `ProcesionPage.tsx:392,467`, `ComunicadoEditPage.tsx:213` y `MesaProcesionPage.tsx:239`.

**Interfaces:** consume la copia web de la tarea 1 y `Salida.articulo` de la tarea 2.

- [ ] **Paso 1: prueba que falla.** En una prueba existente de la web que pinte una de estas frases (por ejemplo `ProcesionPage` del área, o `Modelo182`), simular una salida con `articulo: 'la'` y comprobar «La solicitud de papeletas de la Procesión Magna…». Para la corporación, mira si `config/site.ts` puede exponer las frases (`site.deLaCorporacion`); si no, que una prueba de componente simule `shared/datos-entidad.json` con `vi.mock` y una «Hermandad», y compruebe que la página legal o el pie dicen «de la Hermandad».
- [ ] **Paso 2: barrer** con la misma tabla que el backend. Ojo con las páginas legales (aviso legal y privacidad): hablan de la corporación como responsable del tratamiento, así que tienen que salir bien con cualquier artículo.
- [ ] **Paso 3: ejecutar** `npx tsc -b` y `npx vitest run --testTimeout=20000` completo. PASAN.
- [ ] **Paso 4: commit** «Género de la corporación: la web escribe con su artículo».

---

### Tarea 6: La guardiana

**Ficheros:**
- Crear: `backend-desamparados/test/sin-corporacion-escrita.test.ts`

- [ ] **Paso 1: escribirla.**

```ts
// backend-desamparados/test/sin-corporacion-escrita.test.ts
//
// Que nadie vuelva a escribir la corporación a mano: «del Grupo Parroquial»
// solo vale para un Grupo Parroquial, y la aplicación se instala también
// para Hermandades y Cofradías. Las frases salen de domain/articulos.ts y de
// los campos {{la_corporacion}}… de las plantillas. Recorre el código de los
// dos paquetes (sin pruebas ni comentarios) y los textos de las plantillas.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const CORPORACION = /Grupo Parroquial|\b(?:el|del|al|nuestro|El|Del|Al|Nuestro)\s+Grupo\b/;
const SALIDA_EN_CODIGO = /\b(?:del|al|en el)\s+(?:\$\{|\{)[^}]*\bnombre\b[^}]*\}/;
const SALIDA_EN_PLANTILLA = /\b(?:del|al|en el)\s+\{\{\s*salida\s*\}\}/;

/** Lo que sí puede llevarlo escrito, con su porqué. Fichero relativo a la raíz y un trozo de la línea. */
const EXCEPCIONES: { fichero: string; contiene: string; motivo: string }[] = [
  // { fichero: 'desamparados-web/src/…', contiene: '…', motivo: '…' },
];

function ficheros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return n === '__tests__' || n === 'node_modules' ? [] : ficheros(ruta);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [ruta] : [];
  });
}

/** Quita los comentarios, que pueden nombrar a este Grupo (explican el porqué de su código). */
const sinComentarios = (linea: string) => (/^\s*(\/\/|\*|\/\*)/.test(linea) ? '' : linea.replace(/\s\/\/.*$/, ''));

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
    for (const f of ficheros(join(RAIZ, dir))) mirar(f, readFileSync(f, 'utf8').split('\n'), [CORPORACION, SALIDA_EN_CODIGO]);
  }
  const plantillas = join(RAIZ, 'shared/usos-de-correo.json');
  mirar(plantillas, readFileSync(plantillas, 'utf8').split('\n').filter((l) => !l.includes('"_comentario"')), [CORPORACION, SALIDA_EN_PLANTILLA]);
  assert.deepEqual(hallazgos, [], `Escritas a mano (usa domain/articulos.ts o los campos {{la_corporacion}}…):\n${hallazgos.join('\n')}`);
});
```

- [ ] **Paso 2: ejecutar** `npx tsx --test test/sin-corporacion-escrita.test.ts`. Si da hallazgos:
  - si son de verdad, se arreglan en el código, con la tabla del spec;
  - si están justificados (un texto de ejemplo, un nombre propio que contiene «Grupo»…), van a `EXCEPCIONES` con su motivo;
  - si salen falsos positivos (un `{nombre}` que no es de una salida, como «del {hermano.nombre}»), se afina el patrón para no cazarlos, sin abrir la puerta a los de verdad, y se explica en el comentario.

  Al final, PASA.
- [ ] **Paso 3: comprobar que muerde.** Escribe a mano «del Grupo Parroquial» en un `.tsx` cualquiera: la prueba falla y lo señala. Después deshazlo.
- [ ] **Paso 4: commit** «Género de la corporación: prueba que impide escribirla a mano».

---

### Tarea 7: De punta a punta y hoja de ruta

- [ ] **Paso 1: suites completas** de los dos lados en verde (salvo el conocido).
- [ ] **Paso 2: la app arrancada.**
  - En Emails, la vista previa de «Alta aprobada» y la de «Papeleta» dicen «al Grupo Parroquial» y «del Sábado de Pasión».
  - En Salidas, el desplegable «Artículo» y su vista previa.
  - El pie de la web pública y el aviso legal se leen igual que antes.

  Capturas en el directorio de trabajo del plan (no en el repositorio). Si se cambia `shared/datos-entidad.json` para ver una «Hermandad», **se deja como estaba** y se comprueba con `git diff`.
- [ ] **Paso 3: hoja de ruta.** La fila «Lo propio del Grupo, a configuración» pasa a ✅ si no queda nada más (los «Pendientes menores de las salidas» se conservan, en esa fila o en una nueva). Lo hecho se resume en una frase: artículo y forma corta en la identidad, artículo de cada salida, campos de las plantillas y la guardiana.
- [ ] **Paso 4: commit** «Hoja de ruta: el género de la corporación, hecho».
