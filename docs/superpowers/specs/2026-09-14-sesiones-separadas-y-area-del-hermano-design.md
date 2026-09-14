# Sesiones separadas y área del hermano — diseño

**Fecha:** 14 de septiembre de 2026
**Estado:** aprobado, pendiente de implementar

## 1. Por qué

Ocho hallazgos del usuario probando la web y el CMS. Tres son fallos cerrados, dos
son decisiones de producto y tres obligan a tocar la arquitectura: cómo se identifica
la gente, qué guarda la ficha del hermano y cómo se llama lo que se pide para salir
en la procesión.

El que manda sobre todos los demás es el séptimo: **hoy existe una sola cookie de
sesión**, así que entrar al área de hermanos con una cuenta mientras se está dentro
del CMS mata la sesión del CMS. No es un fallo suelto, es el diseño actual, y el
resto del trabajo sobre el área del hermano se apoya encima.

Los ocho, tal y como los contó el usuario:

| # | Lo que vio | Causa confirmada en el código |
|---|---|---|
| 1 | `POST /api/auth/register` devuelve 400 con un DNI correcto | El formulario valida más flojo que el servidor y el aviso no dice qué campo falla |
| 2 | En tema claro se pierde el menú del CMS cuando tiene scroll | `AdminLayout.tsx`: la barra es `height:'100%'` dentro de un contenedor de `100vh` con scroll |
| 3 | «Solicitar papeleta» no hace nada | Es un `<Link>` a la página anterior; el flujo del backend existe pero nunca se conectó |
| 4 | El perfil del hermano es pobre y no deja editar ni la foto ni el pago | Faltan campos en el esquema y pantallas de edición |
| 5 | La auditoría se ve en el panel | El bloque «Actividad del equipo» del Inicio lo ven los seis cargos |
| 6 | «Papeleta de Sitio» no es el vocabulario de la corporación | Nombre heredado en modelo, enum, rutas y rótulos |
| 7 | Entrar como hermano deja el CMS sin acceso | Una única cookie `desamparados_session` con un campo `origen` |
| 8 | Puede haber hermanos sin número | Solo se asigna al aprobar una solicitud o al reactivar |

## 2. Decisiones tomadas

| Decisión | Elegido | Motivo |
|---|---|---|
| Sesiones | **Dos cookies independientes**, una por área | Es lo que pidió el usuario: entrar al CMS como Tesorero y al área de hermanos con el mismo correo, a la vez |
| Cómo elige el servidor | **Por ruta**: `checkRole` exige la del CMS, el área de hermanos usa la suya | `checkRole` ya es el paso obligado de toda ruta de staff; no hay que acordarse de nada en cada router |
| Cierre de sesión | **Por área**, con marcas de corte separadas | Salir del área de hermanos no puede echar del CMS |
| Validación del alta | **Reglas compartidas** entre formulario y servidor | El desajuste actual es la causa del 400 |
| Auditoría | Fuera del Inicio **para todos los cargos**; la sección sigue para ADMIN y HERMANO_MAYOR | Elección del usuario |
| Plazo de la estación | **Fechas de apertura y cierre** en una sección nueva del CMS llamada «Procesión» | Elección del usuario |
| Sección Procesión | Plazo, datos de la salida, precios **y días de reparto** | Elección del usuario; hoy nada de esto tiene interfaz |
| Edición del perfil | Inmediata, **salvo nombre, apellidos y DNI**, que valida Secretaría | Elección del usuario: son los datos que identifican al hermano en el censo |
| Dónde se validan | **Bandeja propia en CMS › Hermanos** | Elección del usuario |
| Estado civil y profesión | Estado civil en **lista cerrada**, profesión en **texto libre** | Elección del usuario |
| Foto del hermano | Almacén **privado** | Es dato personal y puede ser de un menor |
| Renombrado | **Completo, incluido el código** | Elección del usuario |
| Conceptos ya emitidos | **No se tocan** | «Papeleta de Sitio 2026» es asiento contable; reescribirlo falsea el histórico |

## 3. Alcance

**Entra:**

