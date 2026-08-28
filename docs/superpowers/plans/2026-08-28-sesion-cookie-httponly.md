# Sesión en cookie httpOnly — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover el JWT de sesión de `localStorage` a una cookie `httpOnly` con `SameSite=Strict`, y vincular el segundo factor al primero.

**Architecture:** El backend deja de leer la cabecera `Authorization` y pasa a leer dos cookies: una de sesión y otra de paso intermedio del 2FA, distinguidas por un claim `typ` que impide usar una en lugar de la otra. El frontend deja de guardar nada en `localStorage` y recupera la sesión al arrancar con `GET /api/auth/me`.

**Tech Stack:** Express 5, `jsonwebtoken`, `cookie-parser`, Prisma/MariaDB, arktype (backend). React 19, zustand, react-hook-form, zod, Vitest (frontend). Tests de backend con el runner de Node (`tsx --test`).

**Spec:** `docs/superpowers/specs/2026-08-28-sesion-cookie-httponly-design.md`

## ESTADO: implementado, pendiente de verificar con MariaDB

Las 12 tareas están implementadas en la rama `sesion-cookie-httponly` (13
commits). Verificado en la máquina de desarrollo: typecheck de ambos proyectos,
lint, build del front, **54 tests de backend y 35 de frontend en verde**.

**Falta ejecutarlo donde haya MariaDB.** Los 6 tests de la Task 6 y 7 se omiten
solos sin base de datos, así que hoy *ninguna prueba ha demostrado que una
cookie de sesión válida funcione*: las verdes prueban que las peticiones sin
credenciales se rechazan, no que las correctas se acepten.

Pendiente, por orden:

```bash
git fetch && git checkout sesion-cookie-httponly

cd backend-desamparados
npm ci                      # cookie-parser es dependencia nueva
npx prisma generate
npx prisma migrate deploy
npm test                    # los 6 deben pasar, no omitirse
```

Si alguno se omite, MariaDB no está accesible y la ejecución no demuestra nada.
Después, la comprobación manual en el navegador de la Task 12, Step 1.

---

## Global Constraints

- **Nomenclatura**: la corporación es **Grupo Parroquial**, nunca «Hermandad» ni «Cofradía». Los miembros sí son «hermanos».
- **No se acepta la cabecera `Authorization` en ningún camino.** Sin rutas dobles.
- **`Secure` solo en producción** (`process.env.NODE_ENV === 'production'`): en local se sirve por `http://` y el navegador descartaría la cookie.
- **Atributos obligatorios de ambas cookies**: `HttpOnly`, `SameSite=Strict`.
- **`Path` de la cookie de sesión: `/api`.** **`Path` de la cookie de 2FA: `/api/auth`.**
- **Borrar una cookie exige repetir su `Path` exacto**, o el navegador ignora el borrado en silencio.
- Roles staff del CMS: `ADMIN`, `TESORERIA`, `ALBACERIA`, `HERMANO_MAYOR`, `REDES`, `SECRETARIA`. Todo lo demás es `USER`.
- Duración: **staff 8 h, `USER` 4 h**. La cookie de staff **no lleva `Max-Age`** (muere al cerrar el navegador); la de `USER` lleva `Max-Age` de 4 h.
- **El typecheck del frontend es `npx tsc -b`, no `npx tsc --noEmit`.** El proyecto usa *project references*: sin `-b`, tsc no comprueba nada y da un falso verde. En el backend sí vale `--noEmit`.
- El backend exige seis variables de entorno solo para arrancar: `DATABASE_URL`, `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `JWT_SECRET`. Sin ellas no importa ni `app`.
- **`dotenv` no se carga solo.** Solo lo cargan `src/config/db.ts` y `src/index.ts`. Cualquier test que importe un módulo suelto debe empezar por `import 'dotenv/config';`.
- Los tests que necesitan MariaDB deben omitirse solos si no está levantada, siguiendo el patrón que ya usa `test/integration.test.ts`.

**Nota sobre el orden:** las tareas 1-7 (backend) dejan la aplicación temporalmente rota para el navegador, porque el front seguirá mandando `Authorization` hasta la tarea 11. Es esperado. Los tests pasan en todo momento.

**Las tareas 6 y 7 exigen MariaDB levantada.** Sin ella sus pruebas se omiten solas y no demuestran nada.

---

### Task 1: Los JWT llevan `typ` y duración por rol

**Files:**
- Modify: `backend-desamparados/src/utils/jwt.handle.ts`
- Test: `backend-desamparados/test/jwt-tipos.test.ts` (crear)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type TokenType = 'session' | '2fa_pending'`
  - `interface AuthTokenPayload extends JwtPayload { id: number; role: string; typ: TokenType }`
  - `esStaff(role: string): boolean`
  - `duracionSesionSegundos(role: string): number`
  - `PENDIENTE_2FA_SEGUNDOS: number`
  - `generateToken(userId: number, role: string): string`
  - `generatePending2FAToken(userId: number): string`
  - `verifyToken(jwtToken: string, expectedType: TokenType): AuthTokenPayload | null`

- [ ] **Step 1: Escribir el test que falla**

Crear `backend-desamparados/test/jwt-tipos.test.ts`:

```ts
// dotenv no se carga solo al importar un módulo suelto: sin esto no hay JWT_SECRET
import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  generateToken,
  generatePending2FAToken,
  verifyToken,
  duracionSesionSegundos,
  esStaff
} from '../src/utils/jwt.handle.js';

// El caso que justifica todo el claim `typ`: el testigo de 2FA ya identifica a un
// usuario, así que si valiera como token de sesión permitiría saltarse el segundo
// factor por completo.
test('un testigo de 2FA no vale como token de sesión', () => {
  assert.equal(verifyToken(generatePending2FAToken(7), 'session'), null);
});

test('un token de sesión no vale como testigo de 2FA', () => {
  assert.equal(verifyToken(generateToken(7, 'USER'), '2fa_pending'), null);
});

test('cada token se verifica correctamente con su propio tipo', () => {
  assert.equal(verifyToken(generateToken(7, 'USER'), 'session')?.id, 7);
  assert.equal(verifyToken(generatePending2FAToken(7), '2fa_pending')?.id, 7);
});

test('un token con la firma manipulada no vale', () => {
  const token = generateToken(7, 'USER');
  assert.equal(verifyToken(token.slice(0, -2) + 'xx', 'session'), null);
});

test('el staff del CMS dura 8 h y los hermanos 4 h', () => {
  assert.equal(duracionSesionSegundos('SECRETARIA'), 8 * 3600);
  assert.equal(duracionSesionSegundos('ADMIN'), 8 * 3600);
  assert.equal(duracionSesionSegundos('USER'), 4 * 3600);
});

test('esStaff distingue los roles con acceso al CMS', () => {
  assert.equal(esStaff('TESORERIA'), true);
  assert.equal(esStaff('USER'), false);
});
```

- [ ] **Step 2: Ejecutar el test y comprobar que falla**

```bash
cd backend-desamparados && npx tsx --test test/jwt-tipos.test.ts
```

Esperado: FALLA. `verifyToken` todavía acepta un solo argumento y no existen `generatePending2FAToken`, `duracionSesionSegundos` ni `esStaff`.

- [ ] **Step 3: Implementar**

En `backend-desamparados/src/utils/jwt.handle.ts`, sustituir desde la definición de `AuthTokenPayload` hasta el final del fichero por:

```ts
import { Role } from '@prisma/client';

/**
 * Los dos JWT los firma el mismo secreto, así que sin un claim que los
 * distinga el testigo de "2FA pendiente" —que ya identifica a un usuario—
 * serviría como token de sesión y permitiría saltarse el segundo factor.
 */
export type TokenType = 'session' | '2fa_pending';

export interface AuthTokenPayload extends JwtPayload {
  id: number;
  role: string;
  typ: TokenType;
}

// Roles con acceso al CMS. Su sesión dura más, pero la cookie muere al cerrar
// el navegador (ver utils/cookies.ts): se usan desde equipos compartidos.
const ROLES_STAFF: string[] = [
  Role.ADMIN,
  Role.TESORERIA,
  Role.ALBACERIA,
  Role.HERMANO_MAYOR,
  Role.REDES,
  Role.SECRETARIA
];

export const esStaff = (role: string): boolean => ROLES_STAFF.includes(role);

/** 8 h para el staff del CMS, 4 h para los hermanos del área familiar */
export const duracionSesionSegundos = (role: string): number =>
  esStaff(role) ? 8 * 3600 : 4 * 3600;

/** El paso intermedio del 2FA caduca pronto: es solo para teclear un código */
export const PENDIENTE_2FA_SEGUNDOS = 5 * 60;

const generateToken = (userId: number, role: string): string =>
  jwt.sign(
    { id: userId, role, typ: 'session' },
    JWT_SECRET,
    { expiresIn: duracionSesionSegundos(role), algorithm: 'HS256' }
  );

/**
 * Prueba de que se superó el primer factor (la contraseña). Sin esto, el
 * endpoint del 2FA aceptaba un userId suelto del body y el segundo factor
 * quedaba desvinculado del primero.
 */
const generatePending2FAToken = (userId: number): string =>
  jwt.sign(
    { id: userId, role: '', typ: '2fa_pending' },
    JWT_SECRET,
    { expiresIn: PENDIENTE_2FA_SEGUNDOS, algorithm: 'HS256' }
  );

const verifyToken = (jwtToken: string, expectedType: TokenType): AuthTokenPayload | null => {
  try {
    // algorithms explícito: defendemos contra tokens firmados con otro algoritmo (ej. 'none')
    const payload = jwt.verify(jwtToken, JWT_SECRET, { algorithms: ['HS256'] }) as AuthTokenPayload;
    if (payload.typ !== expectedType) return null;
    return payload;
  } catch (e) {
    return null;
  }
};

export { generateToken, generatePending2FAToken, verifyToken };
```

- [ ] **Step 4: Ejecutar el test y comprobar que pasa**

```bash
cd backend-desamparados && npx tsx --test test/jwt-tipos.test.ts
```

Esperado: PASA, 6 tests.

- [ ] **Step 5: Comprobar que el resto compila (fallará, y es lo esperado)**

```bash
cd backend-desamparados && npx tsc --noEmit
```

Esperado: FALLA en `src/middleware/session.ts` y `src/middleware/optionalAuth.ts`, que llaman a `verifyToken` con un solo argumento. Se arreglan en la tarea 3. **No arreglarlo aquí.**

- [ ] **Step 6: Commit**

```bash
git add backend-desamparados/src/utils/jwt.handle.ts backend-desamparados/test/jwt-tipos.test.ts
git commit -m "Distinguir los dos tipos de JWT y dar duracion por rol"
```

---

### Task 2: Cookies, cookie-parser y CORS

**Files:**
- Create: `backend-desamparados/src/utils/cookies.ts`
- Modify: `backend-desamparados/src/app.ts`
- Modify: `backend-desamparados/package.json` (dependencia)
- Test: `backend-desamparados/test/cookies-sesion.test.ts` (crear)

**Interfaces:**
- Consumes: `esStaff`, `duracionSesionSegundos`, `PENDIENTE_2FA_SEGUNDOS` (Task 1).
- Produces:
  - `COOKIE_SESION = 'desamparados_session'`, `COOKIE_2FA = 'desamparados_2fa'`
  - `opcionesCookieSesion(role: string): CookieOptions`
  - `ponerCookieSesion(res: Response, token: string, role: string): void`
  - `ponerCookie2FA(res: Response, token: string): void`
  - `limpiarCookie2FA(res: Response): void`
  - `limpiarCookiesAuth(res: Response): void`

- [ ] **Step 1: Instalar cookie-parser**

```bash
cd backend-desamparados && npm install cookie-parser && npm install -D @types/cookie-parser
```

- [ ] **Step 2: Escribir el test que falla**

Crear `backend-desamparados/test/cookies-sesion.test.ts`:

```ts
import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { opcionesCookieSesion, COOKIE_SESION, COOKIE_2FA } from '../src/utils/cookies.js';

test('la cookie del staff muere al cerrar el navegador', () => {
  const opciones = opcionesCookieSesion('SECRETARIA');
  assert.equal(opciones.maxAge, undefined, 'el staff no debe llevar Max-Age');
  assert.equal(opciones.httpOnly, true);
  assert.equal(opciones.sameSite, 'strict');
  assert.equal(opciones.path, '/api');
});

test('la cookie de un hermano persiste 4 h', () => {
  const opciones = opcionesCookieSesion('USER');
  assert.equal(opciones.maxAge, 4 * 3600 * 1000);
  assert.equal(opciones.httpOnly, true);
  assert.equal(opciones.sameSite, 'strict');
});

test('Secure queda desactivado fuera de produccion', () => {
  assert.equal(opcionesCookieSesion('USER').secure, false);
});

test('los nombres de las cookies son los del contrato', () => {
  assert.equal(COOKIE_SESION, 'desamparados_session');
  assert.equal(COOKIE_2FA, 'desamparados_2fa');
});
```

- [ ] **Step 3: Ejecutar el test y comprobar que falla**

```bash
cd backend-desamparados && npx tsx --test test/cookies-sesion.test.ts
```

Esperado: FALLA, no existe `src/utils/cookies.ts`.

- [ ] **Step 4: Crear el módulo de cookies**

Crear `backend-desamparados/src/utils/cookies.ts`:

```ts
import type { CookieOptions, Response } from 'express';
import { duracionSesionSegundos, esStaff, PENDIENTE_2FA_SEGUNDOS } from './jwt.handle.js';

export const COOKIE_SESION = 'desamparados_session';
export const COOKIE_2FA = 'desamparados_2fa';

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
 * Staff del CMS: sin maxAge, o sea cookie de sesión que muere al cerrar el
 * navegador (el CMS se usa desde equipos compartidos de la casa parroquial).
 * Hermanos: persiste, con el mismo tope que el JWT para que no lo sobreviva.
 */
export const opcionesCookieSesion = (role: string): CookieOptions => ({
  ...base(RUTA_SESION),
  ...(esStaff(role) ? {} : { maxAge: duracionSesionSegundos(role) * 1000 })
});

export const ponerCookieSesion = (res: Response, token: string, role: string): void => {
  res.cookie(COOKIE_SESION, token, opcionesCookieSesion(role));
};

export const ponerCookie2FA = (res: Response, token: string): void => {
  res.cookie(COOKIE_2FA, token, { ...base(RUTA_2FA), maxAge: PENDIENTE_2FA_SEGUNDOS * 1000 });
};

// OJO: borrar una cookie exige repetir su Path exacto. Sin él el navegador
// ignora el borrado y la respuesta sigue siendo un 204 enganoso.
export const limpiarCookie2FA = (res: Response): void => {
  res.clearCookie(COOKIE_2FA, base(RUTA_2FA));
};

export const limpiarCookiesAuth = (res: Response): void => {
  res.clearCookie(COOKIE_SESION, base(RUTA_SESION));
  limpiarCookie2FA(res);
};
```

- [ ] **Step 5: Ejecutar el test y comprobar que pasa**

```bash
cd backend-desamparados && npx tsx --test test/cookies-sesion.test.ts
```

Esperado: PASA, 4 tests.

- [ ] **Step 6: Montar cookie-parser y ajustar CORS**

En `backend-desamparados/src/app.ts`, añadir el import junto a los demás:

```ts
import cookieParser from 'cookie-parser';
```

Sustituir el bloque `app.use(cors({...}))` existente por:

```ts
app.use(cors({
    // '*' es incompatible con credentials, así que en desarrollo reflejamos el origen.
    origin: allowedOrigin ? allowedOrigin : (process.env.NODE_ENV === 'production' ? false : true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    // Ya no se usa Authorization: la sesión viaja en cookie.
    allowedHeaders: ['Content-Type']
}));

// Las cookies de sesión y del paso intermedio del 2FA. Express no las parsea solo.
app.use(cookieParser());
```

- [ ] **Step 7: Commit**

```bash
git add backend-desamparados/src/utils/cookies.ts backend-desamparados/src/app.ts backend-desamparados/package.json backend-desamparados/package-lock.json backend-desamparados/test/cookies-sesion.test.ts
git commit -m "Anadir las cookies de sesion y permitir credenciales en CORS"
```

---

### Task 3: Los middlewares leen la cookie, y se unifica el duplicado

