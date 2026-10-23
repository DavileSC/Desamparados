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

**Tras el pull de la etapa 4 de la Fase 8**, el escudo y los iconos ya no
están en git: hay que ponerlos en `instalacion/marca/` (§13 dice cómo).

**La cabecera de `index.html` no está en `index.html`.** Título, iconos, Open
Graph y JSON-LD viven en `shared/cabecera.plantilla.html`; la API la rellena
con lo guardado en el CMS y la escribe en `storage/public/instalacion/`, y
nginx la mete con SSI donde `index.html` dice `<!--# include virtual="/_cabecera" -->`
(en desarrollo, el plugin de Vite). Trampas:

- **`gzip_static` sirve el `.gz` que encuentra al lado, sin pasar por el
  SSI.** Un `index.html.gz` en `dist/` saldría sin cabecera (el comentario
  tal cual). Por eso el `find … gzip` de `web.Dockerfile` excluye
  `index.html`, que se comprime al vuelo.
- **El SSI solo se hace en `location = /index.html`.** El reenvío de la SPA
  (`try_files … /index.html`) y el `index` de `/` llegan ahí por redirección
  interna; una `location` nueva que sirva `index.html` de otra forma tiene que
  llevar `ssi on`, o saldrá sin título. Y lo mismo en `sitio-local.conf`, que
  no incluye `ubicaciones.conf`.
- **La web arranca después de la API** (`depends_on: service_healthy`): la API
  publica antes de escuchar, así que cuando nginx sirve la primera página la
  cabecera ya existe. Sin ella, el SSI deja un «[an error occurred…]» en el
  `<head>`.
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

**La base del CI es nueva; la de desarrollo, no.** La migración
`salidas_neutras_en_base_nueva` renombra las dos salidas sembradas («Estación
de penitencia», «Rosario de la Aurora») solo en una base sin páginas, que es
la del CI; la de desarrollo sigue con «Sábado de Pasión» y «Rosario
vespertino». Una prueba que escriba el nombre de una salida pasa en local y
falla en GitHub (pasó el 12-10-2026 con siete). Lo esperado se calcula de la
salida de la base: `conceptoDe`, `deLaSalida`, `aLaSalida` y `literal` de
`test/fixtures/salidas.ts`. Para reproducir el CI en local, la suite sobre una
base nueva: `DATABASE_URL` y `DATABASE_NAME` a una base vacía, `npx prisma
migrate deploy`, `npx prisma db seed` y `npm test`.

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

**Las plantillas son piezas, no texto.** Desde el editor nuevo (octubre de
2026) cada plantilla guarda una lista de piezas de una paleta cerrada en
`PlantillaCorreo.contenido` (JSON; `domain/plantillas-correo.ts`). Los
originales del catálogo siguen en el formato de texto de antes y las
plantillas guardadas antes del editor tienen `contenido` a NULL: las dos se
leen con `leerCuerpo` y pasan a piezas al volver a guardarse. Una pieza nueva
se añade en cuatro sitios a la vez: el tipo y la revisión (`domain/`), el
esquema arktype, su HTML en `correos/plantilla.ts` + `componer.ts`, y su nodo
y su vista en `desamparados-web/src/features/cms/emails/editor/`. Las fotos de
una plantilla viajan dentro del correo como adjuntos en línea, pasadas a JPEG
(`correos/fotos.ts`: Outlook no pinta WebP), y cuentan como «en uso» en
`utils/ficheros-publicos.ts` junto con las de su historial.
El aviso interno a Secretaría y el del formulario de contacto siguen en el
código: no los lee ningún hermano.