1. Dos sesiones independientes (CMS y hermanos), con cierre de sesión por área.
2. Validación compartida del formulario de alta y errores por campo.
3. Perfil del hermano: campos nuevos, edición, foto y forma de pago.
4. Bandeja «Cambios pendientes» en CMS › Hermanos.
5. Solicitud de la estación de penitencia, con su plazo.
6. Sección CMS › Procesión.
7. Renombrado completo de «papeleta de sitio» a «estación de penitencia».
8. «Actividad del equipo» fuera del Inicio.
9. Garantía de número de hermano.
10. Arreglo del menú del CMS en tema claro.

**No entra:**

- Tocar los recibos y conceptos contables ya emitidos.
- Rehacer el resto de pantallas del CMS.
- Cambiar quién entra a qué en lo que ya existe. Los únicos permisos nuevos son los
  de las dos pantallas nuevas (secciones 6.3 y 8).
- Avisos de compatibilidad o migración de usuarios: el proyecto no está en
  producción y no hay nadie a quien avisar.

---

## 4. Dos sesiones independientes

### 4.1 Cómo está hoy

Una cookie, `desamparados_session` (`utils/cookies.ts`), con un JWT que lleva un
campo `origen: 'cms' | 'hermanos'` (`utils/jwt.handle.ts`). `checkRole` rechaza con
403 y código `SESION_NO_CMS` cualquier sesión cuyo origen no sea `cms`
(`middleware/checkRole.ts`), y el cliente del frontend lo trata como sesión perdida
(`lib/api/client.ts`). Es correcto como defensa —el segundo factor solo se pide en
`/cms/acceso`, así que una sesión de hermanos es una sesión sin 2FA— pero como la
cookie es la misma, el segundo acceso borra el primero.

### 4.2 Cómo queda

Dos cookies, ambas `httpOnly`, `SameSite=Strict`, `path=/api`:

| Área | Cookie | Nace en | Segundo factor | Caducidad |
|---|---|---|---|---|
| CMS | `desamparados_cms` | `/cms/acceso` | Sí, si la cuenta lo tiene activo | De sesión (muere al cerrar el navegador), o 72 h con «Recordarme» |
| Hermanos | `desamparados_hermano` | `/hermanos/acceso` | No | Persistente, con el tope del JWT |

El JWT conserva el campo `origen`, ahora como comprobación de coherencia: un token de
hermanos presentado en la cookie del CMS se rechaza.

**Middleware.** `authenticateToken` lee las dos cookies, valida cada una contra la
base de datos y deja:

```ts
req.sesiones = { cms: AuthTokenPayload | null, hermano: AuthTokenPayload | null }
```

- Si las dos son nulas → 401, como ahora.
- `req.user` toma por defecto `sesiones.hermano ?? sesiones.cms`, para que las rutas
  del área de hermanos sigan leyendo `req.user` sin cambios.
- `checkRole` usa `req.sesiones.cms`. Si no hay, responde 403 `SESION_NO_CMS`. Si la
  hay, **fija `req.user = sesiones.cms`** antes de seguir, para que la auditoría
  registre al usuario correcto.

El motivo de que la decisión viva en `checkRole` y no en un middleware suelto es el
mismo que ya está escrito en ese fichero: ninguna ruta de staff se salta `checkRole`,
y ninguna de sus listas de roles incluye `USER`. Un router nuevo que se olvide de un
middleware suelto es justo el fallo que dejó abierta `/news/admin/archive`.

**Rutas que hoy mezclan las dos zonas** —`procesion.routes.ts` tiene zona de hermano
y zona de mesa de reparto bajo el mismo `router.use(authenticateToken)`— siguen
funcionando sin cambios: las de staff llevan `checkRole` y las del hermano no.

### 4.3 Cierre de sesión por área

Hoy `logout` llama a `AuthService.cerrarSesionesDe`, que mueve `tokenValidAfter` y
mata **todas** las sesiones de la cuenta. Con dos áreas eso significaría que salir del
área de hermanos echa del CMS.

Se añaden dos columnas a `User`:

```prisma
cmsValidoDesde      DateTime @default(now())
hermanoValidoDesde  DateTime @default(now())
```

Un token es válido si `emitidoMs >= max(tokenValidAfter, <marca del área>)`.