**Files:**
- Modify: `backend-desamparados/src/middleware/session.ts`
- Delete: `backend-desamparados/src/middleware/optionalAuth.ts`
- Modify: `backend-desamparados/src/routes/agenda.routes.ts:4`
- Test: `backend-desamparados/test/integration.test.ts`

**Interfaces:**
- Consumes: `verifyToken(token, 'session')` (Task 1), `COOKIE_SESION` (Task 2).
- Produces: `authenticateToken` y `optionalAuthentication` exportados **solo** desde `middleware/session.ts`.

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `backend-desamparados/test/integration.test.ts`:

```ts
import { generateToken, generatePending2FAToken } from '../src/utils/jwt.handle.js';
import { COOKIE_SESION } from '../src/utils/cookies.js';

test('sin cookie, una ruta privada responde 401', async () => {
  const res = await fetch(`${baseUrl}/api/auth/mis-datos`);
  assert.equal(res.status, 401);
});

test('la cabecera Authorization ya no autentica', async () => {
  const res = await fetch(`${baseUrl}/api/auth/mis-datos`, {
    headers: { Authorization: `Bearer ${generateToken(1, 'ADMIN')}` }
  });
  assert.equal(res.status, 401);
});

// El caso crítico: el testigo del 2FA identifica a un usuario, pero no puede
// servir de sesión. Falla antes de tocar la base de datos, así que no la necesita.
test('el testigo de 2FA no sirve como cookie de sesion', async () => {
  const res = await fetch(`${baseUrl}/api/auth/mis-datos`, {
    headers: { Cookie: `${COOKIE_SESION}=${generatePending2FAToken(1)}` }
  });
  assert.equal(res.status, 401);
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

```bash
cd backend-desamparados && npx tsx --test test/integration.test.ts
```

Esperado: FALLA. El test de `Authorization` devuelve 500 (llega a la BD) o 200 en vez de 401, porque el middleware todavía lee la cabecera.

- [ ] **Step 3: Implementar**

En `backend-desamparados/src/middleware/session.ts`, cambiar los imports:

```ts
import { verifyToken, AuthTokenPayload } from "../utils/jwt.handle.js";
import { COOKIE_SESION } from "../utils/cookies.js";
import db from "../config/db.js";
```

Sustituir el cuerpo de `authenticateToken` y `optionalAuthentication` por:

```ts
// 2. MIDDLEWARE ESTRICTO (Si no hay sesión, bloquea)
export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.[COOKIE_SESION];

    if (!token) {
      return res.status(401).json({ error: "NO_TOKEN_PROVIDED", message: "Se requiere una sesión iniciada" });
    }

    // El tipo esperado es obligatorio: un testigo de 2FA colado en esta cookie
    // no puede valer como sesión.
    const decodedPayload = verifyToken(token, 'session');

    if (!decodedPayload) {
      return res.status(401).json({ error: "INVALID_TOKEN", message: "El token ha expirado o es inválido" });
    }

    const validPayload = await validateSessionAgainstDb(decodedPayload);
    if (!validPayload) {
      return res.status(401).json({ error: "SESSION_REVOKED", message: "Tu sesión ha sido invalidada. Vuelve a iniciar sesión." });
    }

    req.user = validPayload;
    next();

  } catch (e: any) {
    res.status(401).json({ error: "INVALID_SESSION", message: "Error crítico en la autenticación" });
  }
};

// 3. MIDDLEWARE OPCIONAL (Si no hay sesión, lo deja pasar como invitado)
export const optionalAuthentication = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.[COOKIE_SESION];

    if (!token) {
      req.user = undefined;
      return next();
    }

    const payload = verifyToken(token, 'session');

    // Token válido según firma: lo validamos también contra BD (rol fresco, no revocado).
    // Si la BD lo invalida, tratamos al visitante como invitado en lugar de bloquearlo.
    req.user = payload ? (await validateSessionAgainstDb(payload)) ?? undefined : undefined;
    next();

  } catch (e) {
    req.user = undefined;
    next();
  }
};
```

- [ ] **Step 4: Borrar el middleware duplicado y repuntar la agenda**

`src/middleware/optionalAuth.ts` exporta otro `optionalAuthentication` que **no valida contra la base de datos**: no ve revocaciones ni degradaciones de rol.

```bash
cd backend-desamparados && rm src/middleware/optionalAuth.ts
```

En `src/routes/agenda.routes.ts` línea 4, cambiar:

```ts
import { optionalAuthentication } from '../middleware/optionalAuth.js';
```

por:

```ts
import { optionalAuthentication } from '../middleware/session.js';
```

- [ ] **Step 5: Ejecutar los tests y el typecheck**

```bash
cd backend-desamparados && npx tsc --noEmit && npm test
```

Esperado: typecheck limpio y todos los tests en verde (los que necesitan MariaDB se omiten solos si no está levantada).

- [ ] **Step 6: Commit**

```bash
git add backend-desamparados/src/middleware/session.ts backend-desamparados/src/routes/agenda.routes.ts backend-desamparados/test/integration.test.ts
git rm backend-desamparados/src/middleware/optionalAuth.ts
git commit -m "Leer la sesion de la cookie y unificar el middleware opcional"
```

---

### Task 4: Login y 2FA emiten cookies, y el 2FA exige el testigo

**Files:**
- Modify: `backend-desamparados/src/services/auth.service.ts` (métodos `login` y `verifyLogin2FA`)
- Modify: `backend-desamparados/src/controllers/auth.controller.ts:29-55`
- Modify: `backend-desamparados/src/schemas/auth.schema.ts:72-77`
- Test: `backend-desamparados/test/integration.test.ts`

**Interfaces:**
- Consumes: `generatePending2FAToken`, `verifyToken` (Task 1); `ponerCookieSesion`, `ponerCookie2FA`, `limpiarCookie2FA`, `limpiarCookiesAuth`, `COOKIE_2FA` (Task 2).
- Produces:
  - `POST /api/auth/login` responde `{ status: 'OK', user }` o `{ status: '2FA_NEEDED', message }`. **Nunca devuelve el token ni el userId en el cuerpo.**
  - `POST /api/auth/login/2fa` recibe `{ token2fa }` y responde `{ status: 'OK', user }`.

- [ ] **Step 1: Escribir el test que falla**

Añadir a `backend-desamparados/test/integration.test.ts`:

```ts
// Sin la cookie del primer factor no se entra, aunque el código fuera correcto.
// Esto es el fallo que cerramos: antes bastaba con mandar { userId, token2fa }.
test('el 2FA sin el testigo del primer factor responde 401', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login/2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token2fa: '123456' })
  });
  assert.equal(res.status, 401);
});

test('el 2FA ya no acepta un userId en el cuerpo', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login/2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 1, token2fa: '123456' })
  });
  // 401 por falta de testigo, nunca 200: el userId del cuerpo se ignora
  assert.equal(res.status, 401);
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

```bash
cd backend-desamparados && npx tsx --test test/integration.test.ts
```

Esperado: FALLA. Hoy responde 500 (llega a la base de datos) o 400 de validación, no 401.

- [ ] **Step 3: Quitar el userId del esquema**

En `backend-desamparados/src/schemas/auth.schema.ts`, sustituir `verify2FASchema`:

```ts
// El usuario ya no viaja en el cuerpo: sale de la cookie del primer factor.
export const verify2FASchema = type({
    body: {
        token2fa: codigo2FASchema
    }
});
```

- [ ] **Step 4: El servicio devuelve el testigo en lugar del userId**

En `backend-desamparados/src/services/auth.service.ts`, cambiar el import de la línea 3:

```ts
import { generateToken, generatePending2FAToken } from '../utils/jwt.handle';
```

Sustituir el bloque de 2FA del método `login` (donde hoy devuelve `status: '2FA_NEEDED'`) por:

```ts
    // --- LÓGICA 2FA ---
    if (user.twoFactorEnabled) {
      return {
        status: '2FA_NEEDED' as const,
        // Prueba de que la contraseña era correcta. El controlador lo mueve a
        // una cookie: no debe salir nunca en el cuerpo de la respuesta.
        pendingToken: generatePending2FAToken(user.id),
        message: 'Introduce el código de tu aplicación de autenticación.'
      };
    }
```

- [ ] **Step 5: El controlador pone las cookies**

