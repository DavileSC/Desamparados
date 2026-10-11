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

**Y hay que revisar los nombres de tabla antes de guardarlo.** La MariaDB de
Windows guarda las tablas en minúsculas (`lower_case_table_names`), así que un
`ALTER TABLE` sale como `` `pagoenlinea` `` en vez de `` `PagoEnLinea` ``. En
Windows funciona; en el servidor Linux, donde los nombres distinguen
mayúsculas, la migración falla y la API no arranca. Un `CREATE TABLE` sale
bien porque el nombre lo pone Prisma; los `ALTER` hay que corregirlos a mano.

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
`/ropero/prendas/:id`—, lleva sus middlewares en línea y un comentario que
explica **por qué** el orden es de corrección y no de estilo. No reordenar esos
ficheros «para que queden más limpios».

**Una sesión del CMS no basta: también hace falta el 2FA activo.** `checkRole`
responde 403 `FALTA_DOBLE_FACTOR` a toda cuenta del equipo sin él, salvo en
las dos rutas que lo activan (`checkRole(roles, { sinDobleFactor: true })`).
Ninguna otra ruta lleva esa opción. Una ruta que mire `req.sesiones.cms` sin
pasar por `checkRole` no tiene esa garantía y la comprueba ella (como el
borrado de la propia cuenta en `mis-datos.service`). En las pruebas,
`crearUsuarioPrueba` hace a los cargos con `twoFactorEnabled: true` y sin
secreto. La que entre por contraseña en el CMS o active el 2FA pide
`{ dobleFactor: false }`.

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

**Sin `instalacion/datos-entidad.json` no arranca nada**: ni la API, ni
`npm run dev` de la web, ni el contenedor de la web. El build sí (`npm run
build`): la web compilada no lleva los datos, los lee al cargar de
`/instalacion.js`. Está fuera de git, así que tras clonar hay que crearlo (el
comando está en «Los datos de la corporación», en `despliegue.md`).

**Tras el pull de la etapa 2 de la Fase 8 (octubre de 2026) hay que borrar**
`desamparados-web/index.html`, `public/manifest.json` y `public/robots.txt`,
los que generaba `generar-identidad.mjs` sin seguir por git. Son
reproducibles. Por razones distintas:

- **Solo `index.html` hace chocar el pull**: ahora está en git (es la
  plantilla, con sus marcas `{{…}}`) y Git no pisa el fichero suelto. Se
  borra antes del pull.
- **`manifest.json` y `robots.txt` no chocan**, pero sobran: ya no se
  generan en la carpeta (los sirve el plugin de Vite en desarrollo y los
  escribe el contenedor al arrancar). Si se quedan, la guardia de Vitest
  falla al verlos en `public/` y `vite build` los copiaría a `dist/` con los
  datos de la corporación dentro. Se pueden borrar antes o después.

**La plantilla no se edita pensando en que la rellene `vite build`.** El
`index.html` de `dist/` sale con las marcas y lo rellena
`scripts/instalacion-web.mjs` al arrancar el contenedor. Dos trampas que
costaron verlas:

- **`gzip_static` sirve el `.gz` que encuentra al lado.** El build comprimía
  todo `dist/`, también `index.html`: el navegador habría recibido la
  plantilla con `{{nombre}}` aunque el `index.html` de al lado estuviera
  relleno. Por eso el `find … gzip` de `web.Dockerfile` excluye `index.html`
  y la orden escribe su `.gz` (`--comprimir`).
- **El entrypoint de nginx solo lanza `/docker-entrypoint.d/` si el CMD
  empieza por `nginx`.** Con el `sh -c "while …; exec nginx"` de antes, el
  guion de los datos no se habría ejecutado nunca y la web habría salido sin
  ellos. El CMD es `["nginx", "-g", "daemon off;"]` y el bucle que recarga
  el certificado vive en `90-recargar-certificado.sh`. No volver a envolverlo
  en un `sh -c`.
- **Ese bucle corre en una subshell que hereda `set -eu`.** Sin el `set +e`
  de dentro, el primer `nginx -s reload` fallido lo mataba sin decir nada, y
  con su salida a `/dev/null` nadie se enteraba. Escribe en
  `/proc/1/fd/1` y `/proc/1/fd/2` (los de nginx, que es el proceso 1): así
  llega a `docker logs` sin quedarse con la tubería del entrypoint. Para
  probarlo sin esperar seis horas, `RECARGA_CERTIFICADO_CADA=3s`.

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
suite colgada esperando un bloqueo. En serie tarda bastante más (unos minutos
la suite entera); se prefirió así. **No quitar el flag** para ganar tiempo.