**Los correos salen deliberadamente incompletos.** El horario de Secretaría, la
dirección y el teléfono viven en `instalacion/datos-entidad.json` con el
mismo criterio que `config/site.ts` en la web: `null` es «pendiente de confirmar»
y el bloque entero **desaparece** del correo. Antes iban escritos a mano en la
plantilla una «C/ Falsa, 123, 29000 Málaga», un horario inventado y un
`secretaria@tucofradia.com` que no es nuestro. Un correo automático no se puede
corregir una vez enviado: es mejor que salga corto a que mande a un solicitante a
una calle que no existe. **En cuanto el Grupo Parroquial confirme esos datos, se
rellenan ahí y aparecen solos.** El escudo y la imagen bajo el membrete no
van ahí: son ficheros de `instalacion/marca/` (§13); sin `correo-cabecera.jpg`
el correo va sin imagen.

**La cola de correos guarda direcciones, y la supresión las tiene que quitar.**
`ComunicadoEnvio` y `CorreoEnCola` llevan la dirección (y el nombre o el correo
entero) de cada envío, sin clave ajena a la cuenta: borrar la cuenta no se
las lleva. `deleteOwnAccount` retira lo pendiente (`retirarPendientes` de
`correos/cola.ts`, que además cierra el comunicado que se queda sin nada) y
anonimiza lo enviado. Una tabla nueva que guarde una dirección o un aparato de
la persona entra ahí y en «Descargar mis datos» (`exportMisDatos`), o la
supresión se queda a medias sin que nada falle. Lo mismo con los contadores
de la entrada, las redes confiadas y los rebotes (`FalloDeAcceso`,
`RedConfiada`, `CorreoQueRebota`): guardan el correo en claro, y los borra
`olvidarCuenta` (`utils/contador-fallos.ts`).

**El tope diario es uno para todos los correos.** `enviadosHoy` suma lo de la
cola y los sueltos (`CorreosSueltosDelDia`, que cuenta `enviarCorreo`). Un
envío nuevo que salga por la cola pasa `desdeLaCola: true`, o se contaría dos
veces; uno suelto no pasa nada y cuenta solo.

**Los avisos de cargo de una remesa (lote `remesa:…`) salen delante de todo
en la cola.** Es el aviso previo que pide la norma SEPA, y detrás de un
boletín esperaba días. La previa de la remesa calcula con el tope cuándo sale
el último (`diasHastaElUltimoAviso`). Si un recibo sale de la remesa con su
aviso aún en la cola, `rehacerAvisoDeCargo` lo reescribe o lo retira: quien
saque recibos de REMESADO por otro camino que `adminUpdateDetalles` tiene que
llamarlo también.

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

**Una migración de contenido no busca el JSON como texto con su formato.**
MariaDB guarda tal cual lo que escribe Prisma (`{"a":1}`), pero una fila que ha
pasado por `JSON_SET` o `JSON_REPLACE` queda con espacios (`{"a": 1}`). La de
Formación del 23-10-2026 buscaba `LIKE '%"estilo":"carta"%'`: en el PC encajó y
en la web de pruebas, cuya página tenía la foto puesta por `JSON_SET`, no hizo
nada sin dar error. Hizo falta otra (`…_formacion_en_preguntas_sin_espacios`).
Para mirar un valor, `JSON_VALUE(datos, '$.ruta')`; un `LIKE` solo para un
trozo de texto de dentro de una cadena (un párrafo, un título). Y dentro de un
literal SQL las barras invertidas del JSON van dobladas (`\\"`), o llega roto.

**Las claves del contenido de partida son la forma, aunque su valor esté
vacío** (desde la etapa 6 de la Fase 8, `shared/contenido-por-defecto.json` es
neutro). Por la misma regla de `mezclarConDefectos`, una clave que no está en
el de partida se tira al leer: si la cabecera neutra de una página no trae
`encuadre` porque no lleva foto, el encuadre de la foto que suba la
corporación desaparece al guardarlo. Por eso el neutro conserva todas las
claves de antes, también las de fotos vacías. Y la semilla de cada instalación
(`instalacion/contenido-inicial.json`) se comprueba contra esas claves al
arrancar: quitar o renombrar una en el de partida hace que la API de una
instalación con semilla no arranque hasta corregir su fichero (el mensaje dice
cuál).

