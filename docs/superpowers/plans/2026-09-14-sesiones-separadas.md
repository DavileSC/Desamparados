# Sesiones separadas — plan de implementación (fase 2 de 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la misma persona pueda estar dentro del CMS como Tesorero y dentro del área de hermanos como hermano, a la vez, sin que una sesión pise la otra.

**Architecture:** Hoy hay **una** cookie (`desamparados_session`) con un campo `origen` en el JWT, así que el segundo acceso sustituye al primero. Pasamos a **dos** cookies, una por área. El servidor decide cuál mira **por ruta**: `checkRole` —el paso obligado de toda ruta de staff— exige la del CMS; el área de hermanos usa la suya. Y el cierre de sesión deja de ser global: cada área tiene su propia marca de corte en `User`.

**Tech Stack:** Express 5 + cookie-parser, JWT (`jsonwebtoken`), Prisma sobre MySQL/MariaDB, tests con `node:test`. Frontend React 19 + Zustand + React Router, tests con Vitest.

**Spec:** `docs/superpowers/specs/2026-09-14-sesiones-separadas-y-area-del-hermano-design.md` (sección 4)

## Global Constraints

- **Idioma:** código, comentarios, nombres de test y textos de interfaz en **español** con tildes correctas.
- **Comentarios:** explican *por qué*, dejando constancia del fallo que cerró la decisión. Es el estilo del repositorio.
- **Backend — test:** `rtk npm test` en `backend-desamparados/`. **Frontend — test:** `rtk npm test` y `rtk npx tsc -b --noEmit` en `desamparados-web/`.
- **Tests con base de datos:** se omiten con motivo si no hay MariaDB, con el patrón `sondearDb()` de `test/permisos-hermano-mayor.test.ts`. Usuarios desechables con `test/fixtures/usuarios.ts`.
- **Sin avisos de migración:** no hay usuarios en producción. No escribas compatibilidad con la cookie vieja: se borra y punto.
- **Nombres del contrato (no los cambies):**
  - Cookies: `desamparados_cms`, `desamparados_hermano`, y `desamparados_2fa` que sigue igual.
  - Área: el tipo es `'cms' | 'hermanos'` (en plural, como el `contexto` que ya manda el frontend).
- **Regla de oro de seguridad:** el segundo factor solo se pide en `/cms/acceso`. Una cookie de hermanos **nunca** puede abrir una ruta de staff, porque sería saltarse el 2FA. Cada tarea que toque esto lleva su test negativo.
- **Commits:** en español, terminando con:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
  ```
- **Comandos:** prefija con `rtk`, también dentro de cadenas con `&&`.

## Estructura de ficheros

| Fichero | Responsabilidad | Tarea |
|---|---|---|
| `backend-desamparados/prisma/schema.prisma` | *(modificar)* Dos marcas de corte en `User` | 1 |
| `backend-desamparados/src/utils/cookies.ts` | *(modificar)* Dos cookies, una por área | 2 |
| `backend-desamparados/src/middleware/session.ts` | *(modificar)* Resuelve las dos y las deja en `req.sesiones` | 3, 4 |
| `backend-desamparados/src/middleware/checkRole.ts` | *(modificar)* Exige la del CMS y fija `req.user` | 5 |
| `backend-desamparados/src/controllers/auth.controller.ts` | *(modificar)* Login, `/me` y `/logout` por área | 6, 7, 8 |
| `backend-desamparados/src/services/auth.service.ts` | *(modificar)* Corte por área en vez de global | 8 |
| `backend-desamparados/src/routes/auth.routes.ts` | *(modificar)* `/me` deja de exigir sesión | 7 |
| `desamparados-web/src/features/members/auth/store.ts` | *(modificar)* Dos sesiones en el estado | 9 |
| `desamparados-web/src/features/members/auth/session.ts` | *(modificar)* Carga las dos; cierre por área | 9 |
| `desamparados-web/src/lib/api/auth.ts` | *(modificar)* `sesionActual` devuelve las dos | 9 |
| `desamparados-web/src/lib/api/client.ts` | *(modificar)* Fuera el rescate de sesión perdida | 10 |
| `desamparados-web/src/routes/RequireAuth.tsx` | *(modificar)* Mira la de hermanos | 10 |
| `desamparados-web/src/routes/RequireRole.tsx` | *(modificar)* Mira la del CMS | 10 |
| `desamparados-web/src/app/AdminLayout.tsx` | *(modificar)* Cierra solo la del CMS | 10 |
| `desamparados-web/src/app/BrotherLayout.tsx` | *(modificar)* Cierra solo la de hermanos | 10 |

---

### Task 1: Dos marcas de corte de sesión en `User`

**Files:**
- Modify: `backend-desamparados/prisma/schema.prisma:60-115` (modelo `User`)
- Create: `backend-desamparados/prisma/migrations/<timestamp>_cortes_de_sesion_por_area/migration.sql` *(la genera Prisma)*

**Interfaces:**
- Consumes: nada.
- Produces: `User.cmsValidoDesde: DateTime` y `User.hermanoValidoDesde: DateTime`, las dos con `@default(now())`.

**Contexto:** hoy `logout` mueve `tokenValidAfter` y mata **todas** las sesiones de la cuenta. Con dos áreas eso significaría que salir del área de hermanos te echa del CMS, que es justo lo que venimos a arreglar. `tokenValidAfter` se queda como corte **global** para lo que sí debe matarlo todo (cambio de contraseña, degradación de rol, reset de 2FA, borrado RGPD).

- [ ] **Step 1: Añadir los campos al esquema**

En `prisma/schema.prisma`, en el modelo `User`, justo debajo de `tokenValidAfter`:

```prisma
  // Invalidación de sesiones: todo JWT emitido ANTES de esta fecha queda anulado
  // (cambio de contraseña, degradación de rol, reset 2FA de emergencia...)
  tokenValidAfter DateTime @default(now())

  // Corte POR ÁREA. Las dos sesiones (CMS y hermanos) son independientes: salir
  // del área de hermanos no puede echar a nadie del CMS, y al revés. Un token
  // vale si se emitió después de tokenValidAfter Y de la marca de su área.
  cmsValidoDesde     DateTime @default(now())
  hermanoValidoDesde DateTime @default(now())