Aun así, un test que lea totales globales debe usar valores propios o tolerar lo
que dejen los datos de la base de desarrollo, y un test que retenga una
transacción a propósito tiene que soltarla en un `finally`: una transacción
abierta deja la fila bloqueada y cuelga la limpieza del final.

**En local, los módulos son los de la base de desarrollo.** En el CI la base es
nueva y la siembra los enciende todos; en local, lo que se haya apagado desde
Sistema → «Módulos» sigue apagado, y una prueba que lo use falla con un 404 de
módulo apagado sin que nada esté roto (pasó con `apadrinamientos` el
09-10-2026). La prueba que necesite un módulo lo enciende ella con
`encenderModulos([...])` de `test/fixtures/modulos.ts`, con sus requisitos, y
en el `after` llama a lo que devuelve, que lo deja como estaba.

**Los falsos rojos del frontend eran esperas cortas, no pruebas rotas**
(revisado el 09-10-2026). Con la suite entera, un trabajador por núcleo se
reparte la CPU y todo tarda hasta el doble. Caían por tres sitios:

- `findBy…` y `waitFor` esperan 1 s de serie; ahora 5 s para todos
  (`configure` en `src/test/setup.ts`). Terminan en cuanto aparece lo
  esperado: esperar más solo alarga una prueba que de verdad falla.
- Topes propios que se quedaron viejos: puestos cuando el general era de 5 s
  (`{ timeout: 15_000 }` en Portada, Tesorería y Contabilidad), al subir el
  general pasaron a ser más **cortos** que él y quitaban margen. El general es
  ahora de 30 s (`vitest.config.ts`). **No se pone un tope propio por debajo
  del general**, ni un `{ timeout: 3000 }` en un `waitFor`.
- Las pruebas gigantes (Hazte hermano con menores, el vídeo de la galería, el
  ancla del constructor) tardan unos 30 s solas: llevan 60 s propios.

Si una vuelve a caer solo con la suite entera, se pasa sola con
`--reporter=verbose` para ver cuánto tarda, y se compara con su tope.

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

Se había pisado cuatro veces (en las pruebas de Contabilidad, Hermanos,
Noticias y Portada del CMS) y cada una se resolvió a mano sin dejarlo escrito
en ninguna parte. Por eso está aquí: cuesta una tarde encontrarlo y treinta
segundos evitarlo.

**Las pruebas no corren con Desamparados, sino con la corporación de
ejemplo** (`shared/datos-entidad.ejemplo.json`: «la Hermandad de Nuestra Señora
de la Esperanza», de Villanueva). Las de los dos lados la eligen solas, aunque
en la máquina exista `instalacion/datos-entidad.json` (ver «Los datos de la
corporación» en `despliegue.md`). Una prueba que espere «del Grupo» o
«Desamparados» escrito falla. Se compara con lo que sale de la identidad
(`deLaCorporacion({ corto: true })`, `site.titular`, `identidad.nombre`…), o
con el ejemplo si lo que se prueba es justo la frase. Cuando se cambió, cayeron
así 17 pruebas de la web y 7 de la API.

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

**El texto de los correos no está en el código.** Los que leen hermanos y
donantes salen de una plantilla (CMS → Emails): la que esté en uso para ese
correo o, si no hay ninguna, su texto original en `shared/usos-de-correo.json`.
El código solo prepara los campos (`{{nombre}}`…) y los bloques fijos
(`[[papeleta]]`…). Para cambiar un texto de partida, se cambia ese JSON; para
añadir un campo o un bloque a un correo, se declara allí y se rellena en su
`enviar…`: la revisión de la plantilla rechaza lo que el catálogo no declara.
El aviso interno a Secretaría y el del formulario de contacto siguen en el
código: no los lee ningún hermano.

**Los correos salen deliberadamente incompletos.** El horario de Secretaría, la
dirección, el teléfono y el escudo viven en `instalacion/datos-entidad.json` con el
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
el asunto de ese correo no lleva el nombre. Desde octubre de 2026, un correo que
falla deja en la auditoría la **clave del uso** (`solicitud_rechazada`…) y un
resumen del error sin direcciones, nunca el asunto: el asunto lo escribe la
plantilla y podía llevar el nombre de quien lo recibía durante los 730 días de
la auditoría.

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

---

## 10. Las fotos del CMS se recortan a 1920 px de lado

Al subir una foto se le quitan los metadatos (el EXIF con el GPS), se recomprime
y **se reduce si pasa de 1920 px de lado mayor**. Ese tope es el ancho de la
foto más grande que la web sirve de serie (`hero-1920.webp`); no hay ningún
sitio donde se pinte nada mayor.

