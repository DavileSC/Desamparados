# Panel del CMS y rediseño — diseño

**Fecha:** 28 de agosto de 2026
**Estado:** aprobado, pendiente de plan de implementación

## 1. Por qué

El CMS tiene hoy ocho páginas y ninguna vista de conjunto: `/cms` no muestra nada,
solo redirige según el rol (`desamparados-web/src/routes/index.tsx:78`). Quien entra
va directo a un formulario, sin saber cómo va el Grupo Parroquial.

Se añade un **panel principal** con gráficos y se **rediseña el CMS**, que hoy es una
barra lateral fija de 260 px sin cabecera, sin responsive y con el mismo tema oscuro
que la web pública.

## 2. Decisiones tomadas

| Decisión | Elegido | Motivo |
|---|---|---|
| Alcance del rol `HERMANO_MAYOR` | Ve y edita todo **salvo administración del sistema** | Es el máximo responsable, pero promover cargos y la configuración global son tareas técnicas del `ADMIN` |
| Quién ve el panel | Los seis roles de staff, **completo** | La junta de gobierno conoce la marcha del Grupo Parroquial; los roles existen para acotar la **edición**, no la lectura |
| Qué datos muestra | **Solo agregados**, ningún dato personal | Panel informativo de conjunto; minimización del RGPD |
| Dirección visual | **Contraste**: barra lateral oscura, lienzo claro | Conserva la identidad donde se navega y da legibilidad donde se lee y se escribe. Es además el cambio más barato: la barra ya es `#100e11` |
| Gráficos | **SVG propio**, sin librería | `vite.config.ts:26-31` manda todo `@mui/*` a `vendor-mui`, que descarga también el visitante de la web pública: una librería de gráficos del CMS la pagaría todo el mundo. El bundle (~285 kB gzip) es un hallazgo abierto |
| Carga de datos del panel | `useQuery` de TanStack Query | Ya está instalado y el provider montado en `App.tsx`, pero **no se usa en ninguna parte**: se paga su peso sin aprovecharlo. El panel es justo el caso que se beneficia (solo lectura, caché, refresco) |

## 3. Alcance

**Entra:**

1. Rediseño del CMS: tema claro propio, `AdminLayout` nuevo, responsive.
2. Panel en `/cms` con cuatro bloques y sus gráficos.
3. Endpoint `GET /api/panel` con las agregaciones.
4. Ampliación de permisos de `HERMANO_MAYOR`.

**No entra:**

- Reescribir las ocho páginas del CMS. Heredan el tema nuevo por usar componentes
  MUI; solo se tocan los desajustes que aparezcan.
- Migrar esas páginas de `useEffect` a `useQuery`.
- Activar gzip en nginx y el `pendiente.pdf` roto: son independientes y van aparte.
- Inventario en el panel (`Enser.cantidadReparar` sería útil, pero no es una de las
  cuatro áreas pedidas).

## 4. Contenido del panel

Cuatro bloques, en este orden.

**Censo** — hermanos activos, altas y bajas de los últimos doce meses, serie mensual
del censo, reparto por tramos de edad, cuántos sin `numeroHermano` asignado.

**Dinero** — recibos por estado con su importe, ingresos y gastos del ejercicio,
serie mensual de ambos, reparto por categoría.

**Procesión** — papeletas del año, papeletas por año (últimos cinco), reparto por
puesto, previsión de tallas de túnica y tramos de altura de hombro para cuadrar
varales.

**Actividad** — próximos actos de la agenda, noticias publicadas y borradores,
publicaciones, turnos de reparto y citas reservadas.

## 5. Backend

Se sigue el patrón existente (`routes` → `controller` → `service`, errores con
`handleHttp`).

- `src/routes/panel.routes.ts` — `GET /api/panel`, un único endpoint.
- `src/controllers/panel.controller.ts` — delgado, como `AgendaController`.
- `src/services/panel.service.ts` — las agregaciones, lanzadas con `Promise.all`.

Un solo endpoint y no cuatro: es una sola pantalla que se pinta de una vez, y cuatro
llamadas solo multiplicarían la latencia.

### Regla de oro del servicio

> `panel.service.ts` solo puede usar `count`, `groupBy` y `aggregate`. Tiene
> **prohibido** `findMany` sobre `Hermano` y sobre `User`.

Única excepción: `Evento`, del que se leen los próximos actos (son públicos, no son
datos personales). Así la promesa de «ningún dato personal» es verificable leyendo el
fichero, en vez de depender de que nadie se despiste.

### Contrato de la respuesta