**Mientras carga, la portada va en huesos, no con los textos de partida**
(`TextoDePortada`). Una prueba de un bloque de la portada que busque sus
textos sin simular `/portada` ya no los encuentra: tiene que responderla
(`responderPortada` de `inicio/__tests__/ayudas.ts`) y esperar con `findBy…`.
Y el simulado tiene que dar una `Response` **nueva** en cada llamada: los
huesos piden la portada antes que el bloque sus datos (los efectos de los
hijos van primero), y con una sola instancia el primero consume el cuerpo y
el segundo falla (pasó en `NoticiasDestacadas.test.tsx`).

**Un devuelto que el relleno de NG1 deja suelto se cierra con «Reemitir»
enlazado y anulando el recibo nuevo.** La migración `20261119200000_reemision_de`
enlaza cada recibo devuelto con el primero posterior que se llame
«(reemisión…)»; si se reemitió con otro concepto, el devuelto queda sin enlazar
y vuelve a salir como deuda aunque ya esté pagada. Anularlo no se puede:
DEVUELTO es un estado final. Se reemite desde Tesorería (con `reemisionDeId` el
enlace se hace aunque la cuota ya esté emitida) y se anula el recibo nuevo, que
sobra. Antes de desplegar, cuántos quedan:
`SELECT COUNT(*) FROM Recibo d WHERE d.estado='DEVUELTO' AND NOT EXISTS (SELECT 1 FROM Recibo n WHERE n.reemisionDeId = d.id)`.

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

**Los colores de marca no se escriben a mano** (desde la etapa 4 de la Fase
8). El burdeos y el oro de la tabla son los de partida: cada corporación pone
los suyos en `marca` de `instalacion/datos-entidad.json`, y de esos dos salen
todos los tonos. Por eso:

- **En la web, de `theme/marca.ts`**: `MARCA.<papel>` (`MARCA.principal` para
  un relleno con letra blanca, `MARCA.acento` para escribir sobre el fondo
  oscuro, etc.) y `alfa(MARCA.acento, 0.4)` en lugar de un `rgba(…)`. Qué papel
  va en cada sitio y con qué suelo de contraste lo dice
  `shared/colores-de-marca.d.mts`, papel a papel. Una hoja `.css`, que no puede
  importar, usa las variables `--marca-principal` y `--marca-acento`, que
  cuelga en `:root` el tema público (así lo hace `features/inicio/home.css`).
- **En la API, de `IMPRENTA`** (`src/domain/marca.ts`), para los PDF y los
  correos: `burdeos`, `oro`, `oroTexto`, `acentoCorreo`…
- **Los suelos los garantizan `paletaDeMarca` y `paletaDeImprenta`**: con un
  color que no da el contraste de un papel, conservan su matiz y ajustan la
  luminosidad hasta cumplirlo (y el arranque avisa con la cifra). Con los de
  partida, o `null`, devuelven exactamente los hex de siempre. Un papel nuevo
  se declara allí, con su valor de partida y su suelo; no se calcula en el
  componente.
- **La guardiana `src/__tests__/sin-colores-de-marca.test.ts`** recorre
  `src/` (ts, tsx y css) buscando el hex de cada papel de partida y los tres
  números de su `rgba()`; solo se libra `theme/marca.ts` y, hex a hex, el
  color de significado que coincide con uno de partida (`DE_SIGNIFICADO`, con
  su porqué: el tipo de acto «Culto» lleva el burdeos de partida, pero fijo,
  para no confundirse con Procesión en una marca morada). Si salta, el color
  va por `MARCA`.

Lo que no es de marca (neutros, tintas, cremas, el rojo de error y de gasto,
los colores de `dataviz` y los de significado, como los tipos de acto de la
agenda) sigue escrito donde está, y para eso vale lo de arriba.

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