En `backend-desamparados/src/controllers/auth.controller.ts`, añadir los imports:

```ts
import { ponerCookieSesion, ponerCookie2FA, limpiarCookie2FA, limpiarCookiesAuth, COOKIE_2FA } from '../utils/cookies.js';
import { verifyToken } from '../utils/jwt.handle.js';
```

Sustituir `login` y `loginVerify2FA` por:

```ts
  static async login(req: Request, res: Response) {
    try {
      const response = await AuthService.login(req.body);

      if (response.status === '2FA_NEEDED') {
        ponerCookie2FA(res, response.pendingToken);
        return res.status(200).json({ status: '2FA_NEEDED', message: response.message });
      }

      ponerCookieSesion(res, response.token, response.user.role);
      res.status(200).json({ status: 'OK', user: response.user });
    } catch (error) {
      handleHttp(res, error, 'Error en el login');
    }
  }

  static async loginVerify2FA(req: Request, res: Response) {
    try {
      // El usuario sale del testigo del primer factor, nunca del cuerpo.
      const pendiente = req.cookies?.[COOKIE_2FA];
      const payload = pendiente ? verifyToken(pendiente, '2fa_pending') : null;

      if (!payload) {
        limpiarCookiesAuth(res);
        return res.status(401).json({
          error: 'PENDING_2FA_REQUIRED',
          message: 'La verificación ha caducado. Vuelve a introducir tu email y contraseña.'
        });
      }

      const { token2fa } = req.body;
      const response = await AuthService.verifyLogin2FA(payload.id, token2fa);

      limpiarCookie2FA(res);
      ponerCookieSesion(res, response.token, response.user.role);
      res.status(200).json({ status: 'OK', user: response.user });
    } catch (error) {
      // El servicio lanza mensajes de negocio específicos ("Cuenta bloqueada temporalmente...",
      // "Código incorrecto o expirado") que deben llegar al usuario tal cual.
      handleHttp(res, error, 'Código 2FA incorrecto o expirado');
    }
  }
```

- [ ] **Step 6: Ejecutar tests y typecheck**

```bash
cd backend-desamparados && npx tsc --noEmit && npm test
```

Esperado: todo en verde.

- [ ] **Step 7: Commit**

```bash
git add backend-desamparados/src/services/auth.service.ts backend-desamparados/src/controllers/auth.controller.ts backend-desamparados/src/schemas/auth.schema.ts backend-desamparados/test/integration.test.ts
git commit -m "Vincular el segundo factor al primero y emitir la sesion en cookie"
```

---

### Task 5: Endpoints `/me` y `/logout`

**Files:**
- Modify: `backend-desamparados/src/services/auth.service.ts` (método nuevo)
- Modify: `backend-desamparados/src/controllers/auth.controller.ts` (métodos nuevos)
- Modify: `backend-desamparados/src/routes/auth.routes.ts`
- Test: `backend-desamparados/test/integration.test.ts`

**Interfaces:**
- Consumes: `authenticateToken` (Task 3), `limpiarCookiesAuth` (Task 2).
- Produces:
  - `AuthService.perfilSesion(userId: number): Promise<{ id, email, role, perfiles }>`
  - `GET /api/auth/me` → `{ user }`
  - `POST /api/auth/logout` → 204

- [ ] **Step 1: Escribir el test que falla**

Añadir a `backend-desamparados/test/integration.test.ts`:

```ts
test('/me sin cookie responde 401', async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(res.status, 401);
});

test('logout responde 204 y borra las cookies aunque no hubiera sesion', async () => {
  const res = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
  assert.equal(res.status, 204);

  const borrados = res.headers.getSetCookie();
  // El borrado tiene que repetir el Path exacto o el navegador lo ignora
  assert.ok(borrados.some((c) => c.includes('desamparados_session=') && c.includes('Path=/api')));
  assert.ok(borrados.some((c) => c.includes('desamparados_2fa=') && c.includes('Path=/api/auth')));
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

```bash
cd backend-desamparados && npx tsx --test test/integration.test.ts
```

Esperado: FALLA con 404 en ambos: las rutas no existen.

- [ ] **Step 3: Añadir el método al servicio**

En `backend-desamparados/src/services/auth.service.ts`, añadir dentro de la clase:

```ts
  /**
   * Los datos de sesión que el frontend necesita al arrancar. Devuelve el mismo
   * objeto `user` que el login, para que el front tenga un único formato.
   */
  static async perfilSesion(userId: number) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        hermanos: {
          where: { activo: true },
          select: { id: true, nombre: true, esTitular: true, puesto: true }
        }
      }
    });

    if (!user) throw new NotFoundError('Usuario no encontrado');

    return { id: user.id, email: user.email, role: user.role, perfiles: user.hermanos };
  }
```

- [ ] **Step 4: Añadir los métodos al controlador**

En `backend-desamparados/src/controllers/auth.controller.ts`, añadir dentro de la clase:

```ts
  static async me(req: Request, res: Response) {
    try {
      const user = await AuthService.perfilSesion(req.user!.id);
      res.status(200).json({ user });
    } catch (error) {
      handleHttp(res, error, 'No se ha podido recuperar la sesión');
    }
  }

  /**
   * Sin authenticateToken a propósito: una sesión ya caducada también tiene que
   * poder limpiar su cookie. Es idempotente.
   */
  static async logout(_req: Request, res: Response) {
    limpiarCookiesAuth(res);
    res.status(204).end();
  }
```

- [ ] **Step 5: Añadir las rutas**

En `backend-desamparados/src/routes/auth.routes.ts`, dentro de la sección de rutas públicas, tras la línea de `/login/2fa`:

```ts
// Cierre de sesión: sin autenticar, para que una sesión caducada pueda limpiarse.
authRoutes.post('/logout', AuthController.logout);
```

Y en la sección de rutas privadas, antes de `/2fa/generate`:

```ts
// Sesión actual: el frontend la consulta al arrancar, ya no guarda nada en el navegador.
authRoutes.get('/me', authenticateToken, AuthController.me);
```

- [ ] **Step 6: Ejecutar tests y typecheck**

```bash
cd backend-desamparados && npx tsc --noEmit && npm test
```

Esperado: todo en verde.

- [ ] **Step 7: Commit**

```bash
git add backend-desamparados/src/services/auth.service.ts backend-desamparados/src/controllers/auth.controller.ts backend-desamparados/src/routes/auth.routes.ts backend-desamparados/test/integration.test.ts
git commit -m "Anadir los endpoints de sesion actual y cierre de sesion"
```

---

### Task 6: Fixtures de usuario y las pruebas que necesitan MariaDB

**Files:**
- Create: `backend-desamparados/test/fixtures/usuarios.ts`
- Test: `backend-desamparados/test/integration.test.ts`

**Interfaces:**
- Consumes: `encrypt` (`src/utils/bcrypt.handle.ts`), `db` (`src/config/db.ts`).
- Produces:
  - `PASSWORD_PRUEBA: string`
  - `crearUsuarioPrueba(role?: Role): Promise<User>`
  - `borrarUsuarioPrueba(id: number): Promise<void>`

**Por qué hace falta:** hoy no hay ninguna infraestructura para crear un usuario en los tests — los únicos que tocan la base de datos consultan endpoints públicos. Sin esto no se pueden verificar los atributos reales de las cookies ni el ciclo del 2FA.

**Dos trampas a tener presentes:**

1. **`authLimiter` permite 10 intentos cada 15 minutos por IP** en `/login` y `/login/2fa`, y todos los tests salen de `127.0.0.1`. Si al añadir más casos empiezan a aparecer respuestas 429, es el limitador, no el código.
2. **`tokenValidAfter` toma `now()` al crear el usuario, y el `iat` del JWT va en segundos enteros.** Si el login ocurre en el mismo segundo que la creación, el `iat` redondeado hacia abajo puede quedar *antes* de `tokenValidAfter` y la sesión nacería inválida. Por eso el fixture lo fija un minuto en el pasado.

- [ ] **Step 1: Crear el fixture**

Crear `backend-desamparados/test/fixtures/usuarios.ts`:

```ts
import { Role } from '@prisma/client';
import db from '../../src/config/db.js';
import { encrypt } from '../../src/utils/bcrypt.handle.js';

export const PASSWORD_PRUEBA = 'Prueba-2026-Segura';

