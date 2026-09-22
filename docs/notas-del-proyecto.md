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

**Para arrancar el servidor** (`src/index.ts`, no al importar `app`: los tests no
lo notan) hace falta además `NODE_ENV` con `development`, `test` o `production`.
`.env.example` la trae vacía a propósito: sin ella todo fallaba abierto (cookies
sin `Secure`, sin HSTS, siembra con las contraseñas del repo). En producción
`src/config/entorno.ts` exige también `FRONTEND_URL`, `API_URL`, `EMAIL_*`,
`NUM_PROXIES`, `TOTP_ENC_KEY`, `CLAMAV_HOST` y `CLAMAV_REQUIRED=true`, y lista de
una vez todo lo que falta.

Las migraciones no se crean con `prisma migrate dev`: el usuario de la base no
puede crear la base «sombra». Se escribe el SQL con
`npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`,
se guarda en `prisma/migrations/<fecha>_<nombre>/migration.sql` y se aplica con
`npx prisma migrate deploy`.

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

## 6. Trampas en los tests

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

**El typecheck del backend es `npm run comprobar-tipos`, no `tsc --noEmit`.** El
`tsconfig.json` describe lo que se compila a `dist/`, así que excluye
`**/*.test.ts`: con `tsc --noEmit` a secas, **las pruebas quedan fuera del
compilador**. Durante meses no lo estuvieron, y el efecto es traicionero: un
test puede dejar de probar lo que dice y seguir «pasando», porque nadie lo
compila. Pasó al partir `EmailService`, con dos ficheros escribiendo encima de
campos privados que ya no existían. `tsconfig.test.json` los incluye y es lo que
corre el CI.

**Un test que alcanza los interiores de un servicio con `as unknown as` no lo
protege nadie**, ni siquiera con lo anterior: el cast borra justo el nombre que
habría que comprobar. Si un test necesita sustituir una pieza interna, la pieza
se declara alcanzable (como `TransaccionService.exigirNombreLibre`, que dejó de
ser `private` por eso) o sale a su propio módulo con una puerta declarada (como
`ponerTransporte` en `services/correos/envio.ts`). Así, moverla rompe la
compilación en vez de vaciar la prueba en silencio.

**Después de un menú o un diálogo de MUI, hay que esperar a que se cierre antes
de usar `getByRole`.** Mientras dura la transición de cierre, MUI deja el resto
del árbol en `aria-hidden` y bloquea el scroll del `body`. `getByRole` **no ve
lo oculto**, así que no encuentra nada; `getByLabelText` sí, porque no filtra
por accesibilidad. De ahí un fallo que solo salía en el CI y nunca en local, y
que además señalaba a la línea equivocada: caía en la primera consulta por rol
posterior al menú, no donde estaba el problema. La espera va en el ayudante que
abre el menú, no en cada test:

```ts
await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
```

**Los ficheros de test del backend van uno detrás de otro**
(`--test-concurrency=1`, en `npm test` y en el CI). Comparten la base de datos, y
varios trabajan sobre su estado global: generar cuotas emite un recibo a *todos*
los hermanos activos, el panel suma todos los apuntes, el número de hermano sale
de `máximo + 1` y borrar el último ADMIN bloquea la tabla de usuarios. En
paralelo (lo que hace `node --test` por defecto) se pisaban: fallos que salían
una vez de cada tres, limpiezas que chocaban con claves ajenas y, lo peor, una
suite colgada esperando un bloqueo. En serie tarda algo más de un minuto en vez
de quince segundos; se prefirió así. **No quitar el flag** para ganar tiempo.

Aun así, un test que lea totales globales debe usar valores propios o tolerar lo
que dejen los datos de la base de desarrollo, y un test que retenga una
transacción a propósito tiene que soltarla en un `finally`: una transacción
abierta deja la fila bloqueada y cuelga la limpieza del final.

**Un diálogo de MUI abierto convierte en verdes las aserciones negativas por
rol.** Mientras el modal sigue montado, su `ModalManager` pone `aria-hidden` a
todos los hermanos del diálogo —o sea, al resto de la página—, y las consultas
`*ByRole` de Testing Library excluyen por defecto lo que esté `aria-hidden`.
Consecuencia: **cualquier** `queryByRole(...)` seguido de `not.toBeInTheDocument()`
escrito después de confirmar un diálogo pasa sin mirar nada. El elemento sigue
en el DOM, el test no lo ve y la aserción se cumple igual que si el arreglo
existiera.

No basta con esperar un tick: el diálogo sigue montado hasta que **termina su
transición de salida**. Hay dos formas de esperar a que el árbol de
accesibilidad vuelva:

```ts
await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
// …o poner delante un findByRole positivo, que no resuelve hasta que vuelve:
await screen.findByRole('button', { name: 'Guardar' })
```

Solo muerde a `*ByRole`. `getByLabelText`, `getByText` y `getByDisplayValue` no
filtran por `aria-hidden` y siguen viendo la pantalla tapada.

Se había pisado cuatro veces y cada una se resolvió a mano sin dejarlo escrito
en ninguna parte (los comentarios están en `AccountingAdminPage.test.tsx:182`,
`BrothersAdminPage.test.tsx:205`, `NewsAdminPage.test.tsx:42` y
`PortadaAdminPage.test.tsx:186`). Por eso está aquí: cuesta una tarde
encontrarlo y treinta segundos evitarlo.

## 6 bis. MariaDB 11.8 y los choques de transacciones