| Acción | Qué invalida |
|---|---|
| Cerrar sesión en el CMS | `cmsValidoDesde` |
| Cerrar sesión en hermanos | `hermanoValidoDesde` |
| Cambio de contraseña | `tokenValidAfter` (todo) |
| Degradación de rol, reset de 2FA, borrado RGPD | `tokenValidAfter` (todo) |

`POST /auth/logout` recibe el área a cerrar; sin ella, cierra las dos.

### 4.4 API

- `POST /auth/login` y `POST /auth/login/2fa`: igual que ahora, pero ponen la cookie
  que corresponda al `contexto`. Nunca borran la del área contraria.
- `GET /auth/me`: pasa a devolver `{ cms: User | null, hermano: User | null }`. Un
  invitado recibe `{ cms: null, hermano: null }` con 200, no un 401, para que el
  arranque del frontend deje de tratar el caso normal como error.
- `POST /auth/logout`: `{ area?: 'cms' | 'hermanos' }`.

### 4.5 Frontend

`features/members/auth/store.ts` guarda dos sesiones:

```ts
{ status, cms: AuthUser | null, hermano: AuthUser | null }
```

- `RequireAuth` (área de hermanos) mira `hermano`.
- `RequireRole` (CMS) mira `cms`, y su rol.
- `AdminLayout` cierra solo la del CMS; `BrotherLayout`, solo la de hermanos.
- Desaparece `sesionPerdidaParaCms()` de `lib/api/client.ts` y el aviso «Tu sesión
  actual no tiene acceso a la administración»: ya no puede ocurrir. El código
  `SESION_NO_CMS` se conserva para el caso real que queda —entrar por URL al CMS sin
  haberse identificado allí—, y entonces lleva al acceso del CMS sin tocar la sesión
  de hermanos.

---

## 5. Validación del formulario de alta

### 5.1 El desajuste

Comprobado ejecutando las dos validaciones sobre los mismos valores:

| Valor | Formulario (`members/public/schema.ts`) | Servidor (`config/common.ts`) |
|---|---|---|
| `12345678Z` | pasa | pasa |
| `12345678A` | pasa | **rechaza** (letra) |
| `1234567A` | pasa | **rechaza** (formato) |
| `0123456S` | pasa | **rechaza** (formato) |
| `+34600123456` | pasa | **rechaza** (teléfono) |
| `600 12 34 56` | pasa | **rechaza** (teléfono) |

El formulario usa `/^[XYZ]?\d{7,8}[A-Z]$/i`, que no calcula la letra y admite siete
dígitos; el servidor exige ocho y comprueba el módulo 23. El teléfono en el formulario
solo pide que no esté vacío; el servidor, nueve dígitos. Nombre, apellidos, dirección
y ciudad tienen en el servidor la regla anti-XSS (sin `<` ni `>`) que el formulario no
aplica.

Encima, `validate` responde `{ message: 'Error de validación', errors: [...] }` y la
página solo pinta `message`, así que el usuario ve un aviso que no dice nada.

### 5.2 Cómo queda

- Un módulo compartido con las reglas de verdad: DNI/NIE con letra calculada,
  teléfono español de nueve dígitos, código postal de cinco, texto sin `<` ni `>`.
  Vive en el frontend (`lib/validacion/identidad.ts`) copiando literalmente las
  reglas de `config/common.ts` del backend, con un test que compara las dos
  implementaciones caso a caso para que no vuelvan a separarse.
- El DNI se normaliza al salir del campo: sin espacios ni guiones, en mayúsculas.
  También se normaliza en el servidor antes de guardar, que hoy guarda lo que le
  llega en el caso en que venga.
- `HazteHermanoPage` pinta los errores por campo que devuelve la API
  (`ApiError.fields`, que el cliente ya extrae) bajo la casilla correspondiente.

---

## 6. Perfil del hermano

### 6.1 Campos nuevos

```prisma
enum EstadoCivil {
  SOLTERO
  CASADO
  PAREJA_DE_HECHO
  SEPARADO
  DIVORCIADO
  VIUDO
}

enum PeriodicidadPago {
  ANUAL
  SEMESTRAL
  TRIMESTRAL
  MENSUAL
}

model Hermano {
  // ...
  fotoUrl          String?
  estadoCivil      EstadoCivil?
  profesion        String?
  periodicidadPago PeriodicidadPago @default(ANUAL)
}
```

