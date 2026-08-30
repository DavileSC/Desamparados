# Paginación completa, lectura por id y migración a user-event

**Fecha:** 30 de agosto de 2026
**Estado:** aprobado en conversación, pendiente de plan de implementación
**Precede a:** el plan de implementación en `docs/superpowers/plans/`

---

## 1. El problema

Los listados de la aplicación piden una sola página con un tope fijo y no
ofrecen pasar de página ni avisan de que falte nada. Quien mira la pantalla no
tiene forma de saber que está viendo una parte.

Medido contra la base de datos de demostración el 30 de agosto de 2026:

| Listado | Se ve | Existen | Se ocultan |
|---|---:|---:|---:|
| Contabilidad, libro mayor | 200 | 1.278 | **1.078** |
| Tesorería, recibos | 200 | 1.167 | **967** |
| Hermanos, censo | 100 | 308 | **208** |
| Inventario, ropero | 120 | 120 | 0 |
| Auditoría | 200 | 61 | 0, *por ahora* |

El resto de listados hoy caben enteros, pero ninguno tiene defensa: crecen y
empiezan a ocultar sin avisar. La auditoría es el caso más claro, porque registra
cada acción que hace cualquiera.

Hay además tres formas de respuesta distintas conviviendo, lo que obliga a cada
consumidor a saber cuál le toca:

- `{ data, meta }` con `meta = { total, page, limit, totalPages }` — censo, recibos, noticias, auditoría.
- `{ data, meta }` con `meta = { total, page, lastPage }`, sin `limit` — libro mayor.
- Array pelado, sin ninguna información de cuántos hay — publicaciones, agenda, enseres, prendas, solicitudes y los tres listados del área del hermano.

Y tres topes duros distintos en el servidor: 50 en noticias, 200 en recibos y
libro mayor, 500 en el censo.

### El fallo latente

`getAdminNewsById` (`lib/api/news.ts:78`) carga el listado del CMS y busca la
noticia dentro con `.find()`. Ese listado viene recortado: `getAdminNews()` no
manda `limit`, y el servidor aplica 10 por defecto. **A partir de la undécima
noticia, editarla lanzará «No se ha encontrado la noticia.»** Hoy no se ve porque
el seed tiene ocho.

`getAdminPublicationById` y `getPrenda` hacen lo mismo, pero sus listados no
paginan, así que hoy encuentran siempre. **En cuanto esos listados paginen, las
tres se rompen.** Por eso la lectura por id no es opcional en este trabajo.

---

## 2. Decisiones tomadas

1. **Páginas numeradas**, no «cargar más» ni scroll infinito. Se ve el total, se
   puede saltar y se vuelve al mismo sitio después de editar.
2. **Todos los listados**: los diez del CMS, los cinco de la web pública y los
   tres del área del hermano. Dieciocho en total.
3. **Tamaños a elegir: 10, 20, 30, 40 y 50**, con **20 por defecto**. El selector
   aparece en todas partes, también en la web pública.
4. **La elección de tamaño se recuerda durante la sesión**, para no tener que
   repetirla en cada pantalla.
5. **Una sola forma de respuesta** para todos los listados: `{ data, meta }`. Se
   actualizan los consumidores en el mismo trabajo. No hay terceros usando esta
   API, solo la web.
6. **Se instala `@testing-library/user-event`** y se migran los cinco ficheros de
   test que hoy usan `fireEvent`.

---

## 3. Arquitectura del servidor

### `src/domain/paginacion.ts`

Módulo de funciones puras, sin base de datos, siguiendo el patrón de
`fechas-hermano.ts` y `password-debil.ts`. Es el único sitio donde se decide qué
página se sirve.

```
sanearPaginacion(query) -> { page, limit, skip, take }
respuestaPaginada(data, total, page, limit) -> { data, meta }
```

Reglas de saneamiento, todas probadas sin base de datos:

- `page` ausente, cero, negativo o no numérico → 1.
- `limit` ausente o no numérico → 20.
- `limit` menor que 1 → 1; mayor que 100 → 100. El tope duro sigue siendo 100
  aunque el selector de la interfaz solo ofrezca hasta 50: protege de peticiones
  a mano del tipo `?limit=999999`.
- `meta` siempre trae las cuatro claves: `total`, `page`, `limit`, `totalPages`.
  `totalPages` es 0 cuando no hay ningún resultado, no 1.

Esto sustituye los tres topes distintos que hay hoy repartidos por los servicios.

### `src/config/common.ts`

Se añade `paginacionQuery`, el fragmento de arktype con `page?` y `limit?` como
cadenas de dígitos, para incorporarlo a cada esquema de consulta.

**Esto es imprescindible y es fácil pasarlo por alto:** `validate` aplica
`onDeepUndeclaredKey('delete')`, así que un parámetro que no esté declarado en el
esquema **se borra en silencio**. Sin este paso, `?page=2` no da error: se ignora
y el servidor devuelve siempre la primera página. Es el tipo de fallo que no
salta en ningún test que solo mire códigos de estado.

Esquemas a los que hay que añadirlo: agenda, enseres, prendas, publicaciones y
los que se creen para solicitudes, libro mayor, auditoría y los tres del área del
hermano.