let contador = 0;

/**
 * Crea un usuario desechable. El email y el DNI llevan un sufijo único para no
 * chocar con datos reales ni entre ejecuciones.
 */
export async function crearUsuarioPrueba(role: Role = Role.USER) {
  contador += 1;
  const sufijo = `${Date.now()}${contador}`;

  return db.user.create({
    data: {
      email: `prueba-${sufijo}@ejemplo.test`,
      password: await encrypt(PASSWORD_PRUEBA),
      dni: `T${sufijo}`,
      nombre: 'Prueba',
      apellidos: 'Automatica',
      telefono: '600000000',
      role,
      // Un minuto en el pasado: el `iat` del JWT va en segundos enteros y, si el
      // login cae en el mismo segundo que la creación, el redondeo lo dejaría
      // antes de tokenValidAfter y la sesión nacería ya invalidada.
      tokenValidAfter: new Date(Date.now() - 60_000)
    }
  });
}

export async function borrarUsuarioPrueba(id: number) {
  await db.user.deleteMany({ where: { id } });
}
```

- [ ] **Step 2: Escribir los tests que fallan**

Añadir a `backend-desamparados/test/integration.test.ts`. **Los `import` van arriba del todo**, con los que ya hay; el resto, al final del fichero:

```ts
import { Role } from '@prisma/client';
import { crearUsuarioPrueba, borrarUsuarioPrueba, PASSWORD_PRUEBA } from './fixtures/usuarios.js';

const conDb = { skip: () => (dbDisponible ? false : SIN_DB) };

async function entrar(email: string) {
  return fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD_PRUEBA })
  });
}

function cookieSesionDe(res: Response): string | undefined {
  return res.headers.getSetCookie().find((c) => c.startsWith('desamparados_session='));
}

test('la cookie del hermano persiste 4 h y la del staff muere al cerrar', conDb, async () => {
  const hermano = await crearUsuarioPrueba(Role.USER);
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);

  try {
    const deHermano = cookieSesionDe(await entrar(hermano.email))!;
    assert.match(deHermano, /HttpOnly/i);
    assert.match(deHermano, /SameSite=Strict/i);
    assert.match(deHermano, /Max-Age=14400/i);

    const deStaff = cookieSesionDe(await entrar(staff.email))!;
    assert.match(deStaff, /HttpOnly/i);
    // Sin Max-Age: cookie de sesión, muere al cerrar el navegador
    assert.doesNotMatch(deStaff, /Max-Age/i);
  } finally {
    await borrarUsuarioPrueba(hermano.id);
    await borrarUsuarioPrueba(staff.id);
  }
});

test('el cuerpo del login ya no lleva el token', conDb, async () => {
  const hermano = await crearUsuarioPrueba(Role.USER);
  try {
    const cuerpo = await (await entrar(hermano.email)).json();
    assert.equal(cuerpo.status, 'OK');
    assert.equal(cuerpo.token, undefined);
    assert.ok(cuerpo.user?.id);
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

test('/me devuelve la sesion cuando se manda la cookie', conDb, async () => {
  const hermano = await crearUsuarioPrueba(Role.USER);
  try {
    const cookie = cookieSesionDe(await entrar(hermano.email))!.split(';')[0];
    const res = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });

    assert.equal(res.status, 200);
    assert.equal((await res.json()).user.email, hermano.email);
  } finally {
    await borrarUsuarioPrueba(hermano.id);
  }
});

test('con 2FA activo el login no emite sesion, solo el testigo pendiente', conDb, async () => {
  const staff = await crearUsuarioPrueba(Role.SECRETARIA);
  try {
    await db.user.update({
      where: { id: staff.id },
      data: { twoFactorEnabled: true, twoFactorSecret: 'JBSWY3DPEHPK3PXP' }
    });

    const res = await entrar(staff.email);
    const cookies = res.headers.getSetCookie();

    assert.equal((await res.json()).status, '2FA_NEEDED');
    assert.ok(cookies.some((c) => c.startsWith('desamparados_2fa=')));
    assert.ok(!cookies.some((c) => c.startsWith('desamparados_session=')));
  } finally {
    await borrarUsuarioPrueba(staff.id);
  }
});

test('la agenda sigue distinguiendo invitado de autenticado', conDb, async () => {
  const res = await fetch(`${baseUrl}/api/agenda`);
  // El middleware opcional unificado deja pasar al invitado en lugar de bloquearlo
  assert.ok(res.status === 200, `esperado 200 para un invitado, recibido ${res.status}`);
});
```

- [ ] **Step 3: Ejecutar con MariaDB levantada**

```bash
cd backend-desamparados && npm test
```

Esperado: PASAN. Si MariaDB no está levantada se omiten solos con el motivo a la vista, pero **esta tarea hay que ejecutarla con la base de datos arrancada** para que sirva de algo.

- [ ] **Step 4: Commit**

```bash
git add backend-desamparados/test/fixtures/usuarios.ts backend-desamparados/test/integration.test.ts
git commit -m "Anadir fixtures de usuario y probar las cookies contra la base de datos"
```

---

### Task 7: La promoción de rol invalida la sesión anterior

**Files:**
- Modify: `backend-desamparados/src/services/admin.service.ts:52-56`
- Test: `backend-desamparados/test/integration.test.ts`

**Interfaces:**
- Consumes: `crearUsuarioPrueba`, `borrarUsuarioPrueba` (Task 6); `AdminService.promoteToStaff(userId: number, newRole: Role, currentAdminId: number, meta?: AuditMeta)`.
- Produces: nada nuevo.

**Por qué:** hoy la degradación invalida las sesiones (`tokenValidAfter`) y la promoción no. Con la política por rol eso es un agujero: a un hermano promovido a Secretaría se le emitió la cookie **persistente de 4 h** de `USER`, y pasaría a tener permisos de CMS dentro de una cookie que sobrevive a cerrar el navegador.

- [ ] **Step 1: Escribir el test que falla**

Añadir a `backend-desamparados/test/integration.test.ts`:

```ts
import { AdminService } from '../src/services/admin.service.js';

test('promover a staff invalida la sesion emitida como hermano', conDb, async () => {
  const hermano = await crearUsuarioPrueba(Role.USER);
  const admin = await crearUsuarioPrueba(Role.ADMIN);

  try {
    const cookie = cookieSesionDe(await entrar(hermano.email))!.split(';')[0];

    // Antes de promover, la sesión sirve
    const antes = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
    assert.equal(antes.status, 200);

    await AdminService.promoteToStaff(hermano.id, Role.SECRETARIA, admin.id);

    // Después ya no: su cookie era la persistente de 4 h de USER, y con permisos
    // de CMS tiene que recibir la de staff, que muere al cerrar el navegador.
    const despues = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: cookie } });
    assert.equal(despues.status, 401);
  } finally {
    await borrarUsuarioPrueba(hermano.id);
    await borrarUsuarioPrueba(admin.id);
  }
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

```bash
cd backend-desamparados && npm test
```

Esperado: FALLA con 200 en lugar de 401 — la promoción no invalida nada todavía. **Requiere MariaDB levantada**; si se omite, el test no demuestra nada.

- [ ] **Step 3: Modificar la promoción**

En `backend-desamparados/src/services/admin.service.ts`, en el `db.user.update` del cambio de rol (el que audita `STAFF_PROMOTE`), sustituir `data: { role: newRole },` por:

```ts
      data: {
        role: newRole,
        // La sesión anterior se emitió con la política del rol viejo (cookie
        // persistente de 4 h si era USER). Forzamos un login nuevo para que
        // reciba la de staff, que muere al cerrar el navegador.
        tokenValidAfter: new Date()
      },
```

- [ ] **Step 4: Ejecutar tests y typecheck**

```bash
cd backend-desamparados && npx tsc --noEmit && npm test
```