```

- [ ] **Step 2: Generar la migración**

```bash
cd backend-desamparados && rtk npx prisma migrate dev --name cortes_de_sesion_por_area
```

- [ ] **Step 3: Comprobar el SQL generado**

```bash
rtk read backend-desamparados/prisma/migrations/*cortes_de_sesion_por_area/migration.sql
```

Esperado: dos `ALTER TABLE User ADD COLUMN ... DATETIME(3) NOT NULL DEFAULT ...`. Si Prisma propone borrar o recrear algo más, **para y revísalo**: esta migración solo añade dos columnas.

- [ ] **Step 4: Comprobar que el cliente compila**

```bash
cd backend-desamparados && rtk npx prisma generate && rtk npm test
```

Esperado: PASA. Todavía nadie usa los campos nuevos.

- [ ] **Step 5: Commit**

```bash
rtk git add backend-desamparados/prisma
rtk git commit -F - <<'EOF'
Añadir un corte de sesión por área

Cerrar sesión mueve tokenValidAfter y mata todas las sesiones de la cuenta.
Con el CMS y el área de hermanos separados eso significaría que salir de una
te echa de la otra, que es justo lo que hay que arreglar.

tokenValidAfter se queda para lo que sí debe matarlo todo: cambio de
contraseña, degradación de rol, reset de 2FA y borrado RGPD.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

### Task 2: Dos cookies, una por área

**Files:**
- Modify: `backend-desamparados/src/utils/cookies.ts`
- Test: `backend-desamparados/test/cookies-sesion.test.ts`

**Interfaces:**
- Consumes: `duracionSesionSegundos`, `RECORDARME_SEGUNDOS`, `PENDIENTE_2FA_SEGUNDOS` de `utils/jwt.handle.ts`.
- Produces, desde `utils/cookies.ts`:
  - `export type AreaSesion = 'cms' | 'hermanos'`
  - `COOKIE_CMS = 'desamparados_cms'`, `COOKIE_HERMANO = 'desamparados_hermano'`
  - `nombreCookie(area: AreaSesion): string`
  - `opcionesCookieSesion(area: AreaSesion, role: string, recordarme?: boolean): CookieOptions`
  - `ponerCookieSesion(res: Response, area: AreaSesion, token: string, role: string, recordarme?: boolean): void`
  - `limpiarCookieSesion(res: Response, area: AreaSesion): void`
  - `limpiarCookiesAuth(res: Response): void` — borra las dos de sesión y la del 2FA
  - `COOKIE_2FA`, `ponerCookie2FA`, `limpiarCookie2FA` — **sin cambios**
- `COOKIE_SESION` **desaparece**. Todo lo que lo importe deja de compilar: eso es lo que queremos, es la lista de sitios que hay que revisar.

**Contexto:** hoy la duración la decide el rol (`esStaff(role)` → cookie de sesión que muere al cerrar el navegador). Pasa a decidirla **el área**, que es lo correcto: un Tesorero dentro del área de hermanos merece la cookie persistente del área de hermanos, y dentro del CMS la que muere al cerrar el navegador, porque el CMS se usa desde equipos compartidos de la casa parroquial.

- [ ] **Step 1: Escribir los tests que fallan**

Reescribe `backend-desamparados/test/cookies-sesion.test.ts`:

```ts
import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { opcionesCookieSesion, nombreCookie, COOKIE_CMS, COOKIE_HERMANO, COOKIE_2FA } from '../src/utils/cookies.js';
import { RECORDARME_SEGUNDOS } from '../src/utils/jwt.handle.js';

test('los nombres de las cookies son los del contrato', () => {
  assert.equal(COOKIE_CMS, 'desamparados_cms');
  assert.equal(COOKIE_HERMANO, 'desamparados_hermano');
  assert.equal(COOKIE_2FA, 'desamparados_2fa');
  assert.equal(nombreCookie('cms'), COOKIE_CMS);
  assert.equal(nombreCookie('hermanos'), COOKIE_HERMANO);
});

test('las dos cookies son distintas: por eso pueden convivir', () => {
  // Con una sola cookie, entrar al área de hermanos sustituía la del CMS y
  // dejaba la administración sin sesión. Es el hallazgo que cierra esta fase.
  assert.notEqual(COOKIE_CMS, COOKIE_HERMANO);
});

test('la cookie del CMS muere al cerrar el navegador, sea cual sea el rol', () => {
  // El CMS se usa desde equipos compartidos de la casa parroquial.
  for (const role of ['ADMIN', 'TESORERIA', 'SECRETARIA']) {
    const opciones = opcionesCookieSesion('cms', role);
    assert.equal(opciones.maxAge, undefined, `rol ${role}`);
    assert.equal(opciones.httpOnly, true);
    assert.equal(opciones.sameSite, 'strict');
    assert.equal(opciones.path, '/api');
  }
});

test('la cookie de hermanos persiste, también para un cargo de la junta', () => {
  // Un Tesorero que entra a ver su propio perfil está en el área de hermanos:
  // la duración la decide el área, no su cargo.
  const hermano = opcionesCookieSesion('hermanos', 'USER');
  const tesorero = opcionesCookieSesion('hermanos', 'TESORERIA');
  assert.ok(typeof hermano.maxAge === 'number' && hermano.maxAge > 0);
  assert.ok(typeof tesorero.maxAge === 'number' && tesorero.maxAge > 0);
});

test('con "recordarme" las dos persisten 72 h', () => {
  for (const area of ['cms', 'hermanos'] as const) {
    assert.equal(opcionesCookieSesion(area, 'ADMIN', true).maxAge, RECORDARME_SEGUNDOS * 1000, `área ${area}`);
  }
});

test('Secure queda desactivado fuera de producción', () => {
  assert.equal(opcionesCookieSesion('hermanos', 'USER').secure, false);
});
```

- [ ] **Step 2: Ejecutar para comprobar que falla**

```bash
cd backend-desamparados && rtk npx tsx --test test/cookies-sesion.test.ts
```

Esperado: FALLA al importar `nombreCookie`, `COOKIE_CMS` y `COOKIE_HERMANO`.

- [ ] **Step 3: Reescribir el módulo de cookies**

En `backend-desamparados/src/utils/cookies.ts`, sustituye el bloque de la cookie de sesión (deja intacto todo lo del 2FA):

```ts
/**
 * El CMS y el área de hermanos tienen **una cookie cada uno**. Con una sola,
 * entrar por un acceso sustituía la sesión del otro: quien estaba dentro del
 * CMS y se identificaba como hermano para ver su perfil perdía la
 * administración. Son dos sesiones distintas de la misma persona.
 */
export type AreaSesion = 'cms' | 'hermanos';

export const COOKIE_CMS = 'desamparados_cms';
export const COOKIE_HERMANO = 'desamparados_hermano';
export const COOKIE_2FA = 'desamparados_2fa';

export const nombreCookie = (area: AreaSesion): string =>
  area === 'cms' ? COOKIE_CMS : COOKIE_HERMANO;

// La cookie de sesión solo viaja a la API; los estáticos y /storage/public no la reciben.
const RUTA_SESION = '/api';
const RUTA_2FA = '/api/auth';

/** Secure solo en producción: en local se sirve por http y el navegador la descartaría. */
const base = (path: string): CookieOptions => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path
});

/**
 * La duración la decide el ÁREA, no el rol.
 *
 * - CMS: sin maxAge, o sea cookie que muere al cerrar el navegador, porque se
 *   usa desde equipos compartidos de la casa parroquial.
 * - Hermanos: persiste, con el mismo tope que el JWT para que no lo sobreviva.
 *
 * Antes lo decidía `esStaff(role)`, y entonces un Tesorero que entraba al área
 * de hermanos a ver su perfil se llevaba la cookie corta del CMS sin estar en
 * el CMS.
 *
 * Con «Recordarme» (cualquier área, cualquier rol): 72 h, alineadas con el JWT.
 */
export const opcionesCookieSesion = (area: AreaSesion, role: string, recordarme = false): CookieOptions => ({
  ...base(RUTA_SESION),
  ...(recordarme
    ? { maxAge: RECORDARME_SEGUNDOS * 1000 }
    : area === 'cms'
      ? {}
      : { maxAge: duracionSesionSegundos(role) * 1000 })
});

export const ponerCookieSesion = (
  res: Response, area: AreaSesion, token: string, role: string, recordarme = false
): void => {
  res.cookie(nombreCookie(area), token, opcionesCookieSesion(area, role, recordarme));
};

// OJO: borrar una cookie exige repetir su Path exacto. Sin él el navegador
// ignora el borrado y la respuesta sigue siendo un 204 engañoso.
export const limpiarCookieSesion = (res: Response, area: AreaSesion): void => {
  res.clearCookie(nombreCookie(area), base(RUTA_SESION));
};

export const limpiarCookiesAuth = (res: Response): void => {
  limpiarCookieSesion(res, 'cms');
  limpiarCookieSesion(res, 'hermanos');
  limpiarCookie2FA(res);
};
```

Quita el import de `esStaff` si se queda sin uso.

- [ ] **Step 4: Ejecutar el test de cookies**

```bash
cd backend-desamparados && rtk npx tsx --test test/cookies-sesion.test.ts
```

Esperado: PASAN los seis.

- [ ] **Step 5: Ver qué se ha roto**

```bash
cd backend-desamparados && rtk npx tsc --noEmit
```

Esperado: errores en `middleware/session.ts`, `middleware/checkRole.ts`, `controllers/auth.controller.ts` y en algunos tests, todos por `COOKIE_SESION`. **Es la lista de trabajo de las tareas 3 a 8: apúntala y no la arregles todavía.** Anótala en el mensaje del commit.

- [ ] **Step 6: Commit**

```bash
rtk git add backend-desamparados/src/utils/cookies.ts backend-desamparados/test/cookies-sesion.test.ts
rtk git commit -F - <<'EOF'
Partir la cookie de sesión en una por área

Con una sola cookie, entrar por el acceso de hermanos sustituía la sesión
del CMS: quien estaba administrando y se identificaba para ver su perfil de
hermano se quedaba sin administración.

Ahora hay dos, desamparados_cms y desamparados_hermano, y la duración la
decide el área y no el rol: el CMS muere al cerrar el navegador porque se usa
en equipos compartidos, y el área de hermanos persiste.

COOKIE_SESION desaparece a propósito: quien lo importaba deja de compilar, y
esa es la lista de sitios que hay que revisar en las tareas siguientes.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

### Task 3: La validación contra la base de datos respeta la marca de su área

**Files:**
- Modify: `backend-desamparados/src/middleware/session.ts:20-40`
- Test: `backend-desamparados/test/sesiones-por-area.test.ts` *(crear)*

**Interfaces:**
- Consumes: `User.cmsValidoDesde` y `User.hermanoValidoDesde` de la tarea 1. `AreaSesion` de la tarea 2.
- Produces: `validateSessionAgainstDb(payload: AuthTokenPayload, area: AreaSesion): Promise<AuthTokenPayload | null>`

- [ ] **Step 1: Escribir el test que falla**

Crea `backend-desamparados/test/sesiones-por-area.test.ts` con el bloque de sondeo de base de datos copiado de `test/permisos-hermano-mayor.test.ts`, más:

```ts
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import db from '../src/config/db.js';
import { validateSessionAgainstDb } from '../src/middleware/session.js';
import { crearUsuarioPrueba, borrarUsuarioPrueba } from './fixtures/usuarios.js';
import { Role } from '@prisma/client';

// ...aquí el bloque de sondeo...

const creados: number[] = [];
after(async () => { for (const id of creados) await borrarUsuarioPrueba(id); });

/** Un payload de sesión como el que firma generateToken, emitido ahora mismo. */
const payloadDe = (id: number, role: string, origen: 'cms' | 'hermanos') => ({
  id, role, typ: 'session' as const, origen, emitidoMs: Date.now()
});

test('cerrar el área de hermanos no invalida la sesión del CMS', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const user = await crearUsuarioPrueba(Role.TESORERIA);
  creados.push(user.id);

  const cms = payloadDe(user.id, Role.TESORERIA, 'cms');
  const hermano = payloadDe(user.id, Role.TESORERIA, 'hermanos');

  // Cierra solo el área de hermanos.
  await db.user.update({ where: { id: user.id }, data: { hermanoValidoDesde: new Date(Date.now() + 1000) } });

  assert.ok(await validateSessionAgainstDb(cms, 'cms'), 'la del CMS tiene que seguir viva');
  assert.equal(await validateSessionAgainstDb(hermano, 'hermanos'), null, 'la de hermanos tiene que estar muerta');
});

test('cerrar el CMS no invalida la sesión del área de hermanos', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const user = await crearUsuarioPrueba(Role.SECRETARIA);
  creados.push(user.id);

  const cms = payloadDe(user.id, Role.SECRETARIA, 'cms');
  const hermano = payloadDe(user.id, Role.SECRETARIA, 'hermanos');

  await db.user.update({ where: { id: user.id }, data: { cmsValidoDesde: new Date(Date.now() + 1000) } });

  assert.equal(await validateSessionAgainstDb(cms, 'cms'), null);
  assert.ok(await validateSessionAgainstDb(hermano, 'hermanos'));
});

test('el corte global sigue matando las dos', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const user = await crearUsuarioPrueba(Role.ADMIN);
  creados.push(user.id);

  // Es lo que hace un cambio de contraseña o una degradación de rol: ahí sí
  // hay que echar a todo el mundo de todas partes.
  await db.user.update({ where: { id: user.id }, data: { tokenValidAfter: new Date(Date.now() + 1000) } });

  assert.equal(await validateSessionAgainstDb(payloadDe(user.id, Role.ADMIN, 'cms'), 'cms'), null);
  assert.equal(await validateSessionAgainstDb(payloadDe(user.id, Role.ADMIN, 'hermanos'), 'hermanos'), null);
});

test('un token de hermanos no vale como sesión del CMS aunque la cuenta sea de staff', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const user = await crearUsuarioPrueba(Role.ADMIN);
  creados.push(user.id);

  // El segundo factor solo se pide en /cms/acceso: un token nacido en el área
  // de hermanos es un token que NO ha pasado el 2FA.
  const colado = payloadDe(user.id, Role.ADMIN, 'hermanos');
  assert.equal(await validateSessionAgainstDb(colado, 'cms'), null);
});
```

- [ ] **Step 2: Ejecutar para comprobar que falla**

```bash
cd backend-desamparados && rtk npx tsx --test test/sesiones-por-area.test.ts
```

Esperado: FALLA (la función todavía recibe un solo argumento).

- [ ] **Step 3: Implementar**

En `backend-desamparados/src/middleware/session.ts`, sustituye `validateSessionAgainstDb`:

```ts
/**
 * Valida un token ya firmado contra la base de datos:
 * - El usuario existe y está activo (baja/cuenta bloqueada = sesión muerta)
 * - El token nació en ESTA área (el claim `origen`). Un token del área de
 *   hermanos presentado como sesión del CMS es un token que no ha pasado el
 *   segundo factor, que solo se pide en /cms/acceso.
 * - Se emitió DESPUÉS del corte global (`tokenValidAfter`: contraseña, rol,
 *   RGPD) Y del corte de su área (`cmsValidoDesde` / `hermanoValidoDesde`:
 *   cerrar sesión en una no puede echar de la otra).
 * - Refresca el rol: si degradan a alguien, su token viejo pierde permisos al
 *   instante.
 */
export async function validateSessionAgainstDb(
  payload: AuthTokenPayload,
  area: AreaSesion
): Promise<AuthTokenPayload | null> {
  if (payload.origen !== area) return null;

  const dbUser = await db.user.findUnique({
    where: { id: payload.id },
    select: { role: true, active: true, tokenValidAfter: true, cmsValidoDesde: true, hermanoValidoDesde: true }
  });

  if (!dbUser || !dbUser.active) return null;

  // Con milisegundos cuando el token los trae: `iat` va en segundos enteros y,
  // tras un cierre de sesión (que mueve la marca al instante actual), el login
  // que se hiciera en ese mismo segundo nacería ya revocado.
  const issuedAtMs = typeof payload.emitidoMs === 'number' ? payload.emitidoMs : (payload.iat ?? 0) * 1000;
  const marcaDelArea = area === 'cms' ? dbUser.cmsValidoDesde : dbUser.hermanoValidoDesde;
  const corte = Math.max(dbUser.tokenValidAfter.getTime(), marcaDelArea.getTime());
  if (issuedAtMs < corte) return null;

  // Devolvemos el payload con el rol REAL de la BD (no el que viajaba en el JWT)
  return { ...payload, role: dbUser.role };
}
```

Importa `AreaSesion` de `../utils/cookies.js`.

- [ ] **Step 4: Ejecutar el test**

```bash
cd backend-desamparados && rtk npx tsx --test test/sesiones-por-area.test.ts
```

Esperado: PASAN los cuatro.

- [ ] **Step 5: Commit**

```bash
rtk git add backend-desamparados/src/middleware/session.ts backend-desamparados/test/sesiones-por-area.test.ts
rtk git commit -F - <<'EOF'
Validar cada sesión contra el corte de su área

Un token vale si nació en el área en la que se presenta y si se emitió
después del corte global y del de su área. Así cerrar sesión en el área de
hermanos no echa a nadie del CMS, y el corte global sigue matándolo todo
cuando debe: contraseña, degradación de rol, RGPD.

La comprobación del origen sigue siendo la que impide que un token del área
de hermanos, que nunca pasó el 2FA, valga como sesión del CMS.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

### Task 4: El middleware resuelve las dos cookies

**Files:**
- Modify: `backend-desamparados/src/middleware/session.ts:42-94`
- Test: `backend-desamparados/test/sesiones-por-area.test.ts` *(ampliar)*

**Interfaces:**
- Consumes: `validateSessionAgainstDb(payload, area)` de la tarea 3.
- Produces:
  - `declare global { namespace Express { interface Request { user?: AuthTokenPayload; sesiones: { cms: AuthTokenPayload | null; hermano: AuthTokenPayload | null } } } }`
  - `resolverSesiones` — middleware que **siempre** deja `req.sesiones` y nunca falla.
  - `authenticateToken` — `resolverSesiones` + 401 si las dos son nulas.
  - `optionalAuthentication` — `resolverSesiones` y sigue, como hasta ahora.

**Contexto:** `req.user` toma por defecto `sesiones.hermano ?? sesiones.cms`, para que las rutas del área de hermanos sigan leyendo `req.user` sin tocarlas. `checkRole` lo sustituye por la del CMS en la tarea 5.

- [ ] **Step 1: Escribir el test que falla**

Añade a `backend-desamparados/test/sesiones-por-area.test.ts` un test que arranque el servidor real (patrón de `permisos-hermano-mayor.test.ts`: `app.listen(0)` en un `before`) y compruebe:

```ts
test('con las dos cookies puestas, cada área usa la suya', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const user = await crearUsuarioPrueba(Role.TESORERIA);
  creados.push(user.id);

  const cms = generateToken(user.id, Role.TESORERIA, false, 'cms');
  const hermano = generateToken(user.id, Role.TESORERIA, false, 'hermanos');
  const lasDos = `${COOKIE_CMS}=${cms}; ${COOKIE_HERMANO}=${hermano}`;

  // Ruta de staff: tiene que pasar, porque la cookie del CMS está puesta.
  const panel = await fetch(`${baseUrl}/api/panel/hoy`, { headers: { cookie: lasDos } });
  assert.notEqual(panel.status, 401, 'con cookie del CMS no puede dar 401');
  assert.notEqual(panel.status, 403, 'con cookie del CMS no puede dar 403');

  // Ruta del área de hermanos: también, con la suya.
  const perfiles = await fetch(`${baseUrl}/api/hermanos/mis-perfiles`, { headers: { cookie: lasDos } });
  assert.equal(perfiles.status, 200);
});

test('sin ninguna cookie, las rutas con sesión dan 401', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const respuesta = await fetch(`${baseUrl}/api/hermanos/mis-perfiles`);
  assert.equal(respuesta.status, 401);
});

test('solo con la cookie del CMS, una ruta del área de hermanos sigue atendiendo', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  // Es su propia ficha: una sesión del CMS es más fuerte, no más débil.
  const user = await crearUsuarioPrueba(Role.SECRETARIA);
  creados.push(user.id);
  const cms = generateToken(user.id, Role.SECRETARIA, false, 'cms');
  const respuesta = await fetch(`${baseUrl}/api/hermanos/mis-perfiles`, {
    headers: { cookie: `${COOKIE_CMS}=${cms}` },
  });
  assert.equal(respuesta.status, 200);
});
```

- [ ] **Step 2: Ejecutar para comprobar que falla**

```bash
cd backend-desamparados && rtk npx tsx --test test/sesiones-por-area.test.ts
```

Esperado: FALLA (el middleware todavía lee `COOKIE_SESION`, que ya no existe: no compilará).

- [ ] **Step 3: Implementar**

En `backend-desamparados/src/middleware/session.ts`, sustituye la extensión global y los dos middlewares:

```ts
declare global {
  namespace Express {
    interface Request {
      /**
       * Identidad de esta petición. Por defecto la del área de hermanos, que es
       * la que usan sus rutas sin tocarlas; `checkRole` la cambia por la del CMS
       * en las rutas de staff, para que la auditoría apunte a quien corresponde.
       */
      user?: AuthTokenPayload;
      /** Las dos sesiones que trae el navegador, cada una ya validada. */
      sesiones: { cms: AuthTokenPayload | null; hermano: AuthTokenPayload | null };
    }
  }
}

