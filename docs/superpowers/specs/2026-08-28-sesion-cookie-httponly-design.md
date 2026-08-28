# La sesión pasa a una cookie httpOnly

> Diseño aprobado el 28 de agosto de 2026. Cierra el **hallazgo 02** de la
> segunda auditoría y, de paso, un fallo de vinculación del segundo factor
> encontrado al leer el flujo de login.

## 1. Por qué ahora

El hallazgo 02 llevaba abierto desde la segunda auditoría porque dependía de una
decisión de infraestructura: si la web y la API iban a compartir dominio. Ya
está decidido que **sí**: `docs/despliegue.md` sirve el front en `/` y la API en
`/api/` detrás del mismo `server_name`. El alojamiento está por contratar, así
que esto es un **requisito** de lo que se contrate, no una descripción de algo
que ya exista.

Eso permite la solución buena: cookie `httpOnly` con `SameSite=Strict`, sin
necesidad de protección CSRF explícita. Con la API en otro dominio habría hecho
falta `SameSite=None; Secure` y CSRF a mano.

Hoy el JWT vive en `localStorage` (`zustand/persist`, clave `desamparados-auth`),
así que cualquier XSS se llevaría la sesión. DOMPurify (`src/lib/sanitizeHtml.ts`)
cierra el vector práctico, pero es la segunda barrera, no la primera.

## 2. El fallo del segundo factor

Al leer el flujo apareció algo que no estaba en ninguna auditoría.

`POST /api/auth/login/2fa` recibe **solo** `{ userId, token2fa }`:

```ts
// routes/auth.routes.ts — sin ningún middleware de sesión
authRoutes.post('/login/2fa', authLimiter, validate(verify2FASchema), AuthController.loginVerify2FA);

// services/auth.service.ts — nada prueba que se superara el paso de la contraseña
static async verifyLogin2FA(userId: number, token2fa: string) { … }
```

**El segundo factor no está vinculado al primero.** El `userId` es un entero
pequeño y enumerable, así que para una cuenta con 2FA activo basta con acertar el
código —sin la contraseña— para obtener una sesión completa. Y el 2FA solo lo
pueden activar los roles de staff (`ADMIN`, `TESORERIA`, `ALBACERIA`,
`HERMANO_MAYOR`, `REDES`, `SECRETARIA`), o sea que afecta justo a las cuentas
privilegiadas: convierte el 2FA en *el* factor en vez de en el *segundo*.

Lo frenan mucho el `authLimiter` (10 intentos / 15 min por IP) y el bloqueo por
cuenta (5 fallos → 15 min), pero el fallo de diseño es real y se arregla en esta
misma pasada porque toca exactamente los ficheros que ya íbamos a reescribir.

## 3. El contrato nuevo

### 3.1 Las dos cookies

Ambas `HttpOnly`, `SameSite=Strict`, y `Secure` **solo en producción** (en local
se sirve por `http://` y `Secure` impediría que se guardaran).

| Cookie | Contenido | `Path` | Vida |
|---|---|---|---|
| `desamparados_session` | JWT de sesión, claim `typ: 'session'` | `/api` | según rol (§3.2) |
| `desamparados_2fa` | JWT del paso intermedio, `typ: '2fa_pending'` | `/api/auth` | 5 min, tanto el JWT como el `Max-Age` |

`Path=/api` limita el envío a las peticiones a la API: los ficheros estáticos del
front y `/storage/public/` no la reciben. La descarga privada
(`/api/upload/private/:filename`) sí queda cubierta, y de propina empieza a
funcionar al abrir el enlace directamente en una pestaña — hoy no funciona,
porque una navegación normal no lleva cabecera `Authorization`.

### 3.2 Política de sesión por rol

Se aplica al firmar el token, que ya recibe el rol.

| Rol | Vida del JWT | `Max-Age` de la cookie | Efecto |
|---|---|---|---|
| Staff CMS | 8 h | ninguno | Muere al cerrar el navegador |
| `USER` | 4 h | 4 h | Sobrevive al cierre, caduca a las 4 h |

El razonamiento: el CMS se usará probablemente desde un equipo compartido de la
casa parroquial, y ahí una sesión que muere al cerrar el navegador vale la
incomodidad. Los hermanos del área familiar entran desde su propio dispositivo.

