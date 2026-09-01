# Notas del proyecto

Reglas y trampas que no se deducen leyendo el código, y que cuestan una tarde
cada vez que alguien las descubre por su cuenta. Esto **no** es un estado del
proyecto: para eso están los `traspaso-*.md`.

---

## 1. Cómo se llama la corporación

Es el **Grupo Parroquial**, con concordancia masculina: «del Grupo Parroquial»,
«nuestro Grupo Parroquial». **Nunca «Hermandad» ni «Cofradía»** en texto visible.

Un grupo parroquial es la etapa previa a constituirse como hermandad y cofradía,
así que llamarse «Hermandad y Cofradía de Nazarenos» era sencillamente incorrecto.
El renombrado se hizo el 28 de agosto de 2026 sobre 79 ocurrencias.

**Los miembros sí se llaman «hermanos»**, y eso no cambia: ni en los textos, ni en
las rutas `/hermanos/…`, ni en el modelo `Hermano` de Prisma.

Queda a propósito un `issuer: 'Cofradía Virtual'` en `auth.service.ts`: es el
nombre que muestran las aplicaciones de autenticación en el segundo factor, y
cambiarlo alteraría lo que ve el usuario en los registros nuevos.

---

## 2. El contenido de la web es inventado

Las 8 noticias, 10 eventos de agenda, 6 publicaciones, 4 páginas del CMS, 8
enseres, 6 prendas y 8 categorías contables que muestra la web son **de ejemplo**.
Viven en `backend-desamparados/prisma/seed-contenido.ts`, se siembran con
`npm run seed`, la siembra es idempotente y están pensados para editarse desde el
CMS.

**Antes de enseñar la web a nadie de fuera, avisar de que los textos son
ficticios.** El `archivoUrl` de las publicaciones apunta a
`/storage/public/documentos/pendiente.pdf`, que no existe: los PDF reales hay que
subirlos desde el CMS.

`test/seed-contenido.test.ts` valida ese contenido sin necesitar base de datos.

---

## 3. El backend exige seis variables de entorno solo para arrancar

Para que el backend llegue siquiera a importar `app` hacen falta `DATABASE_URL`,
`DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` y
`JWT_SECRET`.

**No basta con `DATABASE_URL`**: `src/config/db.ts` valida las cuatro por separado
y `src/utils/jwt.handle.ts` lanza si falta el secreto. En local vienen del `.env`,
que no está versionado; el workflow `.github/workflows/verificacion.yml` las
declara con valores de relleno.

Para reproducir las condiciones del CI en local: apartar el `.env`, exportar esas
seis variables a mano y ejecutar la suite.

Y después de cada `git pull`, `npx prisma generate` en el backend antes del
typecheck.

---

## 4. Cómo comprobar de verdad que una ruta está protegida

**Sondeando el servidor, no leyendo el router.** Se levanta `app` en un puerto
efímero y se mide la respuesta sin sesión:

- **401** → la ruta está protegida.
- **500** → la petición atravesó los middlewares y llegó a la base de datos, es
  decir, **no** está protegida.

El motivo es que en Express el orden de declaración manda: una ruta escrita
*antes* del `.use(authenticateToken)` de su router queda abierta aunque el fichero
parezca correcto y los comentarios afirmen lo contrario. Así se encontró la
regresión de `GET /api/news/admin/archive`, que exponía los borradores sin sesión
y que leyendo el código no saltaba a la vista.

Sirve igual para lo contrario: comprobar que un arreglo no ha cerrado de más una
ruta que debía seguir siendo pública.

Por eso mismo, cuando una ruta nueva se declara por encima de un `.use()` de
autenticación —como `/news/admin/:id`, `/publications/:id` o
`/inventario/prendas/:id`—, lleva sus middlewares en línea y un comentario que
explica **por qué** el orden es de corrección y no de estilo. No reordenar esos
ficheros «para que queden más limpios».

---

## 5. Trampas al levantar los servidores en local

**Un 404 en una ruta que sí existe suele ser otro proceso.** Si en el puerto
esperado sigue escuchando un backend arrancado horas antes, responde con el código
de antes de tus cambios y arrancar otro `npm run dev` no avisa de nada útil. Antes
de tocar código, comprobar **qué proceso responde y desde cuándo**:

```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen |
  ForEach-Object { Get-Process -Id $_.OwningProcess | Select-Object Id,StartTime }
```

Para levantar el backend en otro puerto sin matar el que ya corre, y que el
frontend apunte ahí (`vite.config.ts` lee esa variable para el proxy de `/api`):

```bash
PORT=3002 npx tsx src/index.ts
VITE_DEV_BACKEND_URL=http://localhost:3002 npx vite
```

Y un detalle de shell: arrancar un servidor con `npm run dev 2>&1 | head -40` lo
mata en cuanto `head` cierra la tubería. Para dejarlo vivo, redirigir a un fichero
de log.

---

## 6. Dos trampas en los tests

**La opción `skip` del runner de Node espera un valor, no una función.** Escrito
como `skip: () => …`, la función nunca se llama y, al ser *truthy*, el test queda
omitido para siempre. Dos tests de base de datos estuvieron desactivados semanas
sin que nadie lo notara. El skip va dentro del cuerpo, con `t.skip(motivo)`.

De ahí la regla que se aplica en todo el proyecto: **omitido no es pasado**. Un
test que necesita MariaDB se omite *con motivo* si no está levantada, y una suite
que declara omisiones cuando la base sí está disponible es una suite que miente.

**El typecheck del frontend es `npx tsc -b`, no `tsc --noEmit`**: el proyecto usa
*project references* y sin `-b` no comprueba nada. (`tsc --noEmit -p
tsconfig.app.json` sí funciona para comprobar solo la aplicación.)

---

## 7. Paginación: todo `orderBy` paginado lleva desempate

Un listado paginado cuyo `orderBy` no sea único hace que **una fila salga en dos
páginas y otra en ninguna**, porque MariaDB no garantiza el mismo orden entre dos
consultas con `LIMIT/OFFSET` cuando hay empates. La convención es cerrar siempre
con `{ id: 'asc' }`:

```ts
orderBy: [{ fecha: 'desc' }, { id: 'asc' }]
```

No es una precaución teórica: pasaba en ocho listados, entre ellos el libro mayor
y tesorería, porque los recibos de la siembra se insertan con un solo `createMany`
y comparten `createdAt` al milisegundo. El detalle está en
[`traspaso-2026-09-01.md`](traspaso-2026-09-01.md).

Y en los esquemas de validación (arktype): **borrar entero el bloque `query` no
rompe la paginación** —`validate` solo sobrescribe `req.query` si el esquema
declara `query`, así que la consulta cruda sobrevive—. Lo que sí la rompe es
declarar `query` **incompleto**: añadir un filtro y olvidarse de esparcir
`...paginacionQuery`.