Hasta septiembre de 2026 no existía el tope: se recomprimía, pero una foto
recién hecha con el móvil entraba con sus 4000 px y se servía así a todo el
mundo, también al móvil que la iba a pintar a 400. Con doce fotos, una galería
eran decenas de MB por visita.

**Las animaciones se dejan del tamaño que vengan.** Al resolver una WebP
animada, el alto que ve sharp es el de todos los fotogramas apilados, y un tope
de alto la encogería sin motivo.

Y **nunca se agranda** (`withoutEnlargement`): subir la resolución de una foto
pequeña solo la emborrona y la engorda.

**Cada foto pública lleva además dos copias: `<hex>-640.webp` y
`<hex>-1280.webp`** (desde octubre de 2026), para el `srcset` de la web.
Existen **siempre**, aunque la foto sea más estrecha (entonces son una copia
idéntica): la web deduce sus direcciones de la URL guardada y no pregunta. Por
eso, si una foto se copia o se restaura a mano en `storage/public`, hay que
pasar después `npm run imagenes:variantes`, o la web pedirá copias que no están.
Borrar la foto se lleva sus copias (`borrarSubida`) y el script de huérfanos las
trata como parte de su foto. El contrato vive en `domain/variantes-de-foto.ts`.

**Lo que se sube espera en `storage/subiendo` hasta pasar las comprobaciones**
(tipo real, antivirus, sharp) y solo entonces se mueve a `storage/public`:
nginx sirve esa carpeta directamente del disco y, si multer escribiera allí,
un fichero sin validar sería descargable durante esos segundos.

---

## 11. El contraste de la web pública

El tema público es oscuro (`#262326` de fondo) y los pares que se usan de
verdad cumplen WCAG AA:

| Sobre el fondo | Contraste | |
|---|---|---|
| Texto principal (`#ffffff`) | 15,6:1 | ✅ |
| Texto secundario (`#e4e2df`) | 12,0:1 | ✅ |
| Dorado de los enlaces activos (`#c1ac00`) | 6,8:1 | ✅ |
| Blanco sobre el granate de los botones (`#a03d44`) | 6,5:1 | ✅ |

**Dos combinaciones no cumplen y por eso no se usan así:**

- **El granate como texto sobre el fondo oscuro: 2,4:1.** Vale para un relleno
  con texto blanco encima, no para escribir con él. El único sitio donde se
  usaba de color de letra era el `:hover` del menú del área de hermanos.
- **Blanco sobre el dorado: 2,3:1.** No hay ningún `color="secondary"` relleno
  en la web, y no debe haberlo: el dorado es para escribir sobre el fondo
  oscuro, no para rellenar con texto blanco encima.

Antes de meter un color nuevo, calcular el contraste. El cálculo es el de WCAG
sobre la luminancia relativa; cualquier comprobador en línea vale.

---

## 12. Los módulos activables

Catálogo de 24 claves en `shared/modulos.json`; lo que no está en la lista es
núcleo y nunca pregunta por un módulo (solo los módulos preguntan por el
núcleo o por otros módulos). Apagar oculta, no borra: los datos se conservan.

**Toda etiqueta de módulo es obligatoria y la vigila una guardiana que lee
texto, no código.** Todo router de `app.ts` (`conModulo('clave')` o
`nucleo`), toda entrada de los tres menús (`modulo:` en la misma línea que
`label:`, también dentro de las secciones partidas en varios bloques), toda
ruta de `routes/index.tsx` (`pagina(Componente, modulo)` en una sola línea) y
todo tipo de bloque de `shared/tipos-de-bloque.json` llevan su módulo.
`test/modulos-cobertura.test.ts` lee esos ficheros como texto —no puede
importar la web desde `node:test`— y exige una entrada por línea; una ruta
partida en dos líneas no se comprueba (por eso `/cms/acceso` y
`/cms/vista-previa/:slug` se dejaron en una sola). Una ruta nueva sin decidir
esto no pasa el CI.

**Añadir un módulo son tres sitios, no uno.** Las claves van en
`shared/modulos.json` y, además, en `CLAVES_MODULO` de
`backend-desamparados/src/domain/modulos.ts` y de
`desamparados-web/src/domain/modulos.ts` (para que compilen). El `RECUENTOS`
de `modulos.service.ts` también lo exige, porque TypeScript lo comprueba por
el `Record<ClaveModulo, …>`. Dos pruebas (`modulos-catalogo.test.ts` y
`domain/__tests__/modulos.test.ts`) y la propia guardiana avisan si falta
alguno de los tres.

**El estado vive en memoria en el backend, un proceso por servidor.** Se
carga la primera vez que algo pregunta y se recarga solo al cambiarlo desde
el CMS. En las pruebas, apagar un módulo escribiendo en la tabla `Modulo` no
basta: hace falta llamar a `ModulosService.cargar()` después para que la
memoria se entere, y volver a encenderlo en `after` para no dejarlo apagado
de cara al siguiente fichero.