```ts
interface PanelResponse {
  generadoEn: string                    // ISO 8601
  censo: {
    activos: number
    altas12m: number
    bajas12m: number
    sinNumeroHermano: number
    serieMensual: { mes: string; activos: number }[]        // 12, 'YYYY-MM'
    porEdad: { tramo: '0-17' | '18-30' | '31-45' | '46-60' | '61+'; total: number }[]
  }
  dinero: {
    porEstado: { estado: EstadoPago; total: number; importe: number }[]
    ejercicio: { anio: number; ingresos: number; gastos: number; saldo: number }
    serieMensual: { mes: string; ingresos: number; gastos: number }[]   // 12
    porCategoria: { categoria: string; tipo: TipoTransaccion; total: number }[]
  }
  procesion: {
    anio: number
    papeletas: number
    porAnio: { anio: number; total: number }[]              // últimos 5
    porPuesto: { puesto: string; total: number }[]
    porTalla: { talla: string; total: number }[]
    porAlturaHombro: { tramo: string; total: number }[]
  }
  actividad: {
    proximosEventos: { id: number; title: string; startDate: string; type: TipoEvento }[]  // 5
    noticias: { publicadas: number; borradores: number }
    publicaciones: { total: number; ultima: string | null }
    reparto: { turnosProximos: number; citasReservadas: number; capacidadEstimada: number }
  }
}
```

### Tres detalles que hay que resolver bien

**La serie mensual del censo no se puede consultar.** No existe «hermanos activos en
enero»: hay que reconstruirlo. Se obtienen altas por mes y bajas por mes con dos
`groupBy` sobre `fechaAlta` y `fechaBaja`, y se acumula hacia atrás partiendo del
total de hoy. Ese cálculo se aísla en una **función pura exportada** que recibe las
dos listas y el total actual y devuelve los doce puntos, para poder probarla sin base
de datos.

**`importe` es `Decimal` de Prisma**, no un número. `aggregate._sum` devuelve
`Decimal`, que serializa a JSON como objeto y llegaría roto al frontend. Toda cifra
de dinero se convierte explícitamente con `.toNumber()` en el servicio, y la
conversión se prueba.

**`PapeletaSitio.puesto` es texto libre.** En los ejemplos del propio schema conviven
`"Diputado"` y `"hombre de trono"`, así que un `groupBy` crudo separaría el mismo
puesto en varias filas según cómo se escribiera. El servicio normaliza (recorta y
compara en minúsculas) antes de agrupar, y muestra los cinco puestos mayores más
«Otros». Lo mismo con `Hermano.tunica` para las tallas. Esto se prueba con datos que
incluyan a propósito variantes de mayúsculas.

### Permisos del endpoint

`authenticateToken` + `checkRole([ADMIN, HERMANO_MAYOR, SECRETARIA, TESORERIA, REDES,
ALBACERIA])`. Es decir, todo el staff y nadie más: un `USER` recibe 403.

## 6. Frontend

**El rediseño va antes que el panel**, para no dibujarlo dos veces.

### Tema del CMS

`src/theme/cms.ts`: tema claro derivado de los mismos `designTokens`, aplicado con un
`ThemeProvider` **anidado dentro de `AdminLayout`**. Esta es la pieza que hace el
rediseño seguro: la web pública no se toca en absoluto, y las ocho páginas actuales
heredan el aspecto nuevo sin reescribirlas, porque ya usan componentes MUI.

Lienzo `#f4f2ee`, tarjetas `#ffffff`, texto `#1b1c1a`, acento burdeos `#6e1822`.

### `AdminLayout`

- Barra lateral `#100e11`, sección activa en burdeos, con «Panel» como primera entrada.
- Cabecera superior con el título de la sección y quién ha entrado.
- `Drawer` plegable por debajo de `md`: hoy la barra se come 220 px de un móvil.

### Componentes de gráficos

`src/components/charts/`, tres componentes puros que reciben datos y leen los colores
del tema:

| Componente | Props | Para |
|---|---|---|
| `LineaTemporal` | `puntos: {x: string, y: number}[]`, `etiqueta` | Censo mes a mes, ingresos y gastos |
| `BarrasHorizontales` | `filas: {etiqueta: string, valor: number}[]` | Puestos, categorías, tallas, tramos de edad |
| `BarraEstados` | `segmentos: {etiqueta, valor, estado: 'ok' \| 'aviso' \| 'error'}[]` | Recibos por estado |

Reglas que cumplen los tres, ya validadas en la maqueta: trazo de 2 px, extremos
redondeados, separación de 2 px entre segmentos contiguos, rejilla discreta, cifras
con `tabular-nums`, leyenda siempre que haya dos o más series y etiquetas directas.
Cada gráfico lleva `role="img"` con su `aria-label` descriptivo.

### Página

`src/features/cms/PanelPage.tsx` más `src/features/cms/panel/` con los cuatro
bloques. `src/lib/api/panel.ts` con `getPanel()`, siguiendo el patrón de
`lib/api/news.ts` (`apiFetch` y tipos `Api*`).