### Contrato

Todos los listados pasan a `{ data, meta }`. **Se quedan como array pelado los
extremos de «dame los N últimos»**, que no son listados navegables y no tienen
paginación que ofrecer:

- `GET /api/news/latest` — las noticias de portada.
- `GET /api/publications/latest` — las publicaciones de portada.
- `GET /api/transacciones/categorias` — alimenta un desplegable, no una lista.
- `GET /api/inventario/dashboard` y `GET /api/transacciones/balance` — resúmenes.

---

## 4. Arquitectura del cliente

### `src/lib/api/tipos.ts`

`RespuestaPaginada<T>` con `data` y `meta`, y una función que añade `page` y
`limit` a los parámetros de una petición. Un solo tipo para los dieciocho
listados.

### `src/hooks/usePaginacion.ts`

Guarda página y tamaño **en la URL** (`?pagina=3&porPagina=50`) con
`useSearchParams`, siguiendo lo que ya hace `BrothersAdminPage` con `?vista=`.
Devuelve la página, el tamaño y las dos funciones para cambiarlos.

Dos comportamientos que el hook garantiza y que cada pantalla se ahorra:

- **Cambiar de búsqueda o de filtro vuelve a la página 1.** Si buscas «Rocío»
  estando en la página 7, quedarte en la 7 no tiene sentido.
- **Cambiar el tamaño vuelve a la página 1** y guarda la elección para el resto
  de la sesión.

La elección de tamaño se guarda en `sessionStorage`, así que dura mientras la
pestaña esté abierta y no se arrastra a la siguiente visita. **La URL manda sobre
lo guardado**: quien entre con `?porPagina=50` verá cincuenta aunque tuviera otra
cosa elegida, que es lo que espera quien recibe un enlace. Un valor guardado que
no esté entre los cinco admitidos se descarta y se vuelve a 20.

Admite un prefijo para el nombre del parámetro, porque hay pantallas con dos
listados (ver §7).

### `src/components/Paginador.tsx`

El `Pagination` de MUI —ya está en el proyecto, no hace falta dependencia
nueva—, el rango («Mostrando 21-40 de 308») y el selector de 10/20/30/40/50.

- El recuento y el selector **se ven siempre**, incluso con una sola página: son
  la única forma de cambiar el tamaño.
- Los números y las flechas se esconden cuando solo hay una página, porque no
  llevan a ningún sitio.
- Con cero resultados, el paginador no se pinta; la pantalla enseña su aviso de
  lista vacía, que ya tiene.
- Etiquetas en español (`aria-label`) y el selector con su etiqueta visible.

---

## 5. Los dieciocho listados

### CMS — diez listados en ocho pantallas

| # | Pantalla | Extremo | Forma hoy | Datos hoy |
|---|---|---|---|---|
| 1 | Hermanos · censo | `GET /api/hermanos/admin/search` | `{data,meta}`, cliente pide 100 | 308 |
| 2 | Hermanos · solicitudes | `GET /api/hermanos/admin/solicitudes` | array | 5 |
| 3 | Tesorería | `GET /api/recibos/admin` | `{data,meta}`, tope 200 | 1.167 |
| 4 | Noticias | `GET /api/news/admin/archive` | `{data,meta}`, cliente sin `limit` → 10 | 8 |
| 5 | Publicaciones | `GET /api/publications/admin` | array | 6 |
| 6 | Inventario · enseres | `GET /api/inventario/enseres` | array | 8 |
| 7 | Inventario · ropero | `GET /api/inventario/prendas` | array | 120 |
| 8 | Agenda | `GET /api/events` | array | 10 |
| 9 | Contabilidad | `GET /api/transacciones/libro-mayor` | `{data,meta}` sin `limit` | 1.278 |
| 10 | Auditoría | `GET /api/admin/audit-logs` | `{data,meta}`, cliente pide 200 | 61 |

### Web pública — cinco listados

| # | Página | Extremo | Forma hoy |
|---|---|---|---|
| 11 | `/actualidad/noticias` | `GET /api/news/archive` | `{data,meta}`, el cliente descarta `meta` → 10 |
| 12 | `/publicaciones` | `GET /api/publications` | array |
| 13 | `/publicaciones/boletines` | `GET /api/publications/category/:categoria` | array |
| 14 | `/publicaciones/dossier-prensa` | `GET /api/publications/category/:categoria` | array |
| 15 | `/actualidad/agenda` | `GET /api/events` | array |

Son rejillas de tarjetas, no listas. El paginador es el mismo componente,
centrado bajo la rejilla. **Al cambiar de página la vista sube al principio de la
rejilla**; sin eso cambias de página y apareces mirando el pie.

### Área del hermano — tres listados

| # | Pantalla | Extremo | Forma hoy |
|---|---|---|---|
| 16 | Mis recibos | `GET /api/recibos/mis-recibos` | array |
| 17 | Mis perfiles | `GET /api/hermanos/mis-perfiles` | array |
| 18 | Mi histórico | `GET /api/procesion/mis-papeletas` | array |

---

## 6. Lectura por id