/** Lee una cookie de sesión y la valida; `null` si no está, no vale o no es de su área. */
async function leerSesion(req: Request, area: AreaSesion): Promise<AuthTokenPayload | null> {
  const token = req.cookies?.[nombreCookie(area)];
  if (!token) return null;
  // El tipo esperado es obligatorio: un testigo de 2FA colado en esta cookie
  // no puede valer como sesión.
  const payload = verifyToken(token, 'session');
  if (!payload) return null;
  return await validateSessionAgainstDb(payload, area);
}

/**
 * Deja las dos sesiones en `req.sesiones`. No bloquea nunca: quien decide si
 * hace falta una, y cuál, es `authenticateToken` o `checkRole`.
 */
export const resolverSesiones = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const [cms, hermano] = await Promise.all([leerSesion(req, 'cms'), leerSesion(req, 'hermanos')]);
    req.sesiones = { cms, hermano };
    req.user = hermano ?? cms ?? undefined;
  } catch {
    req.sesiones = { cms: null, hermano: null };
    req.user = undefined;
  }
  next();
};

/** Estricto: sin ninguna de las dos sesiones, bloquea. */
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  await resolverSesiones(req, res, () => {});
  if (!req.sesiones.cms && !req.sesiones.hermano) {
    return res.status(401).json({ error: 'NO_TOKEN_PROVIDED', message: 'Se requiere una sesión iniciada' });
  }
  next();
};

/** Opcional: sin sesión, sigue como invitado. */
export const optionalAuthentication = resolverSesiones;
```

> `authenticateToken` llama a `resolverSesiones` con un `next` vacío a propósito: resuelve y luego decide. No encadenes los dos middlewares en las rutas; `authenticateToken` ya lo hace por dentro.

- [ ] **Step 4: Ejecutar la batería entera**

```bash
cd backend-desamparados && rtk npm test
```

Esperado: siguen fallando `checkRole` y el controlador de auth (tareas 5 a 8). Los tests de sesión de esta tarea, en verde.

- [ ] **Step 5: Commit**

```bash
rtk git add backend-desamparados/src/middleware/session.ts backend-desamparados/test/sesiones-por-area.test.ts
rtk git commit -F - <<'EOF'
Resolver las dos sesiones en cada petición

El middleware lee las dos cookies y deja cada una validada en req.sesiones.
req.user toma por defecto la del área de hermanos, que es la que usan sus
rutas sin cambiarlas; checkRole la sustituye por la del CMS en las de staff.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

### Task 5: `checkRole` exige la sesión del CMS

**Files:**
- Modify: `backend-desamparados/src/middleware/checkRole.ts`
- Test: `backend-desamparados/test/sesiones-por-area.test.ts` *(ampliar)*

**Interfaces:**
- Consumes: `req.sesiones` de la tarea 4.
- Produces: `checkRole(allowedRoles)` mira `req.sesiones.cms` y, cuando la hay, **fija `req.user = req.sesiones.cms`** antes de `next()`. `SESION_NO_CMS` sigue exportándose con el mismo valor.

**Contexto:** es la pieza que sostiene toda la seguridad del diseño. `checkRole` es el paso obligado de **todas** las rutas de staff y ninguna de sus listas de roles incluye `USER`; por eso la decisión vive aquí y no en un middleware suelto que haya que recordar en cada router —olvidarse de uno es justo el fallo que dejó abierta `/news/admin/archive`—.

- [ ] **Step 1: Escribir los tests que fallan**

Añade a `backend-desamparados/test/sesiones-por-area.test.ts`:

```ts
test('la cookie de hermanos no abre una ruta de staff, aunque la cuenta sea ADMIN', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  // Saltarse esto es saltarse el segundo factor: solo se pide en /cms/acceso.
  const user = await crearUsuarioPrueba(Role.ADMIN);
  creados.push(user.id);
  const hermano = generateToken(user.id, Role.ADMIN, false, 'hermanos');

  const respuesta = await fetch(`${baseUrl}/api/panel/hoy`, {
    headers: { cookie: `${COOKIE_HERMANO}=${hermano}` },
  });
  assert.equal(respuesta.status, 403);
  assert.equal((await respuesta.json()).error, 'SESION_NO_CMS');
});

test('la cookie del CMS no vale si el rol no llega', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const user = await crearUsuarioPrueba(Role.REDES);
  creados.push(user.id);
  const cms = generateToken(user.id, Role.REDES, false, 'cms');

  // Auditoría es solo de ADMIN y HERMANO_MAYOR: aquí el 403 es de permisos,
  // no de sesión, y lleva otro código.
  const respuesta = await fetch(`${baseUrl}/api/admin/auditoria`, {
    headers: { cookie: `${COOKIE_CMS}=${cms}` },
  });
  assert.equal(respuesta.status, 403);
  assert.notEqual((await respuesta.json()).error, 'SESION_NO_CMS');
});
```

> Comprueba la ruta real de auditoría en `src/routes/admin.routes.ts` antes de escribirla; si no es `/api/admin/auditoria`, usa la que sea.

- [ ] **Step 2: Ejecutar para comprobar que falla**

```bash
cd backend-desamparados && rtk npx tsx --test test/sesiones-por-area.test.ts
```

Esperado: FALLA (no compila: `checkRole` importa `COOKIE_SESION` indirectamente a través de `req.user.origen`).

- [ ] **Step 3: Implementar**

En `backend-desamparados/src/middleware/checkRole.ts`, sustituye el cuerpo del middleware dejando el comentario largo actualizado:

```ts
export const checkRole = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Caso 1: La sesión del CMS no está (Error 403 Forbidden con código propio).
      //
      // El CMS y el área de hermanos tienen una cookie cada uno. El segundo
      // factor solo se pide al entrar por /cms/acceso, así que una sesión del
      // área de hermanos es una sesión que NO ha pasado el 2FA: no puede abrir
      // nada de aquí. Con cookies separadas ni siquiera puede confundirse, pero
      // la comprobación se queda porque es la que da sentido al 2FA.
      //
      // Va aquí, y no en un middleware suelto que haya que recordar en cada
      // router, porque `checkRole` es el paso obligado de TODAS las rutas de
      // staff: ninguna de sus listas de roles incluye USER. Olvidarse de un
      // router es justo el fallo que ya dejó abierta /news/admin/archive.
      const sesion = req.sesiones?.cms;
      if (!sesion) {
        // Si hay sesión de hermanos, es que alguien ha llegado aquí desde el
        // área de hermanos: no es un fallo de permisos, es que falta el acceso
        // del CMS. Sin ninguna de las dos, es un 401 normal.
        if (!req.sesiones?.hermano) {
          return handleHttp(res, 'NO_USER_FOUND', 'Usuario no autenticado', 401);
        }
        return res.status(403).json({
          error: SESION_NO_CMS,
          message: 'Esta sesión no da acceso al gestor de contenidos. Entra por el acceso del CMS.'
        });
      }

      // A partir de aquí, la identidad de la petición es la del CMS: la
      // auditoría tiene que apuntar a quien está administrando, no a la sesión
      // de hermano que esa misma persona pueda tener abierta en otra pestaña.
      req.user = sesion;

      // Caso 2: El rol no coincide (Error 403 Forbidden).
      // Como user.role viene del JWT (string), lo casteamos al Enum Role de Prisma
      if (allowedRoles.includes(sesion.role as Role)) {
        return next();
      }
      return handleHttp(res, `Intentó acceder con rol: ${sesion.role}`, 'No tienes permisos para realizar esta acción', 403);

    } catch (e) {
      return handleHttp(res, e, 'Error verificando permisos', 500);
    }
  };
};
```

- [ ] **Step 4: Ejecutar los tests de permisos**

```bash
cd backend-desamparados && rtk npx tsx --test test/sesiones-por-area.test.ts test/permisos-hermano-mayor.test.ts test/panel-acceso.test.ts
```

Esperado: PASAN. En `permisos-hermano-mayor.test.ts` y `panel-acceso.test.ts` habrá que cambiar `COOKIE_SESION` por `COOKIE_CMS` en las cabeceras: hazlo, es parte de esta tarea.

- [ ] **Step 5: Commit**

```bash
rtk git add backend-desamparados/src/middleware/checkRole.ts backend-desamparados/test
rtk git commit -F - <<'EOF'
Que checkRole exija la sesión del CMS

checkRole es el paso obligado de todas las rutas de staff, así que es donde
tiene que decidirse qué sesión vale. Mira la cookie del CMS y, cuando la hay,
fija req.user a ella: la auditoría debe apuntar a quien está administrando,
no a la sesión de hermano que esa misma persona tenga abierta al lado.

Sin sesión del CMS pero con la de hermanos, el 403 lleva su código propio;
sin ninguna de las dos, 401.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

### Task 6: El login pone la cookie de su área y no toca la otra

**Files:**
- Modify: `backend-desamparados/src/controllers/auth.controller.ts:30-105`
- Test: `backend-desamparados/test/sesiones-por-area.test.ts` *(ampliar)*

**Interfaces:**
- Consumes: `ponerCookieSesion(res, area, token, role, recordarme)` de la tarea 2.
- Produces: `POST /auth/login` y `POST /auth/login/2fa` ponen **solo** la cookie de su `contexto`.

- [ ] **Step 1: Escribir el test que falla**

```ts
test('entrar como hermano no borra la cookie del CMS', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  // Es el hallazgo del usuario: estaba en el CMS, entró como hermano para ver
  // su perfil, y la administración le dijo que su sesión no tenía acceso.
  const user = await crearUsuarioPrueba(Role.TESORERIA);
  creados.push(user.id);

  const respuesta = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: PASSWORD_PRUEBA, contexto: 'hermanos' }),
  });
  assert.equal(respuesta.status, 200);

  const cookies = respuesta.headers.getSetCookie();
  assert.ok(cookies.some((c) => c.startsWith(`${COOKIE_HERMANO}=`)), 'pone la de hermanos');
  assert.ok(!cookies.some((c) => c.startsWith(`${COOKIE_CMS}=`)), 'no toca la del CMS');
});