`iban`, `titularCuenta` y `formaPagoPref` ya existen.

### 6.2 Qué edita el hermano

| Se guarda al momento | Pasa por Secretaría |
|---|---|
| Teléfono, email, dirección, población, código postal | Nombre |
| Estado civil, profesión | Apellidos |
| Foto | DNI |
| Forma de pago, IBAN, titular de la cuenta, periodicidad | |

Nada de lo que edita el hermano toca los datos de hermandad: número, fecha de alta,
fecha de baja, puesto, tallaje y túnica siguen siendo solo de Secretaría.

Todo cambio queda en la auditoría con su «antes» y «después», usando
`domain/cambios-ficha.ts`, que ya oculta los datos bancarios y anota solo que
cambiaron.

### 6.3 Bandeja de cambios pendientes

```prisma
enum EstadoCambioFicha {
  PENDIENTE
  APROBADO
  RECHAZADO
}

model CambioFichaPendiente {
  id         Int      @id @default(autoincrement())
  hermanoId  Int
  hermano    Hermano  @relation(fields: [hermanoId], references: [id], onDelete: Cascade)
  campo      String   // 'nombre' | 'apellidos' | 'dni'
  valorViejo String?
  valorNuevo String
  estado     EstadoCambioFicha @default(PENDIENTE)
  motivo     String?  @db.Text  // por qué se rechazó
  resueltoPorId Int?
  resueltoPor   User? @relation(fields: [resueltoPorId], references: [id], onDelete: SetNull)
  resueltoEn    DateTime?
  createdAt  DateTime @default(now())

  @@index([estado, createdAt])
  @@index([hermanoId])
}
```

- Un campo solo puede tener una petición pendiente a la vez: pedir otra sustituye la
  anterior.
- Aprobar escribe el valor en la ficha dentro de una transacción, comprobando de nuevo
  que el DNI siga libre (el `@unique` puede haberse ocupado entre medias).
- Rechazar guarda el motivo y se le enseña al hermano en su perfil.
- Pantalla: pestaña **Cambios pendientes** en `/cms/hermanos`, con el valor de antes y
  el de después y botones de aprobar y rechazar. Roles: los mismos que gestionan el
  censo (`ADMIN`, `SECRETARIA`, `HERMANO_MAYOR`).
- Contador nuevo `cambiosPendientes` en el menú lateral, junto a los tres que ya hay
  (`app/cmsNavegacion.ts`), servido por `/api/panel/hoy`.

### 6.4 La foto

- Se sube a `POST /api/upload/foto`, ruta nueva, disponible para cualquier sesión de
  hermanos. Recibe el fichero y el `hermanoId`, comprueba que la ficha sea del
  usuario, guarda la imagen y **escribe `fotoUrl` en la ficha** en la misma
  operación. El formulario del perfil no manda `fotoUrl`: sustituir la foto es una
  acción con su propio botón, no un campo del formulario.
- Borrar la foto es `DELETE /api/upload/foto/:hermanoId`: pone `fotoUrl` a `null` y
  elimina el fichero.
- Va al **almacén privado**. Hoy `GET /upload/private/:filename` exige rol de CMS; se
  añade el caso del hermano que pide la foto de una de sus fichas.
- Reutiliza `recodificarSinMetadatos` de `upload.controller.ts`, que ya quita el EXIF
  (y con él las coordenadas GPS de donde se hizo).
- Formatos y tope: los que ya rigen para las imágenes del CMS.

### 6.5 La pantalla

Deja de ser una lista plana de campos:

- **Cabecera**: foto, nombre y apellidos, número de hermano y antigüedad.
- **Datos personales**: DNI, fecha de nacimiento, estado civil, profesión.
- **Contacto**: teléfono, email, dirección, población, código postal.
- **Forma de pago**: método, IBAN (enmascarado salvo los cuatro últimos), titular,
  periodicidad.