Esperado: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add backend-desamparados/src/services/admin.service.ts backend-desamparados/test/integration.test.ts
git commit -m "Invalidar la sesion tambien al promover a un rol de staff"
```

---

### Task 8: El cliente HTTP manda credenciales

**Files:**
- Modify: `desamparados-web/src/lib/api/client.ts`

**Interfaces:**
- Consumes: `useAuthStore.getState().salirSesion()` — **se define en la Task 9**. Esta tarea deja el typecheck del front roto hasta entonces; es esperado.
- Produces: `apiFetch` con `credentials: 'include'`. La opción `auth` cambia de significado: ya no es «adjuntar el token» sino «esta petición espera sesión, y un 401 significa que ha caducado».

- [ ] **Step 1: Modificar el cliente**

En `desamparados-web/src/lib/api/client.ts`, sustituir el bloque de comentario de cabecera y el cuerpo de `apiFetch`:

Cabecera del fichero:

```ts
/**
 * Cliente HTTP mínimo para la API del backend.
 *
 * - Base URL: `/api` (mismo origen; en desarrollo Vite lo proxyea al backend, ver vite.config.ts).
 * - La sesión viaja en una cookie httpOnly que el navegador adjunta solo: aquí no
 *   se lee ni se guarda ningún token.
 * - Un 401 en una petición que esperaba sesión significa que ha caducado o se ha
 *   revocado: se limpia el estado local.
 */
```

Y dentro de `apiFetch`, quitar la línea `const token = useAuthStore.getState().token` y dejar el `fetch` así:

```ts
  const { json, auth = true, headers, ...rest } = options

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      // El navegador adjunta la cookie de sesión; sin esto no viajaría.
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : undefined,
    })
  } catch {
    throw new ApiError('No se ha podido conectar con el servidor. Inténtalo de nuevo en unos minutos.', 0)
  }
```

Y sustituir el bloque del 401:

```ts
  if (!res.ok) {
    // `auth: false` marca las peticiones para las que un 401 es normal (login,
    // y sobre todo el /me del arranque cuando el visitante es un invitado).
    if (res.status === 401 && auth) {
      useAuthStore.getState().salirSesion()
    }
    throw new ApiError(extractMessage(payload) ?? `Error ${res.status}`, res.status, payload)
  }
```

- [ ] **Step 2: Comprobar que el typecheck falla como se espera**

```bash
cd desamparados-web && npx tsc -b
```

Esperado: FALLA en `client.ts` porque `salirSesion` no existe todavía. Se arregla en la Task 9. **No arreglarlo aquí.**

- [ ] **Step 3: Commit**

```bash
git add desamparados-web/src/lib/api/client.ts
git commit -m "Mandar la cookie de sesion en las peticiones a la API"
```

---

### Task 9: El store sin token ni persistencia

**Files:**
- Modify: `desamparados-web/src/features/members/auth/store.ts`
- Test: `desamparados-web/src/features/members/auth/__tests__/store.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type AuthStatus = 'cargando' | 'autenticado' | 'invitado'`
  - `useAuthStore` con `{ status: AuthStatus; user: AuthUser | null; entrarSesion(user: AuthUser): void; salirSesion(): void }`
  - `isStaffRole` (sin cambios)
  - `CLAVE_PERSISTENCIA_ANTIGUA = 'desamparados-auth'`

**Nota:** los nombres cambian a propósito (`login`→`entrarSesion`, `logout`→`salirSesion`) para que el compilador obligue a revisar cada punto de uso. Los puntos de uso son: `src/lib/api/client.ts`, `src/app/AdminLayout.tsx`, `src/app/BrotherLayout.tsx`, `src/routes/RequireAuth.tsx`, `src/routes/RequireRole.tsx`, `src/routes/index.tsx`, `src/features/members/auth/LoginPage.tsx`, `src/features/cms/BrothersAdminPage.tsx`.

- [ ] **Step 1: Reescribir el test**

Sustituir el contenido de `desamparados-web/src/features/members/auth/__tests__/store.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore, isStaffRole, type AuthUser } from '../store'

