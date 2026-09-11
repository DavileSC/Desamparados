# Inicio del CMS: tema claro/oscuro y «Cómo va el año» — diseño

**Fecha:** 12 de septiembre de 2026
**Estado:** pendiente de revisión del usuario
**Lienzo de referencia:** https://claude.ai/code/artifact/af1ee0d5-f8c5-4028-bf99-d86927349190
(página «A4 · claro y oscuro»; las rondas anteriores quedan en las otras dos páginas)

## 1. Por qué

El panel de `/cms` (`PanelPage.tsx`) es un informe: cuatro bloques de cifras y
gráficas que se miran una vez. No dice qué hay que hacer, no cambia de un día para
otro y, salvo la cuenta de arriba, nada empuja a entrar cada mañana. El menú son
once entradas planas, sin agrupar y sin avisos.

De tres direcciones enseñadas el 11-09-2026 el usuario eligió **A · Mesa de hoy** y,
de sus cuatro variantes, **A4 · Nocturno**: la misma pantalla en oscuro, como la web
pública, con tres condiciones suyas: interruptor claro/oscuro, Inicio visible para
toda la junta de gobierno y gráficas que se entiendan, no barras sueltas.

El Inicio tiene además un segundo uso: **es la referencia que se enseña a la junta en
la reunión de principios de año**, cuando lo que importa es el ejercicio recién
cerrado; el resto del año se mira para ver cómo va el actual.

## 2. Decisiones tomadas

| Decisión | Elegido | Motivo |
|---|---|---|
| Dirección visual | **A4**: la estructura de A (menú agrupado, «Para hoy», cifras, actividad, cuenta atrás, actos) en oscuro | Continuidad con la web pública (`#262326`, tarjetas tintadas sin borde) y menos fatiga en uso diario |
| Tema | **Interruptor Claro/Oscuro** abajo en el menú, por persona, recordado en el navegador | Lo pidió el usuario; los formularios largos (Tesorería, Contabilidad) se leen mejor en claro |
| Tema por defecto | **Oscuro** | Es la dirección elegida; quien prefiera claro lo cambia una vez |
| Quién ve el Inicio | **Los seis cargos del CMS** (todos los roles menos `USER`) | Ya es así hoy (`panel.routes.ts`, `rolesPorRutaCms.panel`); los roles acotan la edición, no la lectura |
| Qué cambia por cargo | Menú, botones de la cabecera, el enlace a Auditoría y el reparto de «Para hoy» | Cada uno actúa sobre lo suyo y ve, sin botón, lo que llevan los demás |
| Qué lleva gráfica | Lo que cambia en el tiempo o se reparte (siete gráficas) | El resto son un número o una lista: una gráfica ahí sería ruido |
| Alcance temporal | **Selector de ejercicio** sobre «Cómo va el año» (2026, 2025…), por defecto el año en curso | En la junta de principios de año se enseña el ejercicio cerrado; el resto del año, el actual |
| Cifras de cabecera y «Para hoy» | **Siempre de hoy**: el selector no las toca | Son cosas que hacer ahora; mezclarlas con un año cerrado despistaría |
| Colores de las gráficas | Azul = entra, granate claro = sale; tinta/blanco = año elegido, gris = contexto; verde/ámbar/rojo = estado | Mismo par que Contabilidad, validado con el script de dataviz en claro y en oscuro, también para daltonismo |
| Datos personales | El Inicio sigue siendo **solo agregados** | Regla de oro de `panel.service.ts`; la junta ve cifras de conjunto, no fichas |

## 3. Alcance

**Entra:**

1. Tema claro/oscuro del CMS, con interruptor y memoria por navegador.
2. Inicio nuevo en `/cms`: cabecera del día, «Para hoy» por cargo, cuatro cifras,
   actividad, cuenta atrás y próximos actos.
3. Sección «Cómo va el año» con siete gráficas, su selector de ejercicio y un «Ver
   tabla» por gráfica.
4. Menú agrupado por áreas con contadores de lo pendiente.
5. Los cinco cambios de `/api/panel` de la sección 8.

**No entra:**

- Rehacer los listados y formularios de las demás secciones: heredan el tema por usar
  MUI; solo se corrige lo que se rompa en oscuro.