- **Estación de penitencia**: estado del año en curso y enlace a la solicitud.
- Si hay cambios pendientes de Secretaría, un aviso con lo que se pidió y cuándo.
- Si el usuario gestiona más fichas (hijos a cargo), un selector para verlas y
  editarlas, igual que hoy hace `fichaPropia`.

---

## 7. Solicitar la estación de penitencia

### 7.1 Lo que ya existe

El backend tiene el flujo entero y nunca se conectó:

- `GET /procesion/dias` — días de reparto abiertos y cuánta gente se ha apuntado.
- `POST /procesion/avisar` — reserva un día (`{ turnoId, hermanoId }`).
- `DELETE /procesion/avisar/:id` — la anula.

`ProcesionService.avisarAsistencia` ya comprueba que la ficha sea del usuario, que el
turno siga abierto, que no haya estación de ese año, que no haya otra reserva y que
quede aforo, todo en una transacción con reintento.

El botón de `PapeletaPage.tsx` es un `<Link>` a `/area-hermano/procesion`.

### 7.2 El plazo

Dos claves nuevas de configuración, con las reglas en `domain/configuracion.ts`:

- `estacion_plazo_apertura` — fecha `AAAA-MM-DD`
- `estacion_plazo_cierre` — fecha `AAAA-MM-DD`

Regla: el plazo está abierto si hoy (día de Madrid) cae entre las dos, inclusive. Sin
las dos claves puestas, **el plazo está cerrado**: es el valor seguro, y evita que una
configuración a medias abra las solicitudes sin querer.

`POST /procesion/avisar` comprueba el plazo **en el servidor** antes que nada y
responde 409 con el motivo si está cerrado. Ocultar el botón no es protección.

Endpoint nuevo `GET /procesion/plazo`, para sesión de hermanos:

```json
{ "abierto": false, "apertura": "2027-01-12", "cierre": "2027-02-28", "motivo": "AUN_NO_ABIERTO" }
```

`motivo` es `AUN_NO_ABIERTO`, `YA_CERRADO` o `SIN_CONFIGURAR`.

### 7.3 La pantalla

`/area-hermano/procesion/estacion`, cuatro estados:

| Estado | Qué se ve |
|---|---|
| Fuera de plazo | Botón bloqueado y el motivo con las fechas: «El plazo se abre el 12 de enero» |
| En plazo, sin reserva | Lista de días de reparto con su horario y su aforo, y el botón de solicitar |
| En plazo, con reserva | El día reservado y el botón de anularla |
| Con estación asignada | Su sitio: sección, tramo o número, y el estado del recibo |

La ruta vieja `/area-hermano/procesion/papeleta` redirige a la nueva: los hermanos
pueden tenerla guardada en favoritos.

---

## 8. CMS › Procesión

Sección nueva en `/cms/procesion`, grupo «Censo y enseres» del menú. Hoy toda la
administración de la procesión vive en la API sin ninguna pantalla.

| Bloque | Qué gestiona | De dónde sale |
|---|---|---|
| Plazo de solicitud | Apertura y cierre | `estacion_plazo_apertura`, `estacion_plazo_cierre` |
| Datos de la salida | Fecha, hora y punto de acceso | `procesion_fecha`, `procesion_hora`, `procesion_acceso` |
| Precios | Estación de penitencia y alquiler de túnica | `precio_estacion_penitencia`, `precio_alquiler_tunica` |
| Días de reparto | Crear y borrar turnos (fecha, horario, aforo), ver apuntados y quién de la Junta atiende | `/procesion/admin/turnos`, `/procesion/admin/cuadrante` |

Permisos, siguiendo los que ya tienen esas rutas:

- Editan: `ADMIN` y `SECRETARIA`.
- Ven: además, `HERMANO_MAYOR`, `TESORERIA` y `ALBACERIA`.

El plazo es lo único que no tiene ruta: se añade a `/admin/config`, que ya valida
clave por clave.

---

## 9. Renombrado completo