**Los módulos «de instalación» van aparte y no se parecen a los demás en
nada salvo en preguntar por ellos.** `deInstalacion` de `shared/modulos.json`
(hoy solo `paginas-propias`: las páginas hechas a medida de Desamparados,
/desamparados, /rosario y el Sábado de Pasión con recorrido, trono y enseres)
no está en `CLAVES_MODULO` sino en `CLAVES_DE_INSTALACION`: no sale en
Sistema → «Módulos», no tiene fila en `Modulo` y `cambiar` responde 404. Está
encendido si y solo si su clave está en `modulos.activos` del fichero de la
instalación, **leído en cada arranque** (el lote del catálogo solo siembra la
primera vez). `ModulosService.activos()` y `GET /api/modulos` lo suman a la
lista, así que rutas, menús, sitemap e índice de páginas preguntan igual. Las
pruebas usan el ejemplo, que no lo lleva: en la API se enciende con
`encenderDeInstalacion` de `test/fixtures/modulos.ts` (en memoria, sin base) y
en la web pasando `TODOS_CON_PAGINAS_PROPIAS` de `src/test/queryClient.ts`.
Una página de `paginas-publicas.json` con `modulo` apagado responde 404
`MODULO_NO_ACTIVADO` en `/api/contenido/:slug` (lectura, guardado e
historial) y no recoge donativos; un enlace ya guardado a ella se sigue
aceptando al guardar (lleva a «no encontrado», como una noticia borrada).

**Un módulo puede necesitar algo del servidor, no solo otros módulos.**
«Avisos en el móvil para los hermanos» (`avisos-a-los-hermanos`) no se
enciende sin las tres claves VAPID del `.env`: lo dice
`QUE_FALTA_EN_EL_SERVIDOR` de `modulos.service.ts`, que `cambiar` mira antes
que los requisitos. Las pruebas lo encienden directo en la tabla
(`encenderModulos`) y ponen unas claves de verdad en `process.env`
(`web-push` las genera sin red). Los avisos nunca salen a la red dentro de
`node --test`, igual que el correo: se apuntan en `avisosDePrueba`
(`services/push.ts`), y `fijarEnvioDePrueba` simula un móvil muerto. La cola
de correos (`correos/cola.ts`) va dentro de las pruebas sin tope ni pausa.

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

**La baja del boletín tampoco se apaga.** `POST /api/boletin/baja` y su
página, `/boletin/baja`, son del núcleo y no de Comunicados: quien recibió un
boletín antes de apagar el módulo tiene que poder darse de baja con su enlace.

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

---

## 13. La marca: imágenes fuera de git

El escudo, los iconos y las imágenes de compartir y de los correos de cada
corporación viven en `instalacion/marca/`, fuera de git; qué ficheros son, sus
medidas y cómo se suben, en `despliegue.md`, «La marca». Lo que no se ve en el
código:

**Solo PNG y JPEG.** PDFKit no lee WebP ni SVG, y Outlook no pinta WebP en un
correo. Un `.webp` renombrado a `.png` es un error al arrancar (se leen los
bytes, no la extensión): hay que convertirlo.

**Desde el 21-10-2026 la marca se cambia en el CMS** (Sistema → Datos de la
corporación → «Identidad y marca»): `instalacion/marca/` y el grupo `marca` del
fichero solo siembran el primer arranque de la API, que los copia a
`storage/marca/` (las subidas) y a la base (`corporacion_marca`, con la
identidad). Lo de abajo sigue valiendo para esa semilla. Lo que no se ve:

- **Lo que se copió al cargar un módulo no cambia solo.** `identidad`,
  `coloresDeMarca`, `FICHEROS_MARCA`, `IMAGENES_MARCA` e `IMPRENTA` se cambian
  en su sitio; quien haga una copia (los colores exportados de
  `informes/pdf.ts`, el escudo de los correos, las palabras prohibidas en las
  contraseñas) se apunta a `alCambiarLaMarca` y la rehace. Los colores de
  `pdf.ts` son `export let` a propósito: quien los importa ve el nuevo.