- El buscador Ctrl K, el «Parte del día» de A2 y el estado «Todo al día»: quedan
  anotados como posibles siguientes pasos.
- Tocar permisos: no cambia quién entra a qué.

## 4. Qué ve cada cargo

| Pieza | ADMIN / HERMANO_MAYOR | SECRETARIA, TESORERIA, REDES, ALBACERIA |
|---|---|---|
| Menú | Todas las áreas | Solo sus secciones, con los mismos grupos |
| «Para hoy» | Todo con botón de acción | Lo suyo con botón; el resto, con «Lo lleva X» y sin botón |
| Botones de la cabecera | Nuevo acto, nuevo apunte, nueva noticia | Solo los de sus secciones |
| Cifras, «Cómo va el año», actos, cuenta atrás | Igual | Igual |
| Actividad del equipo | Igual (contenido y agenda) + enlace a Auditoría | Igual, sin enlace |

`USER` no entra al CMS: no se toca esa guarda.

## 5. Tema claro/oscuro

`theme/cms.ts` pasa a exportar `crearTemaCms(modo: 'claro' | 'oscuro')`. Los dos
modos salen de `designTokens`, sin colores nuevos:

| Papel | Claro | Oscuro |
|---|---|---|
| Lienzo | `#f4f2ee` | `#262326` (`primaryContainer`) |
| Tarjeta | `#ffffff` | `#1d1b1e` (`onPrimaryFixed`) |
| Borde / filete | `#e3dfda` / `#efebe6` | sin borde / `rgba(204,196,201,0.1)` |
| Texto | `#1b1c1a` · `#4a454a` · `#7b757a` | `#ffffff` · `#cbc5c8` · `#8f8a8d` |
| Acción principal | `#6e1822` | `#6e1822` |
| Menú lateral | `#100e11` en los dos | `#100e11` |
| Bloque destacado (cuenta atrás) | tinta `#1d1b1e` sobre claro | papel `#fbf9f6` sobre oscuro |

- El interruptor vive al final del menú, encima del bloque de usuario, como control
  segmentado de dos opciones con icono (sol / luna).
- La elección se guarda en `localStorage` (`cms-tema`) y se aplica antes del primer
  pintado para que no haya parpadeo. Sin valor guardado: oscuro.
- El bloque destacado va siempre en el tono contrario al tema: es lo que lo hace
  destacar en los dos.
- Las gráficas leen sus colores del tema, no de constantes sueltas.

## 6. Contenido del Inicio

**Cabecera.** Fecha larga, saludo con el cargo y una frase con lo que espera.

**«Para hoy».** Sale de datos que ya devuelve `/api/panel`; cuando no queda nada, la
tarjeta dice que está todo al día.

| Asunto | De dónde sale | Cargo que lo lleva | Estado |
|---|---|---|---|
| Recibos devueltos | `dinero.porEstado` (`DEVUELTO`) | Tesorería | Urgente |
| Noticias en borrador | `actividad.noticias.borradores` | Redes | Pendiente |
| Hermanos sin número | `censo.sinNumeroHermano` | Secretaría | Pendiente |
| Citas de reparto de mañana | `actividad.reparto` | Secretaría | Programado |

Cada estado lleva **color y texto**, nunca color solo. En el menú, el número dice
cuántos y el color, cuánta prisa corre.

**Cifras (cuatro).** Hermanos activos, papeletas del año, por cobrar (pendientes +
devueltos) y saldo del ejercicio en curso. Son de hoy: no las toca el selector.

**Cuenta atrás.** Días hasta el Sábado de Pasión, que se calcula: Pascua por el
algoritmo de Meeus/Butcher menos ocho días (2027: 28 de marzo menos 8 = sábado 20 de
marzo). La barra marca qué parte del curso ha pasado desde la última estación.

**Próximos actos.** Los cuatro primeros de `actividad.proximosEventos`.

**Actividad del equipo.** Últimas acciones de **contenido y agenda**, por cargo y sin
nombres (sección 8).

## 7. «Cómo va el año»

Debajo, con su cabecera y un **selector de ejercicio** encima de todo: uno solo, que
afecta a las siete gráficas y a nada más.