| Antes | Después |
|---|---|
| `model PapeletaSitio` | `model EstacionPenitencia` |
| `Hermano.papeletas` | `Hermano.estaciones` |
| `Recibo.papeleta`, `Cita.papeleta` | `.estacion` |
| `PapeletaSitio.reciboId` / `citaId` | igual |
| `TipoRecibo.PAPELETA_SITIO` | `TipoRecibo.ESTACION_PENITENCIA` |
| `precio_papeleta_sitio` | `precio_estacion_penitencia` |
| `GET /procesion/mis-papeletas` | `GET /procesion/mis-estaciones` |
| `DELETE /procesion/admin/papeletas/:id/anular` | `.../estaciones/:id/anular` |
| `AUDIT_ACTIONS.PAPELETA_ANULAR` | `ESTACION_ANULAR` |
| `/area-hermano/procesion/papeleta` | `/area-hermano/procesion/estacion` |
| `PapeletaPage.tsx`, `estadoPapeleta.ts` | `EstacionPage.tsx`, `estadoEstacion.ts` |
| Rótulos «Papeleta de Sitio» | «Estación de penitencia» / «Solicitar estación de penitencia» |

**Lo que NO se toca:** el campo `Recibo.concepto` de los recibos ya emitidos. Es
asiento contable, entra en el `@@unique([hermanoId, year, concepto])` y reescribirlo
falsearía el histórico. `conceptoPapeleta` (en `domain/datos-procesion.ts`) pasa a
llamarse `conceptoEstacion` y genera el texto nuevo **solo para los recibos futuros**.

### 9.1 Migración

Tres pasos en una sola migración de Prisma, en este orden:

1. `RENAME TABLE PapeletaSitio TO EstacionPenitencia` (conserva los datos y los
   índices; las claves foráneas se renombran solas).
2. Añadir `ESTACION_PENITENCIA` al enum `TipoRecibo`, actualizar las filas que tengan
   `PAPELETA_SITIO` y quitar el valor viejo del enum. En MySQL/MariaDB un enum es una
   columna: hay que ampliarlo, mover los datos y estrecharlo, en tres sentencias.
3. `UPDATE Configuracion SET \`key\` = 'precio_estacion_penitencia' WHERE \`key\` =
   'precio_papeleta_sitio'`.

Los seeds (`prisma/seed*.ts`) se actualizan a los nombres nuevos.

---

## 10. Auditoría fuera del Inicio

- Se retira el componente `ActividadEquipo` del Inicio (`features/cms/PanelPage.tsx`)
  para **todos** los cargos, incluido ADMIN.
- Lo que ese bloque enseñaba y no es auditoría —noticias publicadas, total de
  publicaciones y fecha de la última— se conserva, movido al bloque de cifras.
- `/api/panel/hoy` deja de devolver `actividad.registro`, que es lo que venía de
  `AuditLog`. Los demás campos de `actividad` se quedan.
- La sección `/cms/auditoria` no cambia: sigue para `ADMIN` y `HERMANO_MAYOR`.

---

## 11. Ningún hermano sin número

La regla: **toda ficha activa tiene número de hermano**. Una ficha pendiente de
aprobación no lo tiene, y una de baja lo libera; eso ya es así y se mantiene.

Qué falta hoy:

1. `HermanoService.createDependentProfile` crea la ficha con `activo: false`, así que
   pasa por «Aprobar» y recibe número. Correcto, no se toca.
2. La base real de hermanos que se va a importar puede traer fichas activas sin
   número. Se añade una utilidad de **cierre de huecos** que asigna número por orden
   de antigüedad (`fechaAlta`, y `id` como desempate) a las activas que no lo tengan,
   sin tocar las que ya lo tienen. Se apoya en `reordenarCenso`, que ya sabe hacer
   esto para el censo entero.
3. El aviso ya existe y se mantiene: el contador `hermanosSinNumero` del menú lateral.
   El cierre de huecos se lanza a mano desde el CMS (un botón en la pestaña del censo,
   con los mismos roles que gestionan el censo), no en el arranque del servidor:
   asignar números es una decisión de Secretaría y debe quedar en la auditoría con
   nombre y apellidos de quien la toma.
4. Test que recorre todas las vías de alta (registro + aprobación, alta familiar +
   aprobación, reactivación, alta desde Secretaría) y falla si alguna deja una ficha
   activa sin número.

`getNextNumeroHermano` sigue como está: «el mayor + 1», dentro de la transacción con
reintento que ya resuelve el choque entre dos altas simultáneas.