El `Max-Age` de la cookie nunca puede sobrevivir al JWT: para `USER` ambos son
4 h.

Salvedad honesta: Chrome con «continuar donde lo dejaste» puede restaurar las
cookies de sesión al reabrir. La cookie de staff es lo correcto igualmente, pero
no es una garantía absoluta.

### 3.3 El claim `typ` es la pieza crítica

Los dos JWT los firma el mismo secreto. Sin un claim que los distinga, **el
testigo de «2FA pendiente» —que ya identifica a un usuario— serviría como token
de sesión** y permitiría saltarse el segundo factor por completo: exactamente el
fallo que veníamos a arreglar, pero peor.

Por eso `verifyToken` pasa a recibir el tipo esperado y a rechazar cualquier
token que no lo lleve. Los tokens antiguos no tienen `typ`, así que dejan de
valer — algo que da igual, porque ninguno viajará ya en cookie (§6).

### 3.4 Endpoints

| Método | Ruta | Autenticación | Qué hace |
|---|---|---|---|
| `POST` | `/api/auth/logout` | **Ninguna** | Borra las dos cookies. 204 |
| `GET` | `/api/auth/me` | `authenticateToken` | Devuelve `{id, email, role, perfiles}`, el mismo objeto `user` que hoy devuelve el login |
| `POST` | `/api/auth/login/2fa` | Cookie `desamparados_2fa` | El body pierde `userId`; queda solo `{ token2fa }` |

`logout` va sin autenticación a propósito: una sesión ya caducada también tiene
que poder limpiar su cookie. Es idempotente y lo cubre el limitador global.

**Trampa**: para borrar una cookie hay que repetir su `Path` exacto. Si `logout`
las borra sin `Path`, el navegador no las elimina y **falla en silencio**: la
respuesta es 204 y la sesión sigue viva. Cada borrado tiene que llevar el `Path`
con el que se emitió (`/api` y `/api/auth` respectivamente).

`/me` se llama en cada carga de página; `authenticateToken` ya hace una consulta
a la BD, y esta añade el `include` de `hermanos`. Es asumible.

### 3.5 Cambios en lo que ya existe

- **`authenticateToken`** y **`optionalAuthentication`** leen `req.cookies` en vez
  de la cabecera `Authorization`. Se deja de aceptar la cabecera: sin caminos
  dobles. **Los dos** exigen `typ: 'session'` — si solo lo comprobara el estricto,
  el testigo de 2FA valdría para identificarse en las rutas de autenticación
  opcional.
- **Se borra `src/middleware/optionalAuth.ts`.** Hay dos `optionalAuthentication`
  distintos y el de ese fichero —el que usa `agenda.routes.ts`— **no valida
  contra la base de datos**: no ve revocaciones ni degradaciones de rol.
  `agenda.routes.ts` pasa a importar el de `middleware/session.ts`.
- **`STAFF_PROMOTE`** (`admin.service.ts`) pasa a actualizar `tokenValidAfter`.
  Hoy la degradación invalida las sesiones y la promoción no. Con la política por
  rol eso sería un agujero: a un hermano promovido a Secretaría se le habría
  emitido la cookie **persistente de 4 h** de `USER`, y tendría permisos de CMS
  dentro de una cookie que sobrevive a cerrar el navegador. Forzar el login nuevo
  emite ya la cookie de staff, y encaja con que un staff nuevo tiene que
  configurar su 2FA.
- **`cookie-parser`** como dependencia nueva: Express 5 tampoco parsea cookies.
- **CORS**: `credentials: true`, fuera `'Authorization'` de `allowedHeaders`, y en
  desarrollo `origin: true` en lugar de `'*'` — el comodín es incompatible con
  credenciales.

## 4. El frontend

Decisión de diseño: **`GET /api/auth/me` y estado solo en memoria.** Al arrancar,
una petición; 200 significa sesión, 401 significa invitado. Se descartaron
guardar una copia en `localStorage` (evita el parpadeo pero mantiene ahí los
datos personales) y una segunda cookie legible (dos cookies que sincronizar, y
falsificable).