- Por defecto, el año en curso.
- Al elegir un año cerrado, la sección entera pasa a ese año (de enero a diciembre) y
  lo dice en la cabecera: «Ejercicio 2025 · cerrado». Es como se enseña en la reunión
  de principios de año, cuando el ejercicio nuevo todavía no tiene datos.
- La cabecera del Inicio, «Para hoy», los actos y la cuenta atrás no cambian nunca.

| Gráfica | Forma | Datos | Cómo se lee |
|---|---|---|---|
| Censo de hermanos | Línea con área | `censo.serieMensual` del ejercicio elegido (en el año en curso, los últimos doce meses) | Eje con tres marcas, primer y último valor escritos |
| Altas y bajas | Columnas a ambos lados del cero | **nuevo** `censo.movimientosMensuales` | Azul arriba, granate abajo, leyenda con totales |
| Ingresos y gastos por mes | Columnas por pares | `dinero.serieMensual` | Eje en euros, leyenda, el mes señalado muestra sus cifras al pasar el ratón |
| En qué se gasta | Barras horizontales | **nuevo** importe en `dinero.porCategoria` | Ordenadas de mayor a menor, con el importe al final |
| Cobro de recibos | Proporción + tabla de estados | `dinero.porEstado` **del ejercicio elegido** | Porcentaje cobrado, y cada estado con icono, texto, número e importe |
| Papeletas de sitio | Columnas por año | `procesion.porAnio` | Cinco años, valor sobre cada columna, el ejercicio elegido destacado |
| Hermanos por edad | Barras horizontales | `censo.porEdad` (siempre a día de hoy, y lo dice el subtítulo) | Un tramo por fila con su número |

Reglas para todas: ejes y valores legibles sin pasar el ratón; leyenda cuando hay dos
series; el ratón añade detalle pero nunca es la única forma de leer un dato; «Ver
tabla» en cada una; marcas finas, rejilla de un tono; nada de dos ejes verticales.

Sin gráfica, a propósito: las cuatro cifras, «Para hoy», los actos, la cuenta atrás y
la actividad.

## 8. Backend

Cinco cambios en `panel.service.ts` (y su tipo en `lib/api/panel.ts`), sin salirse de
la regla de oro: solo `count`, `groupBy` y `aggregate`.

1. **Ejercicio elegible.** `GET /api/panel?anio=2025`; sin parámetro, el año en curso.
   El año se valida como entero entre 2000 y el año actual (si no, 400).
   Acota `dinero.*`, `procesion.papeletas` y `procesion.porPuesto`, y
   `censo.serieMensual` (enero a diciembre de ese año; para el año en curso, los
   últimos doce meses, como hoy). **No** acota lo que es de hoy: `censo.activos`,
   `sinNumeroHermano`, `porEdad`, los próximos actos, las noticias, el reparto ni la
   actividad. La respuesta lleva `ejercicio: { anio, cerrado }` para que la pantalla
   pueda decirlo.
2. **Altas y bajas por mes.** Ya se calculan para reconstruir el censo
   (`contarPorMes`), pero no se envían. Se añade
   `censo.movimientosMensuales: { mes, altas, bajas }[]`, con los mismos meses que
   `serieMensual`.
3. **Gasto por categoría en euros.** Hoy `porCategoria.total` es el número de apuntes.
   Se añade `_sum.importe` al `groupBy` y el campo `importe`; `total` se mantiene.
4. **Recibos del ejercicio.** `recibosPorEstado` agrupa todos los años. Se filtra por
   `where: { year: anio }` (el índice `@@index([year])` ya existe).
5. **Actividad de contenido y agenda.** Nuevo `actividad.registro`: los cinco últimos
   `AuditLog` cuya `action` esté en una lista blanca de contenido —`NOTICIA_*`,
   `PUBLICACION_*`, `PAGINA_*`, `PORTADA_ACTUALIZAR`, `EVENTO_*`— devolviendo
   `{ accion, entityType, createdAt, cargo }`. `cargo` es el `role` del usuario, no su
   nombre ni su correo: el Inicio no enseña personas. Los títulos salen de
   `detalles`/`entityId` solo si no son datos personales; si no, se describe la acción.
   El registro completo sigue en Auditoría, que solo ven ADMIN y HERMANO_MAYOR.