---

## 12. Menú del CMS en tema claro

En `app/AdminLayout.tsx`, la barra lateral es:

```tsx
<Box component="aside" sx={{ width: 264, height: '100vh', overflowY: 'auto' }}>
  {/* barra: <Box sx={{ height: '100%', backgroundColor: SIDEBAR }}> */}
</Box>
```

Cuando el menú es más alto que la ventana, el hijo mide `100vh` pero su contenido
desborda: al bajar, el fondo oscuro se acaba y asoma el `background.default` de la
página. En tema oscuro no se nota; en claro, el menú «desaparece».

Arreglo: el fondo pasa al contenedor `aside` y la barra usa `minHeight: '100%'` en
lugar de `height`. Se prueba con la ventana baja (menos de 600 px de alto) en los dos
temas.

---

## 13. Resumen de cambios de esquema

```prisma
model User {
  cmsValidoDesde      DateTime @default(now())
  hermanoValidoDesde  DateTime @default(now())
  cambiosResueltos    CambioFichaPendiente[]
}

model Hermano {
  fotoUrl          String?
  estadoCivil      EstadoCivil?
  profesion        String?
  periodicidadPago PeriodicidadPago @default(ANUAL)
  cambiosPendientes CambioFichaPendiente[]
  estaciones       EstacionPenitencia[]   // renombrado de papeletas
}

model EstacionPenitencia { /* antes PapeletaSitio, sin cambios de campos */ }
model CambioFichaPendiente { /* ver 6.3 */ }

enum EstadoCivil { ... }
enum PeriodicidadPago { ... }
enum EstadoCambioFicha { ... }
enum TipoRecibo { ESTACION_PENITENCIA, CUOTA_HERMANO, DONATIVO, OTRO }
```

## 14. Pruebas

| Qué | Cómo |
|---|---|
| Dos sesiones | Test de integración: login en CMS, login en hermanos con la misma cuenta, y comprobar que las dos cookies siguen sirviendo para lo suyo |
| Cierre por área | Cerrar hermanos y comprobar que el CMS sigue vivo, y al revés |
| Cookie cruzada | La cookie de hermanos en una ruta de staff da 403; la del CMS no abre nada que no abriera antes |
| Validación del alta | Test que ejecuta las reglas del formulario y las del servidor sobre la misma tabla de casos y exige el mismo resultado |
| Plazo | Fuera de plazo, `POST /procesion/avisar` responde 409 aunque el cliente lo pida |
| Cambios pendientes | Aprobar un DNI ya ocupado entre medias falla limpio y no escribe |
| Número de hermano | Recorrido de todas las vías de alta |
| Menú en claro | Prueba visual con ventana baja en los dos temas |
| Renombrado | La batería actual debe pasar entera tras el renombrado; es la red que dice que no se ha roto nada |

## 15. Orden de trabajo

1. **Arreglos cerrados** — menú en claro (12), auditoría fuera del Inicio (10),
   validación del alta (5), número de hermano (11). Sin dependencias entre ellos.
2. **Las dos sesiones** (4). Antes que nada del área de hermanos.
3. **Renombrado completo** (9). Antes que el perfil y la procesión, para no escribir
   código nuevo con el nombre viejo.
4. **Procesión**: sección del CMS (8) y solicitud del hermano (7). En ese orden: sin
   el plazo configurable, la solicitud no se puede probar de verdad.
5. **Perfil del hermano** (6), con la bandeja de cambios pendientes.

## 16. Riesgos

| Riesgo | Mitigación |
|---|---|
| El renombrado toca mucho y en silencio | Se hace en un paso propio, con la batería de tests entera en verde antes y después |
| La migración del enum en MySQL no es atómica | Las tres sentencias van en una sola migración; se prueba primero contra una copia con datos |
| Dos sesiones abren la puerta a confundir identidades en la auditoría | `checkRole` fija `req.user` a la sesión del CMS antes de seguir, y hay test de ello |
| La foto es dato personal | Almacén privado, EXIF eliminado, y la descarga comprueba que la ficha sea del solicitante |
| El plazo mal configurado deja abiertas las solicitudes | Sin las dos claves puestas, el plazo está cerrado |