test('entrar en el CMS no borra la cookie del área de hermanos', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const user = await crearUsuarioPrueba(Role.SECRETARIA);
  creados.push(user.id);

  const respuesta = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: PASSWORD_PRUEBA, contexto: 'cms' }),
  });
  assert.equal(respuesta.status, 200);

  const cookies = respuesta.headers.getSetCookie();
  assert.ok(cookies.some((c) => c.startsWith(`${COOKIE_CMS}=`)));
  assert.ok(!cookies.some((c) => c.startsWith(`${COOKIE_HERMANO}=`)));
});
```

Importa `PASSWORD_PRUEBA` de `./fixtures/usuarios.js`.

- [ ] **Step 2: Ejecutar para comprobar que falla**

```bash
cd backend-desamparados && rtk npx tsx --test test/sesiones-por-area.test.ts
```

Esperado: FALLA (no compila: el controlador llama a `ponerCookieSesion` con la firma vieja).

- [ ] **Step 3: Implementar**

En `auth.controller.ts`:

- En `login`, cambia la llamada:

```ts
      // Solo la cookie de SU área: entrar por un acceso no puede tirar la
      // sesión del otro. Es el hallazgo que abrió esta fase.
      ponerCookieSesion(res, contexto, response.token, response.user.role, recordarme);
```

- En `loginVerify2FA`, igual, usando el `origen` que viene dentro del testigo:

```ts
      limpiarCookie2FA(res);
      ponerCookieSesion(res, origen, response.token, response.user.role, recordarme);
```

- Sustituye el import de `COOKIE_SESION` por lo que haga falta (`COOKIE_CMS`, `COOKIE_HERMANO`, `nombreCookie`).

- [ ] **Step 4: Ejecutar los tests**

```bash
cd backend-desamparados && rtk npx tsx --test test/sesiones-por-area.test.ts test/auth-seguridad.test.ts test/auth-revision.test.ts
```

Esperado: PASAN. Actualiza en esos dos ficheros las referencias a `COOKIE_SESION`.

- [ ] **Step 5: Commit**

```bash
rtk git add backend-desamparados/src/controllers/auth.controller.ts backend-desamparados/test
rtk git commit -F - <<'EOF'
Que cada acceso ponga solo la cookie de su área

Entrar por el acceso de hermanos dejaba sin sesión al CMS abierto en otra
pestaña, porque la cookie era la misma. Ahora cada login pone la suya y no
toca la del área contraria.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

### Task 7: `/auth/me` devuelve las dos sesiones

**Files:**
- Modify: `backend-desamparados/src/controllers/auth.controller.ts:186-196`
- Modify: `backend-desamparados/src/routes/auth.routes.ts:77`
- Test: `backend-desamparados/test/sesiones-por-area.test.ts` *(ampliar)*

**Interfaces:**
- Consumes: `req.sesiones` de la tarea 4, `AuthService.perfilSesion(userId)`.
- Produces: `GET /api/auth/me` → `200` siempre, con `{ cms: User | null, hermano: User | null }`. Cada `User` es el objeto de siempre (`id`, `email`, `role`, `perfiles`, `twoFactorEnabled`) más `origen`.

**Contexto:** hoy `/me` lleva `authenticateToken` y devuelve 401 a un invitado, que es el caso **normal** al arrancar la web pública. El frontend lo trata como error y lo reintenta. Con la respuesta de dos sesiones, un invitado recibe `{ cms: null, hermano: null }` y ya está.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
test('/auth/me responde 200 a un invitado, con las dos sesiones vacías', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  // Un visitante sin sesión es el caso normal de la web pública, no un error.
  const respuesta = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(respuesta.status, 200);
  assert.deepEqual(await respuesta.json(), { cms: null, hermano: null });
});

test('/auth/me devuelve las dos sesiones de quien tiene las dos', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const user = await crearUsuarioPrueba(Role.TESORERIA);
  creados.push(user.id);
  const cms = generateToken(user.id, Role.TESORERIA, false, 'cms');
  const hermano = generateToken(user.id, Role.TESORERIA, false, 'hermanos');

  const respuesta = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { cookie: `${COOKIE_CMS}=${cms}; ${COOKIE_HERMANO}=${hermano}` },
  });
  const cuerpo = await respuesta.json();
  assert.equal(cuerpo.cms.id, user.id);
  assert.equal(cuerpo.cms.origen, 'cms');
  assert.equal(cuerpo.hermano.id, user.id);
  assert.equal(cuerpo.hermano.origen, 'hermanos');
});
```

- [ ] **Step 2: Ejecutar para comprobar que falla**

```bash
cd backend-desamparados && rtk npx tsx --test test/sesiones-por-area.test.ts
```

Esperado: FALLA con 401 en el primero.

- [ ] **Step 3: Implementar**

En `auth.controller.ts`:

```ts
  /**
   * Las sesiones abiertas de este navegador, una por área. Responde 200 aunque
   * no haya ninguna: un visitante sin sesión es el caso normal de la web
   * pública, y devolverle un 401 hacía que el arranque del frontend lo tratara
   * como error y lo reintentara.
   */
  static async me(req: Request, res: Response) {
    try {
      const perfil = async (sesion: AuthTokenPayload | null) => {
        if (!sesion) return null;
        const datos = await AuthService.perfilSesion(sesion.id);
        // El origen viene del propio JWT; la BD no lo guarda.
        return { ...datos, origen: sesion.origen };
      };

      const [cms, hermano] = await Promise.all([perfil(req.sesiones.cms), perfil(req.sesiones.hermano)]);
      res.status(200).json({ cms, hermano });
    } catch (error) {
      handleHttp(res, error, 'No se ha podido recuperar la sesión');
    }
  }
```

En `routes/auth.routes.ts`, cambia el middleware de `/me`:

```ts
authRoutes.get('/me', resolverSesiones, AuthController.me);
```

- [ ] **Step 4: Ejecutar los tests**

```bash
cd backend-desamparados && rtk npm test
```

Esperado: PASAN los de sesión. Si algún test esperaba el 401 de `/me` para un invitado, actualízalo: ese contrato ha cambiado a propósito.

- [ ] **Step 5: Commit**

```bash
rtk git add backend-desamparados/src backend-desamparados/test
rtk git commit -F - <<'EOF'
Que /auth/me devuelva las dos sesiones

El frontend necesita saber en qué áreas está dentro, no una sola. Y un
visitante sin sesión recibe 200 con las dos vacías: es el caso normal de la
web pública, y el 401 hacía que el arranque lo tratara como error.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

### Task 8: Cerrar sesión afecta solo a su área

**Files:**
- Modify: `backend-desamparados/src/services/auth.service.ts:565-580`
- Modify: `backend-desamparados/src/controllers/auth.controller.ts:197-220`
- Modify: `backend-desamparados/src/schemas/auth.schema.ts`
- Modify: `backend-desamparados/src/routes/auth.routes.ts:65`
- Test: `backend-desamparados/test/sesiones-por-area.test.ts` *(ampliar)*

**Interfaces:**
- Consumes: `limpiarCookieSesion(res, area)` y `limpiarCookiesAuth(res)` de la tarea 2.
- Produces:
  - `AuthService.cerrarSesionesDe(userId: number, area?: AreaSesion): Promise<void>` — sin `area`, corta las dos.
  - `logoutSchema` en `schemas/auth.schema.ts`: `type({ "body?": type({ "area?": "'cms' | 'hermanos'" }).or("undefined") })`
  - `POST /api/auth/logout` con cuerpo opcional `{ area }`.

- [ ] **Step 1: Escribir el test que falla**

