# Salidas configurables (N salidas desde el CMS)

Fecha: 01-10-2026 · PC B · Tarea de la hoja de ruta: «Lo propio del Grupo, a configuración»

## Por qué

Las salidas son hoy un enum de Prisma (`Salida { PASION, ROSARIO }`) con su
lógica repartida en unos 40 ficheros (`salida === 'ROSARIO'`, `DATOS_SALIDA`,
`sabadoDePasion()`, `CORTEJO_POR_DEFECTO`, `shared/puestos-procesion.json`…).
Instalar la aplicación para otra corporación obligaría a tocar código. Este
Grupo Parroquial sigue teniendo dos salidas (Sábado de Pasión y Rosario
vespertino), pero cada corporación tiene que poder definir las suyas, las que
sean, desde el CMS.

Fuera de este spec: el género y el nombre de la corporación en las frases
(«el Grupo Parroquial» frente a «la Hermandad»). Va en un spec aparte, después.

## Decisiones

- Las salidas son **filas de una tabla** editable desde el CMS, no un JSON de
  `shared/` ni un enum ampliado.
- La fecha de cada salida se obtiene por **regla** (relativa a la Pascua, en
  días) o **a mano** (un acto de la Agenda, cada año).
- El código deja de preguntar «¿es la Pasión?» y pregunta por propiedades:
  `conRopa`, `cobro`.
- `?salida=` lleva el slug y es **obligatorio**: sin valor por defecto que
  esconda un fallo.
- No hay usuarios todavía: no hace falta compatibilidad con la API vieja,
  pero la migración conserva los datos que ya existen.

## Modelo de datos

```prisma
enum CobroSalida {
  CUOTA     // importe fijo de la configuración de la salida; recibo PAPELETA_SITIO
  DONATIVO  // lo pone el hermano; recibo DONATIVO
}

enum FechaSalida {
  PASCUA  // Domingo de Resurrección + diasDesdePascua (Sábado de Pasión = −8)
  MANUAL  // la del acto de la Agenda enlazado (eventoId), que se fija cada año
}

model Salida {
  id              Int         @id @default(autoincrement())
  slug            String      @unique   // en URLs y en ?salida=
  nombre          String                // «Sábado de Pasión»
  orden           Int         @default(0)
  activa          Boolean     @default(true) // con papeletas no se borra: se desactiva
  conRopa         Boolean     @default(false)
  cobro           CobroSalida @default(CUOTA)
  importeCuota    Decimal     @default(0) @db.Decimal(8, 2)
  fecha           FechaSalida
  diasDesdePascua Int?                  // con PASCUA
  horaSalida      String?               // con PASCUA; con MANUAL sale del acto
  lugar           String?               // con PASCUA; con MANUAL sale del acto
  eventoId        Int?                  // con MANUAL: el acto de este año
  plazoAbierto    Boolean     @default(false)
  puestos         Json                  // PuestoDelCatalogo[]: sugerencias de la mesa
  cortejo         Json?                 // ConfiguracionCortejo; null = por defecto
  indicaciones    String?     @db.Text  // vestimenta y comportamiento: papeleta y correos
}
```

`Turno`, `PapeletaSitio` y `Solicitud` cambian `salida Salida` por
`salidaId Int` con su relación. Se mantienen las claves únicas e índices que
existen hoy, con `salidaId` (`@@unique([hermanoId, year, salidaId])`…). El
segmento de los avisos (`conPapeleta`) guarda un `salidaId`.

Desaparecen: el enum `Salida`, `DATOS_SALIDA`, `SALIDAS`,
`PUESTOS_POR_SALIDA`, `CORTEJO_POR_DEFECTO` por salida, las claves de
`Configuracion` `papeletas_abiertas`, `papeletas_abiertas_rosario`,
`precio_papeleta_sitio`, `rosario_evento_id` y las de hora y puerta de la
Pasión, y `shared/puestos-procesion.json` (su contenido pasa a la migración
y a la siembra).

## Reglas de dominio (`domain/salidas.ts`, puras y con pruebas)

- **Fecha del año** `fechaDeSalida(salida, anio, acto?)`: con `PASCUA`,
  Domingo de Resurrección de `anio` + `diasDesdePascua`; con `MANUAL`, la
  fecha del acto enlazado, o `null` si no hay.
- **Temporada de reparto**: un día vale si cae antes de la fecha de la salida
  y después de la fecha del año anterior. La papeleta cuenta para el año de
  esa fecha. Sustituye a `motivoRepartoFueraDeTemporada` (1 de enero a la
  víspera / octubre).
- **Año en curso** (`anioDeLaProcesion`): el de la próxima fecha de la
  salida; la salida se da por pasada al día siguiente. Sustituye a los meses
  escritos a mano (mayo / noviembre).