`CmsIndex` deja de redirigir y `/cms` pasa a renderizar el panel.

## 7. Colores de los datos

Se añade `designTokens.dataviz` al tema, con la paleta ya validada (no elegida a
ojo). Validador ejecutado contra las superficies reales del proyecto:

- **Claro sobre `#fbf9f6`**: `#2a78d6`, `#eb6834`, `#1baf7a`, `#eda100` — todo pasa;
  aviso de contraste en verde y ámbar.
- **Oscuro sobre `#262326`**: `#3987e5`, `#d95926`, `#199e70`, `#c98500` — todo pasa.

Estados: correcto `#1baf7a`, aviso `#eda100`, error `#e34948`.

Como el verde y el ámbar quedan por debajo de 3:1 sobre fondo claro, **es obligatorio**
que esos valores lleven etiqueta de texto visible junto a la marca. No es un adorno:
es lo que hace la pantalla legible para quien no distingue esos tonos.

## 8. Cambios de permisos

`admin.routes.ts:14` tiene hoy un `checkRole([Role.ADMIN])` global que cubre todo el
router. Se **sustituye por permisos declarados ruta por ruta**:

| Ruta | Antes | Después |
|---|---|---|
| `GET /admin/audit-logs` | `ADMIN` | `ADMIN`, `HERMANO_MAYOR` |
| `GET/POST /admin/config` | `ADMIN` | `ADMIN` (sin cambio) |
| `/admin/staff/*`, `/admin/users/search` | `ADMIN` | `ADMIN` (sin cambio) |

Y `HERMANO_MAYOR` se añade en dos sitios más, comprobados uno a uno:

| Fichero | Ahora | Después |
|---|---|---|
| `transaccion.routes.ts:14` | `use(checkRole([ADMIN, TESORERIA]))` | añadir `HERMANO_MAYOR` |
| `recibo.routes.ts:16` | `rolesTesoreria = [ADMIN, TESORERIA]` | añadir `HERMANO_MAYOR` |
| `inventario.routes.ts:25` | `rolesGestores = [ADMIN, ALBACERIA, HERMANO_MAYOR]` | **ya lo tiene**, no se toca |

Y las entradas correspondientes del menú lateral en `AdminLayout`, donde hoy
Tesorería y Contabilidad solo aparecen para `ADMIN` y `TESORERIA`.

## 9. Pruebas

**Backend**

- La función pura de la serie mensual, sin base de datos: reconstrucción correcta,
  meses sin movimientos, y un hermano dado de alta y de baja el mismo mes.
- Las agregaciones contra la base de datos sembrada, incluida la normalización de
  `puesto` con variantes de mayúsculas escritas a propósito.
- La conversión de `Decimal` a número.
- **Acceso rol por rol**: 401 sin sesión, 403 con `USER`, 200 con cada uno de los seis
  roles de staff. Y que las rutas de administración del sistema siguen dando 403 al
  `HERMANO_MAYOR`.

**Frontend**

- El panel pinta los cuatro bloques con datos simulados.
- Estados de carga, error y «sin datos todavía» (un Grupo Parroquial recién instalado
  tiene todos los contadores a cero y los gráficos no deben romperse).
- `AdminLayout` muestra las entradas que tocan según el rol.

**Verificación final sondeando el servidor real**, como en las auditorías anteriores:
levantar backend con MariaDB y comprobar los códigos de respuesta de verdad, no
leyendo el router.

## 10. Orden de implementación

1. Tema del CMS y `AdminLayout` rediseñado (con las ocho páginas revisadas por encima).
2. Componentes de gráficos, con sus tests.
3. `panel.service.ts` y su endpoint, con sus tests.
4. `PanelPage` y sus cuatro bloques.
5. Ampliación de permisos de `HERMANO_MAYOR`, con sus tests.
6. Verificación sondeando el servidor.

## 11. Riesgos

- **Fuga de datos personales por descuido.** Mitigado por la regla de oro del
  servicio, que es verificable en revisión.
- **Ampliar permisos es tocar seguridad** en un proyecto que viene de dos auditorías.
  Por eso los permisos pasan a declararse ruta por ruta y cada cambio lleva su test.
- **El tema anidado podría filtrarse a la web pública** si se coloca mal. Va dentro de
  `AdminLayout`, que solo envuelve las rutas `/cms`.
- **Coste de las agregaciones.** Son unas diez consultas. Sin caché de momento; si con
  datos reales resulta lenta, se añade entonces y no antes.
- **Panel vacío.** Con la base recién sembrada casi todo vale cero: los gráficos tienen
  que aguantarlo sin dividir por cero ni pintar áreas rotas.