```ts
test('cerrar el área de hermanos deja el CMS dentro', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const user = await crearUsuarioPrueba(Role.TESORERIA);
  creados.push(user.id);
  const cms = generateToken(user.id, Role.TESORERIA, false, 'cms');
  const hermano = generateToken(user.id, Role.TESORERIA, false, 'hermanos');
  const lasDos = `${COOKIE_CMS}=${cms}; ${COOKIE_HERMANO}=${hermano}`;

  const salida = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: lasDos },
    body: JSON.stringify({ area: 'hermanos' }),
  });
  assert.equal(salida.status, 204);

  // Borra solo la suya...
  const borradas = salida.headers.getSetCookie();
  assert.ok(borradas.some((c) => c.startsWith(`${COOKIE_HERMANO}=`)));
  assert.ok(!borradas.some((c) => c.startsWith(`${COOKIE_CMS}=`)));

  // ...y revoca solo la suya en el servidor.
  const panel = await fetch(`${baseUrl}/api/panel/hoy`, { headers: { cookie: `${COOKIE_CMS}=${cms}` } });
  assert.notEqual(panel.status, 401, 'el CMS tiene que seguir dentro');
  const perfiles = await fetch(`${baseUrl}/api/hermanos/mis-perfiles`, { headers: { cookie: `${COOKIE_HERMANO}=${hermano}` } });
  assert.equal(perfiles.status, 401, 'el área de hermanos tiene que estar fuera');
});

test('sin área, el cierre de sesión echa de las dos', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);
  const user = await crearUsuarioPrueba(Role.ADMIN);
  creados.push(user.id);
  const cms = generateToken(user.id, Role.ADMIN, false, 'cms');
  const hermano = generateToken(user.id, Role.ADMIN, false, 'hermanos');

  await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { cookie: `${COOKIE_CMS}=${cms}; ${COOKIE_HERMANO}=${hermano}` },
  });

  assert.equal((await fetch(`${baseUrl}/api/panel/hoy`, { headers: { cookie: `${COOKIE_CMS}=${cms}` } })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/hermanos/mis-perfiles`, { headers: { cookie: `${COOKIE_HERMANO}=${hermano}` } })).status, 401);
});
```

- [ ] **Step 2: Ejecutar para comprobar que falla**

```bash
cd backend-desamparados && rtk npx tsx --test test/sesiones-por-area.test.ts
```

Esperado: FALLA. Hoy el cierre mueve `tokenValidAfter` y mata las dos.

- [ ] **Step 3: Cortar por área en el servicio**

En `auth.service.ts`, sustituye `cerrarSesionesDe`:

```ts
  /**
   * Cierra las sesiones de la cuenta. Con `area`, solo las de esa área: salir
   * del portal del hermano no puede echar a nadie del CMS, ni al revés, porque
   * son dos sesiones distintas de la misma persona.
   *
   * Sin `area`, corta las dos: es lo que hace falta cuando la cuenta entera
   * deja de ser de fiar (cambio de contraseña, RGPD, degradación de rol).
   */
  static async cerrarSesionesDe(userId: number, area?: AreaSesion) {
    const corte = corteDeSesiones();
    const data =
      area === 'cms' ? { cmsValidoDesde: corte }
      : area === 'hermanos' ? { hermanoValidoDesde: corte }
      : { cmsValidoDesde: corte, hermanoValidoDesde: corte, tokenValidAfter: corte };

    await db.user.updateMany({ where: { id: userId }, data });
  }
```

> Revisa las **otras** llamadas a `cerrarSesionesDe` que ya hay en el fichero (cambio de contraseña, RGPD, degradación de rol) y déjalas **sin `area`**: esas sí tienen que echar a todo el mundo de todas partes.

- [ ] **Step 4: Cerrar por área en el controlador**

En `auth.controller.ts`:

```ts
  /**
   * Sin authenticateToken a propósito: una sesión ya caducada también tiene que
   * poder limpiar su cookie. Es idempotente.
   *
   * Cierra el área que se pida, y las dos si no se pide ninguna. Borrar solo la
   * cookie dejaba vivo el token: quien lo hubiera copiado seguía dentro sus 8 h
   * (o 72 h con «Recordarme») aunque se hubiera cerrado sesión en un equipo
   * compartido. Por eso además se revoca en el servidor.
   */
  static async logout(req: Request, res: Response) {
    const area: AreaSesion | undefined =
      req.body?.area === 'cms' ? 'cms' : req.body?.area === 'hermanos' ? 'hermanos' : undefined;

    try {
      await resolverSesiones(req, res, () => {});
      const sesiones = area === 'cms' ? [req.sesiones.cms]
        : area === 'hermanos' ? [req.sesiones.hermano]
        : [req.sesiones.cms, req.sesiones.hermano];
      for (const sesion of sesiones) {
        if (sesion) await AuthService.cerrarSesionesDe(sesion.id, area);
      }
    } catch (error) {
      // La cookie se borra igual: el cierre en el navegador no puede depender
      // de la base de datos. Queda en el log para que se sepa que el token no
      // se revocó.
      console.error('[Logout] No se pudo revocar la sesión en el servidor:', error);
    }

    if (area) limpiarCookieSesion(res, area);
    else limpiarCookiesAuth(res);
    res.status(204).end();
  }
```

- [ ] **Step 5: Validar el cuerpo**

En `schemas/auth.schema.ts`:

```ts
// El cuerpo entero es opcional: un POST /logout sin nada cierra las dos áreas.
export const logoutSchema = type({
    "body?": type({ "area?": "'cms' | 'hermanos'" }).or("undefined")
});
```

En `routes/auth.routes.ts`:

```ts
authRoutes.post('/logout', validate(logoutSchema), AuthController.logout);
```

- [ ] **Step 6: Ejecutar la batería entera**

```bash
cd backend-desamparados && rtk npm test
```

Esperado: **todo el backend en verde**. Si queda alguna referencia a `COOKIE_SESION`, es de un test: cámbiala por la cookie del área que corresponda.

- [ ] **Step 7: Commit**

```bash
rtk git add backend-desamparados/src backend-desamparados/test
rtk git commit -F - <<'EOF'
Cerrar sesión solo en el área que se cierra

El cierre movía tokenValidAfter y mataba todas las sesiones de la cuenta.
Con las dos áreas separadas eso habría significado que salir del portal del
hermano echa del CMS.

Ahora cada área tiene su marca de corte. Sin área, se cortan las dos, que es
lo que hace falta cuando la cuenta entera deja de ser de fiar: cambio de
contraseña, RGPD o degradación de rol.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

### Task 9: El frontend guarda dos sesiones

**Files:**
- Modify: `desamparados-web/src/features/members/auth/store.ts`
- Modify: `desamparados-web/src/features/members/auth/session.ts`
- Modify: `desamparados-web/src/lib/api/auth.ts`
- Test: `desamparados-web/src/features/members/auth/__tests__/store.test.ts` *(crear)*

**Interfaces:**
- Consumes: `GET /auth/me` → `{ cms, hermano }` de la tarea 7; `POST /auth/logout` con `{ area }` de la tarea 8.
- Produces:
  - Estado: `{ status: AuthStatus; cms: AuthUser | null; hermano: AuthUser | null }`
  - `entrarSesion(area: AreaSesion, user: AuthUser): void`
  - `salirSesion(area?: AreaSesion): void` — sin área, vacía las dos
  - `sesionActual(): Promise<{ cms: AuthUser | null; hermano: AuthUser | null }>`
  - `cerrarSesion(area: AreaSesion): Promise<void>`
  - `login(email, password, recordarme, contexto)` — sin cambios de firma
  - Sigue exportándose `isStaffRole`.
- El campo `user` **desaparece** del store. Lo que deje de compilar es la lista de pantallas que hay que revisar en la tarea 10.

- [ ] **Step 1: Escribir el test que falla**

Crea `desamparados-web/src/features/members/auth/__tests__/store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../store'

const HERMANO = { id: 1, email: 'juan@ejemplo.es', role: 'USER', perfiles: [], origen: 'hermanos' as const }
const TESORERO = { id: 1, email: 'juan@ejemplo.es', role: 'TESORERIA', perfiles: [], origen: 'cms' as const }

describe('el estado de sesión', () => {
  beforeEach(() => { useAuthStore.setState({ status: 'cargando', cms: null, hermano: null }) })

  it('guarda las dos sesiones a la vez', () => {
    // El mismo correo entra al CMS como Tesorero y al portal como hermano.
    useAuthStore.getState().entrarSesion('cms', TESORERO)
    useAuthStore.getState().entrarSesion('hermanos', HERMANO)
    expect(useAuthStore.getState().cms?.role).toBe('TESORERIA')
    expect(useAuthStore.getState().hermano?.role).toBe('USER')
  })

  it('salir de un área no toca la otra', () => {
    useAuthStore.getState().entrarSesion('cms', TESORERO)
    useAuthStore.getState().entrarSesion('hermanos', HERMANO)
    useAuthStore.getState().salirSesion('hermanos')
    expect(useAuthStore.getState().hermano).toBeNull()
    expect(useAuthStore.getState().cms?.role).toBe('TESORERIA')
  })

  it('salir sin área vacía las dos', () => {
    useAuthStore.getState().entrarSesion('cms', TESORERO)
    useAuthStore.getState().entrarSesion('hermanos', HERMANO)
    useAuthStore.getState().salirSesion()
    expect(useAuthStore.getState().cms).toBeNull()
    expect(useAuthStore.getState().hermano).toBeNull()
  })
})
```

- [ ] **Step 2: Ejecutar para comprobar que falla**

```bash
cd desamparados-web && rtk npx vitest run src/features/members/auth
```

Esperado: FALLA.

- [ ] **Step 3: Reescribir el store**

En `desamparados-web/src/features/members/auth/store.ts`, sustituye el bloque del estado (deja `AuthPerfil`, `AuthUser`, `CLAVE_PERSISTENCIA_ANTIGUA` e `isStaffRole` como están):