Tres extremos nuevos, que cierran el fallo latente de §1:

- `GET /api/news/admin/:id` — con los roles del CMS, incluye borradores.
  Se declara **antes** de `GET /:slug`, o «admin» se interpreta como un slug. Ese
  orden ya causó una fuga de borradores en agosto (ver el comentario en
  `news.routes.ts`), así que el test acompaña al cambio.
- `GET /api/publications/:id` — con los roles del CMS.
- `GET /api/inventario/prendas/:id` — con los mismos roles que `enseres/:id`.

Con ellos, `getAdminNewsById`, `getAdminPublicationById` y `getPrenda` pasan a
pedir el elemento directamente y desaparece el `.find()` sobre el listado.

---

## 7. Casos límite

**Página fuera de rango.** Alguien llega con `?pagina=99` y hay 3 páginas: un
enlace viejo, un marcador. El servidor responde lista vacía con su `meta`
correcta, y la pantalla lleva a la última página existente en vez de enseñar un
vacío desconcertante.

**El contador de solicitudes.** La etiqueta de la pestaña dice «Solicitudes (5)»
y tiene que seguir diciendo **cuántas hay en total**, no cuántas caben en la
página. Sale de `meta.total`. Sin este cuidado, con doce solicitudes pondría
«Solicitudes (10)» y estaría mintiendo justo en el aviso que empuja a entrar.

**Inventario tiene dos listados en la misma pantalla.** Enseres y ropero llevan
paginación independiente, con parámetros distintos en la URL
(`?paginaEnseres=2&paginaPrendas=1`). Con un solo parámetro compartido, pasar
página en enseres movería también el ropero.

**Hermanos tiene dos pestañas.** Censo y solicitudes, cada una con su paginación,
también con parámetros distintos.

**Los consumidores que no paginan pero sí cambian.** La portada y la página de
actualidad piden los próximos eventos al mismo extremo que cambia de forma. No se
paginan —son «los tres próximos»— pero hay que actualizarlas para que lean
`data`. **Si se escapa una, esa sección se queda en blanco sin dar error.** Los
puntos a revisar son `features/home/EventsAndLive.tsx`, `features/news/NewsPage.tsx`
y `features/news/agenda/AgendaPage.tsx` para eventos, y las tres páginas de
publicaciones. Cada uno lleva su test.

---

## 8. Migración a user-event

Se instala `@testing-library/user-event` como dependencia de desarrollo y se
migran los cinco ficheros que hoy usan `fireEvent`: `DialogoConfirmacion`,
`PantallaEdicion`, `BrotherEditPage`, `BrothersAdminPage` y `NewsAdminPage`.

`fireEvent` lanza un evento suelto sobre el elemento; `user-event` reproduce la
cadena que provocaría una persona, incluidos foco y `blur`, y **se niega a actuar
sobre lo que una persona no podría tocar**: un campo deshabilitado, un botón
tapado. Esa es la clase de fallo que hoy no se cubre.

Los tests nuevos de paginación nacen ya con `user-event`.

---

## 9. Pruebas

**Dominio, sin base de datos** — `sanearPaginacion` y `respuestaPaginada`:
valores ausentes, cero, negativos, texto, por encima del tope, cero resultados.

**Servidor, por extremo** — que `meta` trae las cuatro claves y el total real;
que `?page=2` devuelve elementos distintos de los de la primera; que un `limit`
por encima del tope se recorta; que los tres extremos nuevos por id responden, y
que el de noticias **no** queda expuesto sin sesión.

**Cliente, por pantalla** — que pasar de página pide la página correcta; que
cambiar el tamaño vuelve a la primera; que buscar o filtrar vuelve a la primera;
que la URL refleja el estado y que entrar con `?pagina=3` arranca en la tercera;
que el contador de solicitudes enseña el total y no el de la página.

**Regresión de los consumidores** — que la portada y la página de actualidad
siguen pintando sus eventos y publicaciones tras el cambio de forma.

Todo con MariaDB levantada: los tests que la necesitan se omiten con motivo si no
está, y omitido no es pasado.

---

## 10. Fuera de alcance

- Los extremos de administración de procesión (`/api/procesion/admin/...`) no
  tienen pantalla en el CMS: no hay listado que paginar. Cuando se les haga
  pantalla, usarán las mismas piezas.
- Ordenar los listados por columna, exportar a fichero y los filtros nuevos. La
  paginación no los impide, pero no entran aquí.
- El resto de lo pendiente del proyecto: alojamiento, ClamAV real, los PDF de
  publicaciones y los datos de la entidad.

---

## 11. Orden de trabajo

1. `domain/paginacion.ts` con sus pruebas. Sin esto no hay nada más.
2. `paginacionQuery` en los esquemas, y los diez extremos del CMS al contrato
   único.
3. Los tres extremos nuevos de lectura por id.
4. Los cinco extremos públicos y los tres del área del hermano.
5. `usePaginacion` y `Paginador`, con sus pruebas.
6. Las ocho pantallas del CMS.
7. Las cinco páginas públicas y las tres del área del hermano, con los
   consumidores que solo cambian de forma.
8. Migración de los cinco ficheros a `user-event`.