La base de desarrollo trae `innodb_snapshot_isolation=ON`: si dos transacciones
tocan la misma fila, la segunda falla con el error **1020** («Record has changed
since last read»), o **1213** si es un interbloqueo. Prisma **no** los traduce a
P2034, y la forma en que los entrega **cambia con la versión**: la 7.3 los dejaba
como `DriverAdapterError` suelto (código en `cause`) y la 7.10 los envuelve en un
`P2039` con el código en `meta.driverAdapterError.cause`. Se reconocen en un solo
sitio, `esConflictoDeConcurrencia` (`src/utils/error.handle.ts`): de ahí tiran el
reintento (`esConflictoTransitorio`) y el 409 «Otra persona ha cambiado estos
datos a la vez». Un doble clic en «Aprobar» era un 500 por esto, y al subir
Prisma a 7.10 volvió a serlo hasta cubrir la forma nueva: **después de actualizar
Prisma, pasar `test/censo-altas-bajas.test.ts` y `test/transaction-retry.test.ts`**.

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

---

## 8. Los correos automáticos: cómo verlos y por qué salen incompletos

**Para revisarlos en local no hacen falta credenciales de Gmail.** Con
`EMAIL_BUZON_PRUEBAS="true"` en el `.env` del backend, cada correo se escribe
como un `.html` en `backend-desamparados/storage/correos` en vez de enviarse, con
el sobre (de, para, asunto) en una cabecera amarilla. Se abre con doble clic.

Se enciende **a mano y nunca por omisión**, aunque falten `EMAIL_USER` y
`EMAIL_PASS`. Y queda **apagado dentro del ejecutor de tests** aunque el `.env` lo
pida (`buzonPedido()` mira `NODE_TEST_CONTEXT`): aprobar, rechazar y dar de baja
mandan correo, cinco ficheros de test hacen esas operaciones, y sin ese freno cada
`npm test` dejaba 46 `.html` sueltos en `storage/correos`. En producción también
se ignora, y además `entorno.ts` exige las dos credenciales para arrancar.

**Sin cuenta configurada, el envío falla en el acto y sin abrir conexión.** Antes
se creaba el transporte de Gmail con credenciales vacías y cada correo se quedaba
esperando al SMTP hasta agotar el tiempo: desde que las bajas mandan correo, eso
colgaba la suite entera y habría colgado también al CI, que no tiene ningún `.env`.
Lo fija `test/correos-solicitud.test.ts`, que comprueba que no se crea ningún
transporte.

**Un correo que no sale deja rastro en la auditoría** (`EMAIL_FALLIDO`), visible
en `/cms/auditoria`. Antes moría en un `console.error`: el alta se completaba, el
solicitante no recibía nada y nadie se enteraba. La dirección se guarda
**enmascarada**.

**Los correos salen deliberadamente incompletos.** El horario de Secretaría, la
dirección, el teléfono y el escudo viven en `shared/datos-entidad.json` con el
mismo criterio que `config/site.ts` en la web: `null` es «pendiente de confirmar»
y el bloque entero **desaparece** del correo. Antes iban escritos a mano en la
plantilla una «C/ Falsa, 123, 29000 Málaga», un horario inventado y un
`secretaria@tucofradia.com` que no es nuestro. Un correo automático no se puede
corregir una vez enviado: es mejor que salga corto a que mande a un solicitante a
una calle que no existe. **En cuanto el Grupo Parroquial confirme esos datos, se
rellenan ahí y aparecen solos.**

**El aviso de rechazo se envía después de borrar la cuenta.**
`rechazarSolicitud` elimina el usuario entero cuando nunca llegó a aprobarse, así
que el email y el nombre se leen **antes** de la transacción. Por el mismo motivo
el asunto de ese correo no lleva el nombre: si el envío falla, el asunto acaba en
la auditoría, y eso devolvería a la base el dato que se acaba de borrar.

---

## 9. El contenido también migra, y `prisma migrate` no lo hace

Desde que toda la web pública se edita por bloques, el Recorrido, la Sagrada
Titular y la Historia tienen otra forma dentro de `ContenidoPagina.datos`. Eso
es **contenido, no esquema**: `prisma migrate deploy` no lo toca, así que una
base sembrada antes del 18 de septiembre de 2026 llega al despliegue con la
forma antigua.

Lo que pasa entonces no es un error, y por eso es peligroso: `mezclarConDefectos`
solo conserva del documento guardado las claves que existen en los valores por
defecto. Con la forma antigua no queda ninguna, esas tres páginas **vuelven a
los textos de partida y lo editado desaparece en silencio**.

Lo convierte `npm run migrar:bloques -- --aplicar` (sin `--aplicar` solo
informa, y es idempotente). Va **antes de que nadie abra el CMS**, y está en
[`despliegue.md`](despliegue.md), en «Despliegues posteriores».

Por si aun así se olvida, **el arranque de la API lo avisa** en el registro
cuando quedan filas sin convertir. Es un aviso y no una barrera: el contenido no
es el esquema, y dejar la web caída sería peor que esas tres páginas con sus
textos de partida. La detección vive en `domain/paginas-sin-migrar.ts`, la usan
el script y el arranque, y la fija `test/paginas-sin-migrar.test.ts`.

**La lección general:** cuando cambie la *forma* de algo guardado como JSON,
el cambio necesita su propio paso de migración y alguien que avise si falta. El
compilador no ve dentro de una columna JSON.