```ts
export type AreaSesion = 'cms' | 'hermanos'

/**
 * `cargando` es el estado inicial: todavía no sabemos qué sesiones hay porque
 * la respuesta de /api/auth/me no ha llegado. Los guardas de ruta deben esperar
 * en lugar de mandar al login, o expulsarían a quien sí tiene sesión.
 */
export type AuthStatus = 'cargando' | 'listo'

interface AuthState {
  status: AuthStatus
  /**
   * Una sesión por área, independientes. La misma persona puede estar dentro
   * del CMS como Tesorero y dentro del portal como hermano: antes compartían
   * cookie y la segunda tiraba a la primera.
   */
  cms: AuthUser | null
  hermano: AuthUser | null
  entrarSesion: (area: AreaSesion, user: AuthUser) => void
  salirSesion: (area?: AreaSesion) => void
}

// Sin persist: las sesiones viven en cookies httpOnly y el navegador no guarda
// aquí ni el token ni los datos personales.
export const useAuthStore = create<AuthState>()((set) => ({
  status: 'cargando',
  cms: null,
  hermano: null,
  entrarSesion: (area, user) =>
    set(area === 'cms' ? { status: 'listo', cms: user } : { status: 'listo', hermano: user }),
  salirSesion: (area) =>
    set(
      area === 'cms' ? { status: 'listo', cms: null }
      : area === 'hermanos' ? { status: 'listo', hermano: null }
      : { status: 'listo', cms: null, hermano: null },
    ),
}))
```

> `AuthStatus` pasa de tres valores a dos. `autenticado` e `invitado` dejan de tener sentido cuando hay dos sesiones: lo que dice si estás dentro de un área es que su campo no sea `null`. `cargando` se queda porque los guardas lo necesitan.

- [ ] **Step 4: Adaptar la llamada a la API**

En `desamparados-web/src/lib/api/auth.ts`:

```ts
/**
 * Las sesiones abiertas, una por área. Responde 200 aunque no haya ninguna:
 * para un visitante eso es lo normal, no un error.
 */
export function sesionActual() {
  return apiFetch<{ cms: AuthUser | null; hermano: AuthUser | null }>('/auth/me', { auth: false })
}

/** Cierra la sesión de un área. La del área contraria no se toca. */
export function cerrarSesionApi(area: 'cms' | 'hermanos') {
  return apiFetch<null>('/auth/logout', { method: 'POST', auth: false, json: { area } })
}
```

- [ ] **Step 5: Adaptar el arranque y el cierre**

En `desamparados-web/src/features/members/auth/session.ts`:

```ts
// Solo un 401 decía «no hay sesión», pero /auth/me ya no devuelve 401 nunca:
// solo quedan los fallos pasajeros que sí merecen reintento.
const esPasajero = (error: unknown) =>
  !(error instanceof ApiError) || error.status === 429 || error.status >= 500
```

En `useCargarSesion`, sustituye el `.then`:

```ts
    preguntarSesion()
      .then(({ cms, hermano }) => {
        const { entrarSesion, salirSesion } = useAuthStore.getState()
        // `salirSesion` deja el estado en 'listo' aunque no haya ninguna: sin
        // esto los guardas se quedarían esperando para siempre a un invitado.
        salirSesion()
        if (cms) entrarSesion('cms', cms)
        if (hermano) entrarSesion('hermanos', hermano)
      })
      .catch(() => useAuthStore.getState().salirSesion())
```

Y el cierre:

```ts
/** Cierra la sesión de un área en el servidor (que borra su cookie) y luego en el cliente. */
export async function cerrarSesion(area: 'cms' | 'hermanos'): Promise<void> {
  try {
    await cerrarSesionApi(area)
  } catch {
    // Si el servidor no responde, al menos limpiamos el estado local.
  }
  useAuthStore.getState().salirSesion(area)
}
```

- [ ] **Step 6: Ejecutar el test del store y ver qué se ha roto**

```bash
cd desamparados-web && rtk npx vitest run src/features/members/auth && rtk npx tsc -b --noEmit
```

Esperado: los tres tests PASAN, y el typecheck saca la lista de pantallas que usaban `state.user` o `status === 'autenticado'`. **Esa lista es la tarea 10.**

- [ ] **Step 7: Commit**

```bash
rtk git add desamparados-web/src/features/members/auth desamparados-web/src/lib/api/auth.ts
rtk git commit -F - <<'EOF'
Guardar una sesión por área en el frontend

El estado tenía un solo `user` porque el servidor tenía una sola cookie.
Ahora hay dos sesiones independientes y el arranque pregunta por las dos de
una vez.

`autenticado` e `invitado` desaparecen del estado: con dos áreas, lo que dice
si estás dentro de una es que su sesión no sea nula. Queda `cargando`, que es
lo que necesitan los guardas para no echar a quien sí tiene sesión.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

### Task 10: Guardas de ruta y cierre de sesión por área

**Files:**
- Modify: `desamparados-web/src/routes/RequireAuth.tsx`
- Modify: `desamparados-web/src/routes/RequireRole.tsx`
- Modify: `desamparados-web/src/lib/api/client.ts`
- Modify: `desamparados-web/src/app/AdminLayout.tsx`
- Modify: `desamparados-web/src/app/BrotherLayout.tsx`
- Modify: `desamparados-web/src/features/members/auth/LoginPage.tsx`
- Modify: `desamparados-web/src/features/members/auth/CmsLoginPage.tsx`
- Modify: todo lo que el typecheck de la tarea 9 haya sacado
- Test: `desamparados-web/src/routes/__tests__/guardas.test.tsx` *(crear)*

**Interfaces:**
- Consumes: el store de la tarea 9.
- Produces: nada nuevo. `SESION_NO_CMS` se conserva en `client.ts` como constante exportada, pero **`sesionPerdidaParaCms()` se borra**: con cookies separadas la sesión del CMS ya no la puede pisar nadie.

- [ ] **Step 1: Escribir los tests que fallan**

Crea `desamparados-web/src/routes/__tests__/guardas.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/test-utils'
import RequireAuth from '../RequireAuth'
import RequireRole from '../RequireRole'
import { useAuthStore } from '../../features/members/auth/store'

const TESORERO = { id: 1, email: 'a@b.es', role: 'TESORERIA', perfiles: [], origen: 'cms' as const }
const HERMANO = { id: 1, email: 'a@b.es', role: 'USER', perfiles: [], origen: 'hermanos' as const }
const Dentro = () => <p>dentro</p>