- **`src/lib/api/client.ts`**: `credentials: 'include'`; fuera la cabecera
  `Authorization` y la lectura del token.
- **`src/features/members/auth/store.ts`**: fuera `token` y **fuera `persist`
  entero**. Quedan `user` y `status: 'cargando' | 'autenticado' | 'invitado'`.
- **Limpieza de una vez**: al arrancar se hace
  `localStorage.removeItem('desamparados-auth')`. Así los tokens y datos
  personales que hoy están guardados en el navegador de cada usuario desaparecen
  solos en su primera visita, sin que nadie tenga que hacer nada.
- Un efecto en la raíz llama a `/me` **una sola vez**. Los guardas de ruta esperan
  a que `status` deje de ser `cargando` en lugar de mirar `isAuthenticated`.
- El login ya no guarda token. El 2FA ya no manda `userId`. El logout llama al
  endpoint antes de limpiar el estado.

**Trampa a evitar**: el `/me` del arranque no debe disparar el cierre de sesión
que `client.ts` hace hoy ante un 401. Para un invitado ese 401 es la respuesta
normal, no una sesión caducada.

## 5. Errores y casos límite

| Situación | Respuesta |
|---|---|
| Sin cookie de sesión | 401 `NO_TOKEN_PROVIDED` |
| Cookie con JWT caducado o mal firmado | 401 `INVALID_TOKEN` |
| Usuario inactivo, o token anterior a `tokenValidAfter` | 401 `SESSION_REVOKED` |
| Cookie de sesión con `typ` incorrecto | 401 `INVALID_TOKEN` |
| `/login/2fa` sin cookie pendiente | 401, aunque el código sea correcto |
| Cookie de 2FA caducada (más de 5 min) | 401; hay que repetir el login desde la contraseña |

Los códigos y mensajes existentes no cambian: el front ya los trata.

## 6. Lo que se rompe a propósito

- **Al desplegar se cierran todas las sesiones abiertas.** No hay migración
  posible: el token viejo vive en `localStorage` y el esquema nuevo ni lo mira.
  Es un cierre de sesión global, de una sola vez. **Hay que avisar a quien use el
  CMS antes de desplegar.**
- **`VITE_API_URL` apuntando a otro origen deja de funcionar** con
  `SameSite=Strict`. Es coherente con la decisión de dominio único, pero hay que
  quitarlo del `.env.example` o documentar que solo admite rutas del mismo
  origen.

## 7. Pruebas

En `test/integration.test.ts`, que ya levanta `app.listen(0)` y omite solo las
que necesitan MariaDB.

**Sin base de datos:**

- Sin cookie → 401 en `/me` y en las rutas privadas.
- **El testigo de 2FA no vale como cookie de sesión** — el caso que justifica
  `typ`, y el más importante de todos.
- `/login/2fa` sin cookie pendiente → 401.
- `logout` sin sesión → 204 y cabecera de borrado.

**Con base de datos:**

- Login de staff → `Set-Cookie` **sin** `Max-Age`; login de `USER` → `Max-Age` de
  4 h. Ambas con `HttpOnly` y `SameSite=Strict`.
- Login con 2FA activo → no emite cookie de sesión, solo la pendiente.
- El ciclo completo de 2FA deja la sesión servible y borra la pendiente.
- Promoción de rol → la sesión anterior deja de valer.
- La agenda sigue distinguiendo invitado de autenticado tras unificar el
  middleware.

**Frontend:**

- Reescribir `src/features/members/auth/__tests__/store.test.tsx`: ya no hay
  token ni persistencia.
- Nuevo test del arranque: `/me` con 200 deja `autenticado`, con 401 deja
  `invitado` y **no** dispara el cierre de sesión.

## 8. Fuera de alcance

- Refresh token con rotación y «recuérdame». Se descartó por complejidad; las
  sesiones son de 4-8 h.
- El bloqueo de 2FA por cuenta sigue en memoria (`Map`), o sea que es por
  instancia. Con varias instancias haría falta Redis. No cambia aquí.
- ClamAV, la programación de la copia de seguridad y el despliegue en sí, que
  siguen diferidos (`docs/traspaso-2026-08-28.md` §5.3).