**Una prueba que levanta `app` y pide una ruta de `/api/...` tiene que
desconectar la base en su `after`** (`await db.$disconnect()`), aunque no la
use a mano: las guardas de módulo consultan `Modulo` en la primera petición,
Prisma abre su pool de conexiones y, sin desconectar, el proceso no termina y
`npm test` se queda colgado en ese fichero (pasó con
`servidor-cuerpos.test.ts` y `limitador-global.test.ts`).

**Las pruebas que apagan módulos en la tabla no se pueden lanzar en
paralelo.** Varios ficheros (`modulos-apagados-db`, `modulos-enganches-db`,
`modulos-area-hermanos-db`…) comparten la misma tabla: sueltos a mano sin
`--test-concurrency=1` se pisan, uno ve apagado lo que apagó el otro.
`npm test` y el CI ya van en serie (ver §6); lanzar varios de estos ficheros
sueltos a mano, no.

**En las pruebas de la web, toda pantalla que pregunte por los módulos
necesita un cliente de consulta sembrado.** `renderWithProviders` siembra
todos los módulos encendidos salvo que se pase `modulos: [...]`; si la
pantalla necesita su propio router, `crearQueryClientDePruebas()` de
`src/test/queryClient.ts` hace lo mismo. Con un `new QueryClient()` a secas,
`useModulos()` pide `/api/modulos` al `fetch` simulado y lo da todo por
apagado: pasó en `PaginaAdminPage.test.tsx` y tres pantallas más (menús,
galería de bloques, bloques de página, formularios de listado, Inicio, perfil
del área de hermanos). La siembra lleva
`setQueryDefaults(['modulos'], { gcTime: Infinity, staleTime: Infinity })`
antes de `setQueryData`: con el `gcTime: 0` del cliente de pruebas, una
entrada sembrada sin un observador se recolecta en el siguiente tick.

**El ropero está en `/api/ropero` (módulo `procesion`), no en
`/api/inventario`.** Las prendas, los cíngulos y la búsqueda por número de
hermano viven en ese router nuevo; el Inventario de enseres es otro módulo y
otra pantalla.

**El aviso del banco nunca se apaga.** `POST /api/pagos/redsys/notificacion`
se monta como núcleo: un pago empezado antes de apagar Pago en línea es
dinero real.

**Con el área de hermanos apagada, el acceso rechaza a todo el mundo.**
`/acceso` responde 404 con «El área de hermanos no está activada en esta
instalación», y una sesión de hermano que ya existiera se ignora en
`middleware/session.ts`: no basta con ocultar el enlace de entrada.

**Al desplegar basta la migración: las filas se siembran solas al arrancar.**
La migración `20261031200000_modulos_activables` crea la tabla, y el arranque
de la API (`src/index.ts`) llama a `ModulosService.cargar()`, que a su vez
llama a `sembrar()`: crea las filas que falten con el lote inicial (lo que
diga `modulos.activos` de `instalacion/datos-entidad.json`) y no toca ninguna que
ya exista. `npx prisma db seed` hace lo mismo, pero no hace falta solo por
esto. Por eso una instalación nueva ajusta `modulos.activos` **antes del
primer arranque**: después las filas ya existen y el JSON no cuenta. El
arranque **sale con error si la base no responde**: no hay forma de arrancar
con el estado de los módulos a medias.

**El sitemap lo sirve la API, en `/sitemap.xml`** (desde octubre de 2026;
antes era un fichero estático de la web que solo conocía el lote inicial de
módulos y no nombraba las noticias). Se arma en cada petición con los módulos
encendidos en ese momento y las noticias publicadas, cada una con su
`lastmod`. Las páginas fijas salen de `shared/rutas-publicas.json`, que genera
`npm run sitemap` en la web leyendo su router: **tras añadir o quitar una
ruta pública hay que regenerarlo y confirmarlo**, y la prueba
`scripts/__tests__/sitemap.test.ts` de la web falla si no. nginx manda
`/sitemap.xml` a la API (`docker/nginx/ubicaciones.conf`); `robots.txt` sigue
apuntando ahí.

**Un 404 `MODULO_NO_ACTIVADO` hace que la web vuelva a pedir la lista de
módulos.** `llamarApi` avisa (`alModuloNoActivado`, en `lib/api/cliente.ts`)
y `useModulos` invalida `['modulos']`: una sesión abierta se entera de lo que
Administración apagó desde otra sin recargar. En una prueba, un `fetch`
simulado que responda ese 404 provoca una petición a `/modulos` que el
simulado tiene que saber contestar.