const user: AuthUser = {
  id: 1,
  email: 'test@test.com',
  role: 'USER',
  perfiles: [{ id: 10, nombre: 'Test', esTitular: true, puesto: null }],
}

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'cargando', user: null })
  })

  it('arranca en cargando, sin dar por hecho que hay sesion', () => {
    expect(useAuthStore.getState().status).toBe('cargando')
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('entrarSesion guarda al usuario sin ningun token', () => {
    useAuthStore.getState().entrarSesion(user)
    expect(useAuthStore.getState().status).toBe('autenticado')
    expect(useAuthStore.getState().user).toEqual(user)
    expect(useAuthStore.getState()).not.toHaveProperty('token')
  })

  it('salirSesion deja el estado como invitado', () => {
    useAuthStore.getState().entrarSesion(user)
    useAuthStore.getState().salirSesion()
    expect(useAuthStore.getState().status).toBe('invitado')
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('no persiste nada en localStorage', () => {
    useAuthStore.getState().entrarSesion(user)
    expect(localStorage.getItem('desamparados-auth')).toBeNull()
  })

  it('detects staff roles', () => {
    expect(isStaffRole('USER')).toBe(false)
    expect(isStaffRole('SECRETARIA')).toBe(true)
    expect(isStaffRole(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

```bash
cd desamparados-web && npx vitest run src/features/members/auth/__tests__/store.test.tsx
```

Esperado: FALLA, no existen `status`, `entrarSesion` ni `salirSesion`.

- [ ] **Step 3: Reescribir el store**

Sustituir el contenido de `desamparados-web/src/features/members/auth/store.ts` desde el `import` hasta el cierre de `useAuthStore`, manteniendo `AuthPerfil`, `AuthUser` e `isStaffRole` tal cual:

```ts
import { create } from 'zustand'

/** Ficha de hermano gestionada por la cuenta (un usuario puede gestionar a su familia) */
export interface AuthPerfil {
  id: number
  nombre: string
  esTitular: boolean
  puesto: string | null
}

/** Usuario tal y como lo devuelven POST /api/auth/login y GET /api/auth/me */
export interface AuthUser {
  id: number
  email: string
  role: string
  perfiles: AuthPerfil[]
}

/**
 * `cargando` es el estado inicial: todavía no sabemos si hay sesión porque la
 * respuesta de /api/auth/me no ha llegado. Los guardas de ruta deben esperar en
 * lugar de mandar al login, o expulsarían a quien sí tiene sesión.
 */
export type AuthStatus = 'cargando' | 'autenticado' | 'invitado'

/** Clave que usaba zustand/persist cuando el token vivía en el navegador */
export const CLAVE_PERSISTENCIA_ANTIGUA = 'desamparados-auth'

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  entrarSesion: (user: AuthUser) => void
  salirSesion: () => void
}

// Sin persist: la sesión vive en una cookie httpOnly y el navegador no guarda
// aquí ni el token ni los datos personales.
export const useAuthStore = create<AuthState>()((set) => ({
  status: 'cargando',
  user: null,
  entrarSesion: (user) => set({ status: 'autenticado', user }),
  salirSesion: () => set({ status: 'invitado', user: null }),
}))

/** Roles con acceso al CMS/Secretaría (el resto son hermanos rasos: USER) */
export const isStaffRole = (role?: string | null) => !!role && role !== 'USER'
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

```bash
cd desamparados-web && npx vitest run src/features/members/auth/__tests__/store.test.tsx
```

Esperado: PASA, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add desamparados-web/src/features/members/auth/store.ts desamparados-web/src/features/members/auth/__tests__/store.test.tsx
git commit -m "Quitar el token y la persistencia del estado de sesion"
```

---

### Task 10: Arranque con `/me` y guardas que esperan

**Files:**
- Create: `desamparados-web/src/components/PageLoader.tsx`
- Create: `desamparados-web/src/features/members/auth/session.ts`
- Create: `desamparados-web/src/features/members/auth/__tests__/session.test.tsx`
- Modify: `desamparados-web/src/lib/api/auth.ts`
- Modify: `desamparados-web/src/App.tsx`
- Modify: `desamparados-web/src/routes/index.tsx:68-80` (extraer `PageLoader`)
- Modify: `desamparados-web/src/routes/RequireAuth.tsx`
- Modify: `desamparados-web/src/routes/RequireRole.tsx`

**Interfaces:**
- Consumes: `apiFetch` (Task 8), `useAuthStore` (Task 9).
- Produces también: `PageLoader` como componente exportado por defecto desde `src/components/PageLoader.tsx`.

**Ojo:** hoy `PageLoader` **no es un componente importable**: es una función local dentro de `src/routes/index.tsx`. Los guardas lo necesitan, y hacer que `RequireAuth` importe de `routes/index.tsx` crearía un ciclo, porque ese fichero ya importa los guardas. Por eso el primer paso lo extrae a su propio fichero.
- Produces:
  - `sesionActual(): Promise<{ user: AuthUser }>` y `cerrarSesionApi(): Promise<void>` en `src/lib/api/auth.ts`
  - `useCargarSesion(): void` y `cerrarSesion(): Promise<void>` en `src/features/members/auth/session.ts`

- [ ] **Step 1: Extraer PageLoader a su propio fichero**

Crear `desamparados-web/src/components/PageLoader.tsx` con el contenido que hoy está suelto en `src/routes/index.tsx`:

```tsx
import { Box, CircularProgress } from '@mui/material'

export default function PageLoader() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
      }}
    >
      <CircularProgress color="primary" />
    </Box>
  )
}
```

En `src/routes/index.tsx`, borrar la función local `PageLoader` (líneas 68-80) y añadir el import:

```tsx
import PageLoader from '../components/PageLoader'
```

Comprobar que `Box` y `CircularProgress` siguen usándose en `routes/index.tsx`; si ya no, quitarlos de su import de `@mui/material` para que no falle el lint.

- [ ] **Step 2: Añadir las llamadas a la API**

En `desamparados-web/src/lib/api/auth.ts`, añadir al final:

```ts
/**
 * Sesión actual. `auth: false` a propósito: para un invitado el 401 es la
 * respuesta normal y no debe tratarse como sesión caducada.
 */
export function sesionActual() {
  return apiFetch<{ user: AuthUser }>('/auth/me', { auth: false })
}

export function cerrarSesionApi() {
  return apiFetch<null>('/auth/logout', { method: 'POST', auth: false })
}
```

- [ ] **Step 3: Escribir el test que falla**

Crear `desamparados-web/src/features/members/auth/__tests__/session.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuthStore } from '../store'
import { useCargarSesion } from '../session'

const user = {
  id: 1,
  email: 'test@test.com',
  role: 'USER',
  perfiles: [{ id: 10, nombre: 'Test', esTitular: true, puesto: null }],
}

describe('useCargarSesion', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'cargando', user: null })
    localStorage.setItem('desamparados-auth', '{"state":{"token":"viejo"}}')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('deja autenticado cuando /me responde con usuario', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ user }), { status: 200 })
    )

    renderHook(() => useCargarSesion())

    await waitFor(() => expect(useAuthStore.getState().status).toBe('autenticado'))
    expect(useAuthStore.getState().user).toEqual(user)
  })

  it('deja invitado cuando /me responde 401, sin tratarlo como error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'NO_TOKEN_PROVIDED' }), { status: 401 })
    )

    renderHook(() => useCargarSesion())

    await waitFor(() => expect(useAuthStore.getState().status).toBe('invitado'))
  })

  it('borra el token que zustand/persist dejaba en el navegador', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'NO_TOKEN_PROVIDED' }), { status: 401 })
    )

    renderHook(() => useCargarSesion())

    await waitFor(() => expect(localStorage.getItem('desamparados-auth')).toBeNull())
  })
})
```

- [ ] **Step 4: Ejecutar y comprobar que falla**

```bash
cd desamparados-web && npx vitest run src/features/members/auth/__tests__/session.test.tsx
```

Esperado: FALLA, no existe `../session`.

- [ ] **Step 5: Crear el módulo de sesión**

Crear `desamparados-web/src/features/members/auth/session.ts`:

```ts
import { useEffect, useRef } from 'react'
import { sesionActual, cerrarSesionApi } from '../../../lib/api/auth'
import { useAuthStore, CLAVE_PERSISTENCIA_ANTIGUA } from './store'

/**
 * Pregunta al servidor si hay sesión. Se llama una sola vez al arrancar la
 * aplicación: el token ya no es legible desde JavaScript, así que esta es la
 * única forma de saberlo tras recargar la página.
 */
export function useCargarSesion(): void {
  const yaLanzado = useRef(false)

  useEffect(() => {
    if (yaLanzado.current) return
    yaLanzado.current = true

    // Limpieza de una vez: borra el token y los datos personales que las
    // versiones anteriores guardaban en el navegador de cada usuario.
    localStorage.removeItem(CLAVE_PERSISTENCIA_ANTIGUA)

    sesionActual()
      .then(({ user }) => useAuthStore.getState().entrarSesion(user))
      .catch(() => useAuthStore.getState().salirSesion())
  }, [])
}

/** Cierra la sesión en el servidor (que borra la cookie) y luego en el cliente. */
export async function cerrarSesion(): Promise<void> {
  try {
    await cerrarSesionApi()
  } catch {
    // Si el servidor no responde, al menos limpiamos el estado local.
  }
  useAuthStore.getState().salirSesion()
}
```

- [ ] **Step 6: Ejecutar y comprobar que pasa**

```bash
cd desamparados-web && npx vitest run src/features/members/auth/__tests__/session.test.tsx
```

Esperado: PASA, 3 tests.

- [ ] **Step 7: Llamarlo al arrancar**

En `desamparados-web/src/App.tsx`, añadir el import y la llamada:

```tsx
import { useCargarSesion } from './features/members/auth/session'
```

y como primera línea del cuerpo de `function App()`:

```tsx
  // Recupera la sesión de la cookie httpOnly. Una sola vez, al arrancar.
  useCargarSesion()
```

- [ ] **Step 8: Los guardas esperan a saber**

Sustituir el cuerpo de `desamparados-web/src/routes/RequireAuth.tsx`:

```tsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../features/members/auth/store'
import PageLoader from '../components/PageLoader'

interface RequireAuthProps {
  children: React.ReactNode
}

export default function RequireAuth({ children }: RequireAuthProps) {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  // Mientras no sepamos si hay sesión no podemos mandar a nadie al login:
  // expulsaría a quien sí la tiene cada vez que recarga la página.
  if (status === 'cargando') return <PageLoader />

  if (status !== 'autenticado') {
    return <Navigate to="/hermanos/acceso" state={{ from: location }} replace />
  }

  return <>{children}</>
}
```

Y `desamparados-web/src/routes/RequireRole.tsx`:

```tsx
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../features/members/auth/store'
import PageLoader from '../components/PageLoader'

interface RequireRoleProps {
  roles: string[]
  children: React.ReactNode
}

export default function RequireRole({ roles, children }: RequireRoleProps) {
  const status = useAuthStore((state) => state.status)
  const role = useAuthStore((state) => state.user?.role)
  const location = useLocation()

  if (status === 'cargando') return <PageLoader />

  if (!role) return <Navigate to="/hermanos/acceso" state={{ from: location }} replace />
  if (!roles.includes(role)) return <Navigate to="/area-hermano" replace />

  return <>{children}</>
}
```

**Comprobar antes** la ruta real de `PageLoader`: se importa en `src/routes/index.tsx`; usar exactamente la misma ruta relativa ajustada desde `src/routes/`.

- [ ] **Step 9: Ejecutar los tests del front**

```bash
cd desamparados-web && npm test
```

Esperado: en verde salvo lo que dependa de `LoginPage`, que se arregla en la Task 11.

- [ ] **Step 10: Commit**

```bash
git add desamparados-web/src/components/PageLoader.tsx desamparados-web/src/routes/index.tsx desamparados-web/src/features/members/auth/session.ts desamparados-web/src/features/members/auth/__tests__/session.test.tsx desamparados-web/src/lib/api/auth.ts desamparados-web/src/App.tsx desamparados-web/src/routes/RequireAuth.tsx desamparados-web/src/routes/RequireRole.tsx
git commit -m "Recuperar la sesion del servidor al arrancar la aplicacion"
```

---

### Task 11: Login, 2FA y cierre de sesión contra el contrato nuevo

**Files:**
- Modify: `desamparados-web/src/lib/api/auth.ts` (tipos y `verify2FA`)
- Modify: `desamparados-web/src/features/members/auth/LoginPage.tsx:24,38-43,56-60`
- Modify: `desamparados-web/src/app/AdminLayout.tsx:19,38`
- Modify: `desamparados-web/src/app/BrotherLayout.tsx:37,108`

**Interfaces:**
- Consumes: `entrarSesion` (Task 9), `cerrarSesion` (Task 10).
- Produces: `LoginResponse` sin `token` ni `userId`.

- [ ] **Step 1: Actualizar los tipos y la llamada del 2FA**

En `desamparados-web/src/lib/api/auth.ts`, sustituir el tipo y `verify2FA`:

```ts
/**
 * Respuesta de POST /auth/login y POST /auth/login/2fa.
 * Ni el token ni el userId viajan ya en el cuerpo: el token va en una cookie
 * httpOnly y el usuario del segundo paso sale del testigo del primer factor.
 */
export type LoginResponse =
  | { status: 'OK'; user: AuthUser }
  | { status: '2FA_NEEDED'; message: string }
```

```ts
export function verify2FA(token2fa: string) {
  return apiFetch<LoginResponse>('/auth/login/2fa', {
    method: 'POST',
    auth: false,
    json: { token2fa },
  })
}
```

- [ ] **Step 2: Actualizar LoginPage**

En `desamparados-web/src/features/members/auth/LoginPage.tsx`:

Cambiar el import del store:

```tsx
import { useAuthStore } from './store'
```

Cambiar la línea del selector:

```tsx
  const entrarSesion = useAuthStore((state) => state.entrarSesion)
```

Cambiar el estado del segundo paso (ya no hay `userId` que guardar):

```tsx
  // Segundo paso del login cuando la cuenta tiene 2FA activado. El usuario lo
  // identifica una cookie de vida corta que emitió el servidor, no este estado.
  const [pending2FA, setPending2FA] = useState<{ message: string } | null>(null)
```

Cambiar `handleResponse`:

```tsx
  const handleResponse = (response: LoginResponse) => {
    if (response.status === '2FA_NEEDED') {
      setPending2FA({ message: response.message })
      return
    }
    entrarSesion(response.user)
    navigate(from, { replace: true })
  }
```

Cambiar `onSubmit2FA`:

```tsx
  const onSubmit2FA = async (data: TwoFactorFormData) => {
    if (!pending2FA) return
    try {
      handleResponse(await verify2FA(data.code))
    } catch (e) {
      twoFactorForm.setError('root', { message: errorMessage(e, 'Código incorrecto o expirado') })
    }
  }
```

- [ ] **Step 3: El cierre de sesión llama al servidor**

En `desamparados-web/src/app/AdminLayout.tsx`:

1. **Borrar** la línea 19 entera:

```tsx
  const logout = useAuthStore((state) => state.logout)
```

2. **Añadir** el import junto a los demás:

```tsx
import { cerrarSesion } from '../features/members/auth/session'
```

3. En el botón de la línea ~38, cambiar `onClick={logout}` por:

```tsx
onClick={() => { void cerrarSesion() }}
```

4. Si tras borrar el selector `useAuthStore` ya no se usa en el fichero, quitar también su import.

Repetir los cuatro pasos, idénticos, en `desamparados-web/src/app/BrotherLayout.tsx`: el selector está en la línea 37 y el `onClick` en la 108.

El cierre de sesión tiene que pasar por el servidor: la cookie es `httpOnly` y el navegador no puede borrarla desde JavaScript.

- [ ] **Step 4: Typecheck y tests completos del front**

```bash
cd desamparados-web && npx tsc -b && npm run lint && npm test
```

Esperado: todo limpio. Si el compilador señala usos de `isAuthenticated`, `login` o `logout` en `src/routes/index.tsx` o `src/features/cms/BrothersAdminPage.tsx`, adaptarlos: `isAuthenticated` pasa a ser `status === 'autenticado'`.

- [ ] **Step 5: Commit**

```bash
git add desamparados-web/src/lib/api/auth.ts desamparados-web/src/features/members/auth/LoginPage.tsx desamparados-web/src/app/AdminLayout.tsx desamparados-web/src/app/BrotherLayout.tsx
git commit -m "Adaptar login, 2FA y cierre de sesion al contrato nuevo"
```

---

### Task 12: Comprobación de extremo a extremo y documentación

**Files:**
- Modify: `backend-desamparados/.env.example`
- Modify: `desamparados-web/.env.example` (si existe)
- Modify: `docs/despliegue.md`
- Modify: `docs/traspaso-2026-08-28.md:173-191` (sección 5.1)

- [ ] **Step 1: Prueba manual con MariaDB levantada**

```bash
cd backend-desamparados && npm run dev
```

En otra terminal:

```bash
cd desamparados-web && npm run dev
```

Comprobar en el navegador, con las herramientas de desarrollo abiertas:

1. Entrar con una cuenta `USER`. En la pestaña Application → Cookies debe aparecer `desamparados_session` con `HttpOnly` marcado, `SameSite=Strict` y una fecha de caducidad a 4 h.
2. `localStorage` debe estar **vacío** de `desamparados-auth`.
3. Recargar la página: la sesión sigue (la recupera `/me`).
4. Entrar con una cuenta de staff: la cookie debe salir **sin** fecha de caducidad («Session»).
5. Cerrar sesión: la cookie desaparece y se vuelve al acceso.

- [ ] **Step 2: Quitar VITE_API_URL de otro origen**

En el `.env.example` del frontend, si define `VITE_API_URL` apuntando a un dominio distinto, sustituir el comentario por:

```
# La API tiene que ir en el mismo dominio que la web: la cookie de sesión es
# SameSite=Strict y el navegador no la mandaría a otro origen. Dejar vacío
# para usar /api, o poner una ruta del mismo origen.
VITE_API_URL=
```

- [ ] **Step 3: Actualizar despliegue.md**

En `docs/despliegue.md`, sustituir la sección «Decisión pendiente: ¿mismo dominio para web y API?» entera (desde ese encabezado hasta la línea que empieza por «Hoy el token vive en `localStorage`…», incluida) por:

```markdown
## Decidido: mismo dominio para web y API

Hay un VPS, así que la configuración de arriba es la definitiva: **la web y la
API comparten dominio**, con `/api/` como ruta. No es una preferencia, es un
requisito de funcionamiento:

1. `NUM_PROXIES` y el rate limiting funcionan con la IP real que pasa el proxy.
2. **La sesión viaja en una cookie `httpOnly` con `SameSite=Strict` y
   `Path=/api`.** Con la API en otro dominio el navegador no la mandaría y nadie
   podría iniciar sesión.

Por eso el bloque `location /api/` del proxy es obligatorio. Y por eso
`VITE_API_URL` no puede apuntar a otro origen: o se deja vacío, o se pone una
ruta del mismo dominio.
```

- [ ] **Step 4: Actualizar el traspaso**

En `docs/traspaso-2026-08-28.md`, sustituir la sección 5.1 entera («### 5.1 Decisión pendiente: dominio de la API», hasta justo antes de «### 5.2») por:

```markdown
### 5.1 Cerrado: el hallazgo 02

**Resuelto el 28 de agosto de 2026.** Se confirmó que hay un VPS y que la web y
la API comparten dominio, lo que desbloqueó la solución buena: el JWT ya no vive
en `localStorage`, sino en una cookie `httpOnly` con `SameSite=Strict`.

En la misma pasada se cerró un fallo que no estaba en ninguna auditoría: el
segundo factor no estaba vinculado al primero, así que para una cuenta con 2FA
bastaba con acertar el código —sin la contraseña— para entrar.

- Diseño: `docs/superpowers/specs/2026-08-28-sesion-cookie-httponly-design.md`
- Plan: `docs/superpowers/plans/2026-08-28-sesion-cookie-httponly.md`
```

En la sección 8 («Si hay que priorizar»), borrar el punto 1 y renumerar los otros dos.

- [ ] **Step 5: Verificación completa de ambos proyectos**

```bash
cd backend-desamparados && npx prisma generate && npx tsc --noEmit && npm test
cd ../desamparados-web && npx tsc -b && npm run lint && npm test && npm run build
```

Esperado: todo en verde.

- [ ] **Step 6: Commit**

```bash
git add docs/ backend-desamparados/.env.example desamparados-web/.env.example
git commit -m "Documentar el cierre del hallazgo 02 y el dominio unico"
```

---

## Aviso antes de desplegar

**Al desplegar se cierran todas las sesiones abiertas.** El token viejo vive en `localStorage` y el esquema nuevo ni lo mira, así que todo el mundo tendrá que volver a entrar una vez. Hay que avisar a quien use el CMS antes de subirlo.