- **Salida a mano sin fecha**: no se puede abrir su plazo (409 con el motivo:
  «Pon antes la fecha de la salida en la Agenda»).
- **Lo pendiente de la salida**: `importeCuota` si `cobro = CUOTA`, el
  donativo si `DONATIVO`. Los motivos de la mesa salen de ahí («Falta el
  donativo.» / «Falta pagar la papeleta.»).
- **Ropero**: solo en salidas `conRopa`, y por salida y año (dos salidas con
  ropa el mismo año llevan cada una su reparto de túnicas).

## Migración (`…200000_salidas_configurables`, la del PC B)

1. Crea `Salida` y sus dos enums.
2. Inserta las dos filas con lo que hoy está en el código y en
   `Configuracion`:
   - `sabado-de-pasion`: «Sábado de Pasión», orden 1, `conRopa`, `CUOTA` con
     el importe de `precio_papeleta_sitio` (0 si no está), `PASCUA` −8, hora y
     lugar de sus claves, plazo según `papeletas_abiertas`, los puestos de
     `puestos`.
   - `rosario-vespertino`: «Rosario vespertino», orden 2, sin ropa,
     `DONATIVO`, `MANUAL` con `eventoId` de `rosario_evento_id`, plazo según
     `papeletas_abiertas_rosario`, los puestos de `rosario`.
   - Los cortejos guardados y las indicaciones de hoy (las frases de la
     papeleta y los correos) también se copian a cada fila.
3. Añade `salidaId` a `Turno`, `PapeletaSitio` y `Solicitud`, lo rellena
   según el enum, lo hace obligatorio, rehace índices y claves únicas y
   borra la columna vieja.
4. Borra las claves de `Configuracion` que ya no se usan.

La siembra crea las mismas dos filas.

## API

- `GET /salidas` (público para el área de hermanos): activas por orden, con
  `slug`, `nombre`, `conRopa`, `cobro`, `importeCuota`, `puestos`,
  `indicaciones`, `plazoAbierto` y la fecha de este año ya calculada (o
  `null`).
- `GET /cms/salidas`, `POST /cms/salidas`, `PUT /cms/salidas/:id` (incluye
  desactivar) con los mismos roles que hoy abren el plazo. Esquema arktype
  primero, y su tipo en `desamparados-web/src/lib/api/salidas.ts`.
- `?salida=<slug>` obligatorio en la mesa, la puerta, el cortejo, el plazo,
  los turnos, los días y el listado. Si falta o no existe: 400.
- El plazo se abre y se cierra con `plazoAbierto` de la salida.
- Auditoría: `ROSARIO_FECHAR` → `SALIDA_FECHAR`; nuevas `SALIDA_CREAR` y
  `SALIDA_EDITAR`.
- Correos y papeleta en PDF: el nombre de la salida, la frase de cobro según
  `cobro` y el bloque de `indicaciones`; la papeleta imprime fecha, hora y
  lugar de la salida (`leerDatosEvento` pasa a recibir la salida).
- `datos.service`: las cifras por salida se calculan recorriendo las salidas
  activas.

## CMS y web

- **Procesión → «Salidas»**: listado por orden; «Nueva salida» en ventana;
  editar en pantalla propia con grupos: Datos (nombre, slug, orden, activa),
  Fecha (Pascua ± días con la fecha que sale este año a la vista, o a mano
  eligiendo un acto de la Agenda), Cobro, Ropa, Puestos e Indicaciones.
- El editor del cortejo sigue donde está, pero lee y guarda en la salida.
- Mesa, puerta, plazo y cortejo pintan su selector desde la lista de salidas;
  con una sola salida, sin selector. La elección se recuerda por slug.
- Las zonas solo de ropa (preparación, devolución, túnicas) salen según
  `conRopa`, no según el nombre.
- Área de hermanos: las salidas con plazo abierto, no las dos fijas; el
  histórico muestra el nombre de la salida.
- Avisos masivos: el segmento «con papeleta de…» lista las salidas.
- Un `useSalidas()` común (React Query) para todo lo anterior.

## Pruebas

- Dominio: Pascua −8 da el Sábado de Pasión real de varios años (2025, 2026,
  2027, 2030); temporada de reparto y año de la papeleta en los bordes (la
  víspera, el mismo día, el día siguiente); salida a mano sin fecha.
- Migración: con papeletas, solicitudes y turnos de las dos salidas, quedan
  enlazados a su fila y la configuración copiada.
- API: alta, edición, desactivar, permisos, `?salida=` ausente o desconocido
  (400) y abrir el plazo de una salida a mano sin fecha (409). Las pruebas
  que ya existen pasan del enum al slug.
- Frontend: el selector se oculta con una sola salida y recuerda el slug.
- De punta a punta, con la app arrancada: crear una tercera salida, abrir su
  plazo, apuntar a un hermano desde el área, cobrar en la mesa y escanear la
  papeleta en la puerta.