- **La web lee la identidad y la marca una vez, al cargar la página**
  (`window.__INSTALACION__`, el tema): tras guardar, la pestaña abierta sigue
  con lo de antes hasta recargar, y la pantalla lo dice.
- **Las pruebas del backend publican en una carpeta temporal**
  (`fixtures/almacen-temporal.ts`): una que llame a `MarcaService` sin ella
  escribiría la cabecera del ejemplo en el `storage/public` de desarrollo, y
  Vite la serviría.
- **El asistente de primer arranque solo sale en una base recién
  instalada.** Si al arrancar la API no existe la fila `asistente_inicial`, nace
  terminado cuando ya hay hermanos o noticias: así ni el Grupo ni la web de
  pruebas lo ven al desplegar, y la base de desarrollo tampoco. Para verlo en
  local, «Repasar con el asistente» (Datos de la corporación), o poner a mano
  en esa fila `{"paso":0,"saltados":[],"terminado":null}` para que salga sola.

**Lo que se publica va en 0644, y lo de la instalación también tiene
que poder leerse.** La API publica la marca en `storage/public/marca/` con
`chmod 0644` explícito (el `mode` de `writeFileSync` pasa por la umask): si
conservara el modo de un original en 640, como `datos-entidad.json` en el VPS,
nginx (que corre con su propio usuario) daría 403. La API, en cambio, lee
directamente del montaje como `node`: un fichero en 640 de otro usuario la
deja sin arrancar. Ficheros en 644 y la carpeta en 755.

**`>` de PowerShell 5.1 estropea los binarios**: escribe en UTF-16 con BOM. Un
`git show <commit>:<ruta> > fichero.png` desde PowerShell deja un fichero que
el arranque rechaza («no es una imagen PNG»). Con Git Bash, o `cp`.

**La marca de partida está en git, en `shared/marca-de-partida/`**: el
`escudo.svg` genérico y los PNG que salen de él (`npm run marca -- --partida`,
solo si cambia el SVG). Es lo que usa una instalación sin `instalacion/marca/`
y, siempre, **lo que usan las pruebas**: `rutaDeMarca()` da `null` con Vitest
o el ejecutor de Node (`VITEST`, `NODE_TEST_CONTEXT`), así que la marca de
Desamparados de este PC no cuenta nunca en una prueba. En las pruebas tampoco
cuenta `MARCA` (el backend carga su `.env` con dotenv, y una `MARCA` puesta
allí se colaría en todas): una prueba que quiera una instalación con todos los
ficheros pone `MARCA_DE_PRUEBA=shared/__fixtures__/marca/completa`.

**Las 301 de los iconos viejos llevan `absolute_redirect off`.** Detrás del
nginx del sistema, una redirección absoluta llevaría el host y el esquema de
dentro del contenedor (`http://127.0.0.1/marca/…`). Está en
`ubicaciones.conf` y en `sitio-local.conf` (que no incluye el primero: lo que
se añada a uno va también en el otro).

**`home.css` toma los colores de las variables `--marca-*`**, que cuelga en
`:root` el `MuiCssBaseline` del tema público (`VARIABLES_MARCA` de
`theme/marca.ts`). Una hoja `.css` nueva que necesite el color de marca usa
esas variables; un hex escrito en ella lo para la guardiana (§11).

**En el otro PC, tras el pull de la etapa 4**, los ficheros de marca ya no
están en git y la web y la API arrancan con el escudo genérico (y avisos)
hasta que se ponen en `instalacion/marca/`. Lo más sencillo es copiar esa
carpeta entera del PC B. Si no, recuperarlos de la historia **con Git Bash,
nunca con `>` de PowerShell**, desde la raíz; `d825015` es el último commit de
`main` que los tenía todos:

```bash
mkdir -p instalacion/marca/originales
C=d825015
git show $C:backend-desamparados/src/services/informes/imagenes/escudo.png     > instalacion/marca/escudo-sobre-claro.png
git show $C:backend-desamparados/src/services/informes/imagenes/escudo-oro.png > instalacion/marca/escudo-destacado.png
git show $C:backend-desamparados/src/services/correos/imagenes/virgen.jpg      > instalacion/marca/correo-cabecera.jpg
for f in favicon-32 apple-touch-icon icono-192 icono-512; do
  git show $C:desamparados-web/public/$f.png > instalacion/marca/$f.png
done
git show $C:docs/marca/escudo-original.png > instalacion/marca/originales/escudo-original.png
git show $C:desamparados-web/public/images/escudo-grupo.png > /tmp/escudo-grupo.png
npm --prefix desamparados-web run marca -- --optimizar /tmp/escudo-grupo.png --destino instalacion/marca/escudo-sobre-oscuro.png
git show $C:desamparados-web/public/images/hero.jpg > instalacion/marca/compartir.jpg
```

El `apple-touch-icon.png` de la historia tiene canal alfa y da un aviso (no un
error); el del PC B ya está guardado sin él. Comprobarlo: `npm run dev` de la
web y la API sin ningún «Falta …» ni «se usa la marca de partida».

### Las fotos de la corporación, también fuera (etapa 6)

`desamparados-web/public/images/` pasó entero a `instalacion/imagenes/`, con
la misma estructura, y se sigue pidiendo en `/images/…` (despliegue.md, «Las
fotos de la corporación»). Lo que no se ve:

**nginx las lee del montaje, no de una copia.** A diferencia de la marca, aquí
el `chmod 0644` del arranque no protege nada: un fichero en 640 da 403, y una
carpeta sin `x` para otros (`instalacion/` incluida) deja sin todas las de
dentro. 644 y 755, siempre.

**El código no puede escribir una foto de `/images/`.** Otra instalación no la
tiene. Las fijas que el código usa por defecto (la de siempre, las de los
carteles, las copias reducidas, el convenio `-1000` de las cabeceras) están
todas en `src/config/fotosDeLaInstalacion.ts`, y quien las pinta las quita si
fallan (`hooks/useFotoQueFalla.ts`): sin eso, el navegador enseña el icono roto
con el texto alternativo. Lo vigila `backend/test/sin-fotos-escritas.test.ts`.
**Lo mismo con cualquier foto que pueda ser de `/images/`**, también las del
contenido: la semilla de una instalación las cita, y si falta una (o tiene
640) la cabecera a sangre, el hero, Foto, Foto y texto y las tarjetas la
quitan y dejan el fondo. Una pantalla nueva que pinte fotos del contenido
pasa `alFallar` a `propsDeFoto` y no pinta el `<img>` si no es `visible`.

**En Vite, sin `public/images`, el estático de Vite daría la portada** (200 con
HTML) para `/images/…`: el plugin `instalacion-vite.mjs` contesta antes, con la
foto o con un 404.

**En el otro PC, tras el pull**, las fotos desaparecen de la web local hasta
que se copia `instalacion/imagenes/` del PC A. O de la historia, **con Git
Bash** (nunca `>` de PowerShell), desde la raíz; `aeca868` es el último commit
de `main` que las tenía:

```bash
mkdir -p instalacion/imagenes
git archive aeca868 desamparados-web/public/images | tar -x --strip-components=3 -C instalacion/imagenes
```

**El mapa del barrio, igual.** `public/mapas/barrio-desamparados.json` pasó a
`instalacion/mapas/barrio.json` y se sirve en `/mapas/barrio.json` (las fuentes
de `public/mapas/fuentes/` se quedan: son genéricas). `cargarBarrio()` da
`null` con un 404 (esta instalación no tiene barrio, y se recuerda) y un error
con cualquier otro fallo (se reintenta): no confundirlos, que con el primero el
recorrido pasa a la lista y la 404 retira el plano, y con el segundo el mapa
dice «No se pudo cargar». En el PC B, tras el pull, con Git Bash:

```bash
mkdir -p instalacion/mapas
git show aeca868:desamparados-web/public/mapas/barrio-desamparados.json > instalacion/mapas/barrio.json
```

---

## 14. Los nombres del menú: dos listas que tienen que cuadrar

El nombre de cada página en el menú público se cambia en CMS → Páginas y se
guarda en `Configuracion` (`nombres_en_menu`, ruta → nombre, solo los que no
son el de siempre). Lo que no se ve:

**El menú está en dos sitios.** El de verdad es `config/navegacion.ts` de la
web, y no puede salir de un JSON: la guardiana de módulos lo lee como texto
(§12). El servidor, que no puede importarlo, valida contra
`shared/entradas-del-menu.json`: las entradas que llevan a una página
(`entradas`) y los títulos de primer nivel que solo despliegan (`secciones`,
con la clave `seccion:/ruta`), con su nombre de siempre. **Quien añada, quite o renombre una entrada del menú cambia
los dos**; `config/__tests__/navegacion.test.ts` falla si no cuadran. Sin eso,
una entrada nueva no se podría renombrar (400 «No es una entrada del menú») o
se aceptaría una que ya no existe.

**`/publicaciones` es a la vez un título y una página.** «Publicaciones»
(título que despliega) y «Todas las publicaciones» comparten ruta: el nombre
guardado para `/publicaciones` es el de la página; el del título va con
`seccion:/publicaciones` (`claveDeSeccion` en `navegacion.ts`). Los títulos se
renombran desde el título de su grupo en Páginas (el «grupo» de
`paginas-publicas.json` es su nombre de siempre); el que no tiene páginas de
bloques (Hermanos), entre «Otras entradas del menú». Así una corporación con
un Cristo o con varios titulares cambia «Sagrada titular».

**Lo que nombra una entrada fuera del menú usa `useNombreEnMenu(ruta)`**: el
botón del acceso de la barra y del cajón, y el título y la pestaña de Hazte
hermano, Apadrina y la Tienda. Un texto fijo con el nombre de una entrada se
queda con el de siempre cuando la renombran.

**Una ruta que deja el menú no rompe nada.** Al leer, `depurarNombres` tira lo
que ya no está en el catálogo; el siguiente guardado lo borra de la fila.

**La migración `nombres_en_menu` solo escribe en una base en marcha** (hay
filas en `ContenidoPagina`), como `salidas_neutras_en_base_nueva`: así
Desamparados recupera «Parroquia · Pasionistas» y otra corporación empieza
con «Parroquia». La prueba que lo comprueba tapa `ContenidoPagina` con una
tabla temporal en su conexión, en vez de vaciarla.

---

## 15. El itinerario tiene dos recorridos: no leer `recorrido` a pelo

Desde el 18-10-2026 el bloque Itinerario guarda el recorrido de siempre
(`paradas` y `recorrido`) y, si se preparó, un `alternativo` con sus propias
paradas y su mapa; `enUso` dice cuál enseñan la web y el directo. Quien lea
`bloque.recorrido` o `bloque.paradas` directamente enseña el habitual aunque
la salida vaya por el alternativo, que es justo lo que pasó con el Rosario.

Hay que pasar por `itinerarioEnUso` (web, `components/bloques/recorrido.ts`)
o `itinerarioConMapa` (API, `cortejo-directo.service.ts`). Lo hacen ya el
bloque público, la 404 y el directo; el CMS edita los dos por pestañas.

Cambiar el recorrido en uso desde «Cortejo en directo» **reescribe la página**
(con su versión en el historial). Desde el 22-10-2026 (AUD-004) eso ya no se
pierde: el editor del CMS guarda con la versión que leyó al abrir
(`versionLeida`), y si entretanto la página cambió la API responde 409
`PAGINA_CAMBIADA` y el editor ofrece «Recargar» o «Guardar encima». Quien
escriba otra pantalla que guarde una página entera tiene que mandar también
la versión que leyó (`versionActualDePagina`), leída **antes** que el documento.