No cambia ninguna guarda: `panel.routes.ts` ya admite los seis roles.

## 9. Frontend

- `theme/cms.ts` — `crearTemaCms(modo)`, tokens de los dos modos y superficies de
  gráfica; `cmsSurfaces` pasa a depender del modo.
- `app/temaCms.tsx` (nuevo) — contexto con el modo, lectura y escritura en
  `localStorage`, y el `ThemeProvider`.
- `app/AdminLayout.tsx` — menú agrupado, contadores, interruptor de tema, bloque de
  usuario; sigue siendo el único sitio donde vive el tema del CMS.
- `app/cmsNavegacion.ts` — los mismos ítems, con `grupo` y de dónde sale su contador.
  Los roles por ruta no se tocan (el test que compara menú y guardas sigue valiendo).
- `features/cms/PanelPage.tsx` — se reescribe como Inicio y se parte en
  `features/cms/inicio/`: `ParaHoy.tsx`, `Cifras.tsx`, `CuentaAtras.tsx`,
  `ProximosActos.tsx`, `ActividadEquipo.tsx`, `ComoVaElAnio.tsx` (con el selector) y
  `tareas.ts` (las reglas de la sección 6, sin JSX, para poder probarlas solas).
- `lib/api/panel.ts` — `getPanel(anio?)`; la clave de `useQuery` incluye el año, así
  que cambiar de ejercicio no borra lo ya cargado.
- `components/charts/` — se reutilizan `LineaTemporal` y `BarrasHorizontales` (esta
  con formato de importe y valor al final); nuevos `ColumnasPorPares`,
  `ColumnasDivergentes`, `ColumnasPorAnio` y `ProporcionEstados`, más `TablaDeDatos`
  para el «Ver tabla». Todos SVG propio, como manda la spec del panel de agosto.
- `domain/sabadoDePasion.ts` (nuevo, con pruebas) — Pascua y la fecha de la estación.

## 10. Pruebas

- `tareas.ts`: cada asunto aparece con su cargo, con botón para quien lo lleva y sin
  botón para el resto; sin asuntos, «todo al día».
- Tema: por defecto oscuro; al pulsar Claro cambia y se guarda; al volver a entrar se
  respeta lo guardado.
- `AdminLayout`: el menú de cada rol enseña solo sus secciones y los contadores salen
  de los datos del panel.
- Selector de ejercicio: al elegir un año cerrado, las gráficas piden ese año y la
  cabecera lo dice; las cifras de arriba y «Para hoy» no cambian.
- Gráficas: con series vacías no revientan y dicen que no hay datos; los valores
  escritos coinciden con los datos de entrada; la tabla tiene las mismas cifras.
- `sabadoDePasion`: 2026 → 28-03-2026; 2027 → 20-03-2027.
- Backend: los cinco cambios de la sección 8, incluido el 400 con un año inválido, y
  el test del panel ya existente.

## 11. Riesgos y decisiones abiertas

1. **Contadores del menú.** Salen del mismo `/api/panel`, así que no añaden consultas.
   Si más adelante hace falta refrescarlos aparte, se separa entonces.
2. **Cambio para Tesorería.** La tarjeta de recibos pasa a ser del ejercicio, no de
   todos los años. Es lo correcto y el selector cubre la reunión de enero, pero
   conviene avisarles del cambio.
3. **Actividad para toda la junta.** Aunque solo sea contenido y agenda, es
   información de quién trabaja. Si el usuario prefiere, se deja solo para ADMIN y
   HERMANO_MAYOR y los demás no ven esa tarjeta.
4. **Oscuro en los formularios largos.** Tesorería y Contabilidad se revisan en
   oscuro; si alguno queda peor, se documenta y se decide si esa pantalla fuerza claro.
5. **Datos de ejemplo.** Todas las cifras del lienzo son inventadas; al implementar
   salen del servidor.

## 12. Después (no ahora)

Buscador Ctrl K, «Parte del día» de A2, estado «Todo al día» con su recompensa, e
Inicio en móvil con el mismo contenido apilado. Para la reunión de la junta, dos
añadidos naturales: comparar con el ejercicio anterior (una serie gris detrás de
ingresos y gastos) y exportar la sección a PDF para repartirla.