describe('los guardas de ruta', () => {
  beforeEach(() => { useAuthStore.setState({ status: 'listo', cms: null, hermano: null }) })

  it('el área de hermanos se abre con la sesión de hermanos', () => {
    useAuthStore.setState({ status: 'listo', cms: null, hermano: HERMANO })
    renderWithProviders(<RequireAuth><Dentro /></RequireAuth>, { ruta: '/area-hermano/perfil' })
    expect(screen.getByText('dentro')).toBeInTheDocument()
  })

  it('el CMS se abre con la sesión del CMS aunque no haya la de hermanos', () => {
    useAuthStore.setState({ status: 'listo', cms: TESORERO, hermano: null })
    renderWithProviders(
      <RequireRole roles={['TESORERIA']}><Dentro /></RequireRole>, { ruta: '/cms/tesoreria' },
    )
    expect(screen.getByText('dentro')).toBeInTheDocument()
  })

  it('estar dentro del portal del hermano no abre el CMS', () => {
    // El segundo factor solo se pide en /cms/acceso.
    useAuthStore.setState({ status: 'listo', cms: null, hermano: HERMANO })
    renderWithProviders(
      <RequireRole roles={['TESORERIA']}><Dentro /></RequireRole>, { ruta: '/cms/tesoreria' },
    )
    expect(screen.queryByText('dentro')).not.toBeInTheDocument()
  })

  it('estar dentro del CMS no abre el portal del hermano', () => {
    useAuthStore.setState({ status: 'listo', cms: TESORERO, hermano: null })
    renderWithProviders(<RequireAuth><Dentro /></RequireAuth>, { ruta: '/area-hermano/perfil' })
    expect(screen.queryByText('dentro')).not.toBeInTheDocument()
  })

  it('las dos sesiones a la vez abren las dos zonas', () => {
    // Es el hallazgo: el Tesorero quiere administrar y ver su perfil de hermano.
    useAuthStore.setState({ status: 'listo', cms: TESORERO, hermano: HERMANO })
    const { unmount } = renderWithProviders(
      <RequireRole roles={['TESORERIA']}><Dentro /></RequireRole>, { ruta: '/cms/tesoreria' },
    )
    expect(screen.getByText('dentro')).toBeInTheDocument()
    unmount()
    renderWithProviders(<RequireAuth><Dentro /></RequireAuth>, { ruta: '/area-hermano/perfil' })
    expect(screen.getByText('dentro')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar para comprobar que falla**

```bash
cd desamparados-web && rtk npx vitest run src/routes
```

Esperado: FALLA.

- [ ] **Step 3: Reescribir los guardas**

`RequireAuth.tsx`:

```tsx
export default function RequireAuth({ children }: RequireAuthProps) {
  const status = useAuthStore((state) => state.status)
  const hermano = useAuthStore((state) => state.hermano)
  const location = useLocation()

  // Mientras no sepamos qué sesiones hay no podemos mandar a nadie al login:
  // expulsaría a quien sí la tiene cada vez que recarga la página.
  if (status === 'cargando') return <PageLoader />

  // Solo la sesión del área de hermanos abre el área de hermanos. Estar dentro
  // del CMS no es estar dentro del portal: son dos accesos distintos.
  if (!hermano) {
    return <Navigate to="/hermanos/acceso" state={{ from: location }} replace />
  }

  return <>{children}</>
}
```

`RequireRole.tsx`:

```tsx
export default function RequireRole({ roles, children }: RequireRoleProps) {
  const status = useAuthStore((state) => state.status)
  const cms = useAuthStore((state) => state.cms)
  const location = useLocation()

  if (status === 'cargando') return <PageLoader />

  // El CMS tiene acceso propio, con segundo factor. Sin su sesión se va allí,
  // con `from` para volver a la página que pedía. Tener abierta la del portal
  // del hermano no cuenta: esa no ha pasado el 2FA.
  if (!cms) return <Navigate to="/cms/acceso" state={{ from: location }} replace />
  if (!roles.includes(cms.role)) return <Navigate to="/cms" replace />

  return <>{children}</>
}
```

> Ojo: el `Navigate to="/area-hermano"` de antes, cuando el rol no llegaba, mandaba al CMS a un sitio donde ahora puede no haber sesión. Va al Inicio del CMS, que todos los cargos ven.

- [ ] **Step 4: Quitar el rescate de sesión perdida**

En `desamparados-web/src/lib/api/client.ts`:
- Borra `sesionPerdidaParaCms()`, la variable `reconsultandoSesion` y la línea `if (res.status === 403 && codigoDeError(payload) === SESION_NO_CMS) sesionPerdidaParaCms()`.
- Deja exportada la constante `SESION_NO_CMS` con su comentario actualizado: ya no significa «otra pestaña te ha pisado la cookie», sino «has llegado al CMS sin haber entrado por su acceso».
- En el manejo del 401, sustituye `useAuthStore.getState().salirSesion()` por una versión que no tire las dos sesiones a la vez. Como el cliente no sabe de qué área era la petición, lo correcto es **volver a preguntar**:

```ts
    if (res.status === 401 && auth) {
      // Una de las dos sesiones ha caducado o se ha revocado, pero desde aquí
      // no sabemos cuál: la petición no lleva el área. Preguntamos al servidor,
      // que devuelve las dos, en vez de tirar las dos a ciegas y echar de la
      // buena a quien seguía dentro.
      void refrescarSesiones()
    }
```

con:

```ts
let refrescando: Promise<void> | null = null

/** Una sola consulta aunque fallen a la vez todas las peticiones de la pantalla. */
function refrescarSesiones(): Promise<void> {
  refrescando ??= import('./auth')
    .then(({ sesionActual }) => sesionActual())
    .then(({ cms, hermano }) => {
      const { entrarSesion, salirSesion } = useAuthStore.getState()
      salirSesion()
      if (cms) entrarSesion('cms', cms)
      if (hermano) entrarSesion('hermanos', hermano)
    })
    .catch(() => useAuthStore.getState().salirSesion())
    .finally(() => { refrescando = null })
  return refrescando
}
```

- [ ] **Step 5: Cierre de sesión en cada layout**

- `AdminLayout.tsx`, en `BloqueUsuario`: `onClick={() => { void cerrarSesion('cms') }}`, y el rol sale de `useAuthStore((s) => s.cms?.role)`.
- `BrotherLayout.tsx`: `cerrarSesion('hermanos')`, y los datos del usuario de `useAuthStore((s) => s.hermano)`.

- [ ] **Step 6: Los dos accesos**

- `LoginPage.tsx` (área de hermanos): al entrar, `entrarSesion('hermanos', user)`; si ya hay `hermano`, redirige al área.
- `CmsLoginPage.tsx`: `entrarSesion('cms', user)`; si ya hay `cms`, redirige al CMS.

Comprueba que cada uno sigue mandando su `contexto` a `login()` (`'hermanos'` y `'cms'`).

- [ ] **Step 7: Arreglar lo que quede**

```bash
cd desamparados-web && rtk npx tsc -b --noEmit
```

Recorre la lista y sustituye cada `state.user` por `state.cms` o `state.hermano` según **dónde viva la pantalla**: todo lo de `features/cms/` y `app/AdminLayout` es `cms`; todo lo de `features/brotherArea/` y `app/BrotherLayout` es `hermano`. Ante la duda, mira la ruta en `routes/index.tsx`.

- [ ] **Step 8: Ejecutar todo**

```bash
cd desamparados-web && rtk npm test && rtk npx tsc -b --noEmit && rtk npm run lint
```

Esperado: todo en verde. En `AdminLayout.test.tsx` hay que cambiar el `entrarComo` para que escriba en `cms`:

```tsx
function entrarComo(role: string) {
  useAuthStore.setState({
    status: 'listo',
    cms: { id: 1, email: 'prueba@ejemplo.es', role, perfiles: [], origen: 'cms' },
    hermano: null,
  })
}
```

- [ ] **Step 9: Commit**

```bash
rtk git add desamparados-web/src
rtk git commit -F - <<'EOF'
Separar los guardas y el cierre de sesión por área

Cada zona mira su propia sesión: el portal del hermano la de hermanos y el
CMS la del CMS, que es la única que ha pasado el segundo factor. Y cada
«Cerrar sesión» cierra solo la suya.

Se va el rescate de «sesión perdida para el CMS»: existía porque la cookie
era compartida y otra pestaña te la pisaba. Con dos cookies no puede pasar.
Un 401 ya no vacía las dos sesiones a ciegas, sino que vuelve a preguntar
cuáles siguen vivas.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

### Task 11: Comprobación de extremo a extremo

**Files:**
- Test: `backend-desamparados/test/sesiones-por-area.test.ts` *(ampliar con el recorrido completo)*

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada. Es la red que dice que el hallazgo del usuario está cerrado.

- [ ] **Step 1: Escribir el recorrido del usuario**

```ts
test('el recorrido del hallazgo: CMS y portal del hermano a la vez', async (t) => {
  if (!dbDisponible) return t.skip(motivoSinDb);

  // Tal y como lo contó: estaba dentro del CMS, entró con otra cuenta como
  // hermano para ver su perfil, y al volver a Contabilidad le dijo que su
  // sesión no tenía acceso a la administración.
  const tesorero = await crearUsuarioPrueba(Role.TESORERIA);
  creados.push(tesorero.id);

  const entrar = (contexto: 'cms' | 'hermanos') => fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: tesorero.email, password: PASSWORD_PRUEBA, contexto }),
  });

  const enCms = await entrar('cms');
  const cookieCms = enCms.headers.getSetCookie().find((c) => c.startsWith(`${COOKIE_CMS}=`))!.split(';')[0];

  const enPortal = await entrar('hermanos');
  const cookieHermano = enPortal.headers.getSetCookie().find((c) => c.startsWith(`${COOKIE_HERMANO}=`))!.split(';')[0];

  const lasDos = `${cookieCms}; ${cookieHermano}`;

  // Contabilidad, que es donde le saltó el aviso.
  const contabilidad = await fetch(`${baseUrl}/api/transacciones?page=1&limit=1`, { headers: { cookie: lasDos } });
  assert.notEqual(contabilidad.status, 403, 'ya no puede decir que la sesión no tiene acceso');
  assert.notEqual(contabilidad.status, 401);

  // Y su perfil de hermano, en la otra pestaña.
  const perfil = await fetch(`${baseUrl}/api/hermanos/mis-perfiles`, { headers: { cookie: lasDos } });
  assert.equal(perfil.status, 200);

  // Las dos siguen vivas después de usarlas.
  const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: lasDos } });
  const cuerpo = await me.json();
  assert.ok(cuerpo.cms, 'la del CMS sigue');
  assert.ok(cuerpo.hermano, 'la del portal sigue');
});
```

> Comprueba en `src/routes/transaccion.routes.ts` cuál es la ruta real de contabilidad y ajústala.

- [ ] **Step 2: Ejecutar**

```bash
cd backend-desamparados && rtk npm test
```

Esperado: PASA.

- [ ] **Step 3: Probarlo a mano, que es como se encontró**

Con el backend y la web levantados:
1. Entra en `/cms/acceso` con una cuenta de Tesorería y abre Contabilidad.
2. En **otra pestaña**, entra en `/hermanos/acceso` con la misma cuenta y mira tu perfil.
3. Vuelve a la primera pestaña y navega por el CMS. **No debe salir ningún aviso de sesión.**
4. Cierra sesión en el área de hermanos. El CMS sigue dentro.
5. Cierra sesión en el CMS. El área de hermanos ya estaba fuera; comprueba que no quedan cookies de sesión en el navegador.

- [ ] **Step 4: Commit**

```bash
rtk git add backend-desamparados/test/sesiones-por-area.test.ts
rtk git commit -F - <<'EOF'
Fijar por test el recorrido que destapó el fallo

Entrar al CMS, entrar además al portal del hermano con la misma cuenta y
volver a Contabilidad sin que salte «tu sesión actual no tiene acceso a la
administración». Es exactamente lo que el usuario hizo cuando lo encontró.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01T2tp3QYaEXhStLa4feu76D
EOF
```

---

## Al terminar la fase

1. Los dos proyectos en verde: `rtk npm test` en cada uno, más `rtk npx tsc -b --noEmit` y `rtk npm run lint` en el frontend.
2. `rtk grep "COOKIE_SESION\|state.user\b\|'autenticado'\|'invitado'"` sobre los dos proyectos: no debe quedar ninguno.
3. El recorrido a mano de la tarea 11, paso a paso.
4. La fase 3 (renombrado completo de «papeleta de sitio») va a continuación y tendrá su propio plan.
