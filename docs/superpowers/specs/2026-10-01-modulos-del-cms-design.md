# Módulos del CMS: cada corporación enciende lo que necesita

Fecha: 01-10-2026 (inventario) y 02-10-2026 (diseño) · PC B

## Por qué

La aplicación se instala para corporaciones distintas (un Grupo Parroquial, una Hermandad, unas Cofradías Fusionadas) y no todas necesitan lo mismo: unas no tienen tienda, otras no hacen lotería, otras no quieren que los hermanos entren por la web. Hoy todo está siempre encendido: el menú del CMS, el público y las rutas de la API son listas estáticas, y la única guarda son los roles. No existe ningún mecanismo de módulo activable: ni flag, ni middleware, ni campo en los menús. Se construye desde cero.

Solo Administración podrá encender y apagar módulos.

## 1. Inventario: qué hay y qué depende de qué

Sacado del código el 01-10-2026 (quién escribe en qué tabla y quién llama a quién), no de memoria.

### 1.1 El núcleo fijo (no se puede apagar)

| Pieza | Por qué es fija |
|---|---|
| **Censo** (hermanos, cuentas, altas y bajas, familias, listas guardadas) | Recibos, Procesión, Ropero, Cabildos, Cartas, Modelo 182, Comunicados, el Inicio y Datos leen `Hermano` |
| **Recibos y cuotas** | Los generan Procesión, Tienda y Apadrinamientos; los leen Remesas, Norma 43, Modelo 182, el Inicio y Datos |
| **El libro de apuntes** (`Transaccion`, `CategoriaTransaccion`) | Recibos, Tienda, Caja, Lotería, Apadrinamientos, Donativos y Procesión escriben apuntes directamente con Prisma, en 10 sitios. **Los apuntes se registran siempre**, esté o no encendida la pantalla de Contabilidad: si un año la encienden, el ejercicio está completo |
| **Accesos, roles, sesión y 2FA** | Envuelven todas las rutas protegidas |
| **Auditoría** | La importan 77 ficheros |
| **Emails** (envío y plantillas) | La usan 13 servicios: altas, bajas, recuperación de contraseña, papeleta, donativos, contacto… |
| **Subidas de ficheros** y **Configuración** | Sin modelo propio; las usan las altas, la Norma 43, todo el CMS de contenido, Cabildos y el Modelo 182 |
| **Web pública básica**: páginas por bloques, portada, contacto, legal, barra y pie | Es la entrada a todo, incluido el acceso al área de hermanos y al CMS |
| **Inicio del CMS** y **Datos e informes** | Son agregadores: no se apagan, se adaptan a lo encendido. Datos ya va por áreas (`ClaveArea`) |

### 1.2 Módulos sueltos (nadie de negocio depende de ellos)

| Módulo | Enganches opcionales (funcionan sin ellos) |
|---|---|
| Noticias | Procesión crea una noticia al abrir el plazo (`plazo.service.ts:113`); apagado, no la crea |
| Publicaciones | — |
| Agenda | Procesión (los días de reparto y las salidas a mano crean un acto) y Sufragios (pueden ir a la Agenda); apagada, no se crean |
| Inventario y patrimonio (enseres) | Datos lo cuenta |
| Cabildos y actas | lee el Censo (asistentes) y `cabildo_reglas` |
| Cartas y etiquetas | lee el Censo y las listas |
| Lotería y talonarios | escribe en el libro de apuntes |
| Boletín y avisos | Procesión, para segmentar «con papeleta de…»; sin ella, ese filtro desaparece |
| Cortejo en directo | En código no depende de Procesión (singleton de posición sin clave a `Salida`) |
| Informe anual | solo de Datos e informes (fijo) |

### 1.3 Módulos con dependencias

| Módulo | Requiere | Dónde está la costura |
|---|---|---|
| **Procesión** (salidas, plazo, turnos, mesa, papeletas, cortejo **y ropero**) | Recibos, Agenda | crea recibos con `recibos/comunes.ts` (`papeletas.service:131,502`, `zonas.service:246-330`); los turnos y las salidas a mano crean `Evento`. El ropero (túnicas, cíngulos, prendas) **forma parte de Procesión**: toda corporación tiene túnica, y la mesa escribe en `Prenda` directamente (`ropa.ts:45-76`, `mesa.service:116,167,273`). No se separa |
| **Puerta del templo** | Procesión | `puerta.service.ts:16-17` |
| **Remesas SEPA + Norma 43** (un solo módulo) | Recibos | marcan recibos cobrados y devueltos; la Norma 43 solo sirve para conciliar remesas |
| **Pago en línea (Redsys)** | Recibos | cobra cuotas y papeletas del área de hermanos (`ZonasService.cobrar`); Tienda, Donativos y Apadrinamientos se registran en él como orígenes de pago |
| **Donativos en línea** | Pago en línea, Emails | apunte + `PagoEnLinea`; no crea recibo |
| **Apadrinamientos** | Pago en línea, Emails | apunte + correo propio |
| **Tienda** (web y caja) | Emails; la tienda web además Pago en línea (la caja, no) | apuntes al pagar y al vender |
| **Modelo 182** | Recibos (lectura); Donativos y Apadrinamientos si están | certifica recibos de donativo y lo pagado en línea con certificado |
| **Contabilidad** (pantallas: apuntes y partida doble) | el libro de apuntes (fijo) | es la única que lee y edita a mano; apagarla no deja nada huérfano |
| **Difuntos y sufragios** | Censo, Emails; Agenda opcional | pésame por correo; sufragios a la Agenda |
| **Alta por la web** («Hazte hermano») | Censo, Emails, Subidas | hoy es una página fija, no un bloque; hay corporaciones que solo dan de alta en persona |
| **Área de hermanos** | cuentas (fijo) | el bloque entero se puede apagar para una corporación que no quiera que los hermanos entren. Dentro, Recibos, Procesión y Pago en línea aparecen solo si están |

### 1.4 Pantallas que hoy mezclan áreas (habrá que trocearlas)

- **Inicio del CMS**: la pestaña Cifras junta censo, dinero y procesión en un panel (`Cifras.tsx`, `Cortejo.tsx`).
- **Ficha del censo** (`FichaCenso.tsx`): último recibo, papeleta, prendas del ropero y familia en un solo panel. `HermanoEditPage` lleva una sección «Procesión» (túnica, altura, puesto).
- **Tesorería**: pestañas Remesas (con la Norma 43 dentro) y Modelo 182. **Hermanos**: pestaña Difuntos.
- **Mesa de procesión**: `ZonaTesoreria.tsx` cobra dentro de Procesión (correcto: Recibos es fijo).
- **Inventario**: la misma pantalla y las mismas rutas (`inventario.routes.ts`) sirven los enseres (módulo Inventario) y el ropero (Procesión). Con Inventario apagado y Procesión encendida, el ropero tiene que seguir accesible.
- **Área de hermanos**: `PerfilPage` mezcla censo, procesión y forma de pago; `ProcesionPage` incluye el pago en línea; `RecibosPage` incluye los certificados de donativos. Su menú está escrito a mano (`MarcoAreaHermano.tsx`), igual que el botón «Acceso hermanos» de la barra pública y las entradas Tienda, Apadrina y Hazte hermano de `config/navegacion.ts`.
- **Bloques del constructor** que tiran de un módulo: `listado` (noticias, agenda, publicaciones), `programa` (agenda), `donativo`, `itinerario` (cortejo en directo).

### 1.5 Hallazgo aparte

`desamparados-web/src/features/cms/inicio/ComoVaElAnio.tsx` no lo importa nadie: es código muerto, precursor de Datos e informes. Se quita.

## Decisiones de partida

- El núcleo fijo es el de 1.1. Área de hermanos y Alta por la web son módulos.
- El ropero no se separa ni de Procesión ni de Inventario: toda cofradía tiene túnica.
- Los apuntes se registran siempre; Contabilidad como módulo son solo sus pantallas.
- Solo Administración ve y cambia los módulos.
- El lote inicial de cada instalación va en su configuración (`shared/datos-entidad.json`), como la identidad.
- Apagar es ocultar, no borrar: los datos se conservan y vuelven al encender.
- Enfoque elegido: **catálogo compartido + etiqueta `modulo` en cada pieza**, con una prueba guardiana de cobertura. Es la misma técnica que el género de la corporación (`shared/casos-articulos.json` y `sin-corporacion-escrita.test.ts`). Se descartaron tratar los módulos como permisos (un módulo apagado no lo ve nadie, ni responde la API; un permiso es por persona) y que cada lado llevara su propia lista (se desalinean).

## 2. El catálogo y el estado

### 2.1 `shared/modulos.json`

Una entrada por módulo que se puede apagar. El núcleo **no** está en el catálogo.

```json
{
  "clave": "tienda-web",
  "nombre": "Tienda en la web",
  "grupo": "Cuentas",
  "descripcion": "Compra desde la web pública con pago en línea; la caja del CMS es el módulo «Tienda».",
  "requiere": ["tienda", "pago-en-linea"]
}
```

- `requiere`: dependencias duras. Los enganches opcionales (Procesión crea una noticia si Noticias está) no van aquí: van en el código, preguntando (2.4).
- Cuando solo una parte de un módulo necesita otro, se parte en módulos finos: `tienda` (productos y caja) y `tienda-web` (requiere `tienda` y `pago-en-linea`); `area-hermanos` y `cuotas-en-linea` (requiere `pago-en-linea` y `area-hermanos`).
- `grupo` es el del menú del CMS, para agrupar la pantalla de Módulos igual.

**Claves:** `noticias`, `publicaciones`, `agenda`, `inventario`, `cabildos`, `cartas`, `loteria`, `comunicados`, `cortejo-directo`, `informe-anual`, `procesion` (con el ropero; requiere `agenda`), `puerta` (requiere `procesion`), `remesas` (con la Norma 43), `pago-en-linea`, `cuotas-en-linea` (requiere `pago-en-linea`, `area-hermanos`), `donativos` (requiere `pago-en-linea`), `apadrinamientos` (requiere `pago-en-linea`), `tienda`, `tienda-web` (requiere `tienda`, `pago-en-linea`), `modelo-182`, `contabilidad`, `difuntos`, `alta-web`, `area-hermanos`.

Para la guardiana, cada pieza fija lleva `modulo: 'nucleo'`.

### 2.2 El estado

Tabla `Modulo { clave String @id, activo Boolean, cambiadoEl DateTime, cambiadoPor String? }`.

- **Lote inicial:** bloque `modulos` en `shared/datos-entidad.json`, lista de claves encendidas. Desamparados arranca con todas.
- **Siembra:** crea las filas que falten con el valor del lote y **no toca** las que ya existen, para no pisar lo que Administración haya cambiado. Un módulo nuevo del catálogo que la instalación no conoce arranca apagado.
- Una fila con una clave que ya no está en el catálogo se ignora.

### 2.3 Cómo lo leen los dos lados

- **Backend:** lo carga en memoria al arrancar y lo refresca al cambiar (es un solo proceso). `modulos.activo('tienda')`.
- **`GET /api/modulos`**, público: la lista de claves activas. La web pública la necesita antes de que nadie entre (barra, pie, rutas).
- **Web:** la pide una vez al arrancar y la guarda en React Query (`useModulos()`); mientras llega, no pinta menús, como ya hace con las salidas.

## 3. Qué pasa al apagar un módulo

### 3.1 En la API

Cada router se monta con su guarda: `app.use('/api/tienda', conModulo('tienda'), tiendaRouter)`. Apagado, responde **404** con un mensaje claro («La tienda no está activada en esta instalación»). Las rutas que hoy mezclan módulos se parten por prefijo:

- Remesas y Norma 43 salen de `recibo.routes.ts` a `remesas.routes.ts`; el Modelo 182 a `modelo-182.routes.ts`.
- Las prendas y los cíngulos salen de `inventario.routes.ts` a Procesión.
- La Puerta usa rutas de Procesión: la guarda del padre basta, más la suya en sus propias rutas.
- `/api/pagos`: la guarda de `pago-en-linea`; dentro, el donativo con la de `donativos`.

### 3.2 Enganches opcionales

Una función `siModulo('noticias', () => NoticiaService.crear(...))` que no hace nada con el módulo apagado. Son pocos: Procesión → Noticias y Agenda (acto del día de reparto, acto de la salida a mano); Difuntos → Agenda (sufragios); Comunicados → el filtro «con papeleta de…»; Modelo 182 → Donativos y Apadrinamientos; Pago en línea → cada origen registrado. Nunca al revés: lo fijo (Recibos, el libro) no pregunta por nada.

Una salida `MANUAL` necesita un acto de la Agenda: por eso `procesion` requiere `agenda` (dependencia dura, no enganche).

### 3.3 En el CMS

- Las entradas de `cmsNavegacion.ts` llevan `modulo` y se filtran; el contador de secciones sin plegar cuenta las visibles.
- Una ruta de un módulo apagado enseña «Este módulo no está activado», con enlace a Sistema → Módulos si quien mira es Administración.
- Pantallas mezcladas, condicionadas por trozos:
  - Inicio: las tarjetas y gráficas de Cifras llevan `modulo`; sin Procesión no hay anillo de papeletas; los avisos de un módulo apagado no se enseñan.
  - Ficha del censo: «Papeleta de sitio» y «Del ropero» solo con Procesión. `HermanoEditPage` oculta la sección Procesión.
  - Tesorería: las pestañas Remesas y Modelo 182 solo con su módulo. Hermanos: la pestaña Difuntos.
  - Inventario: con `inventario` apagado y `procesion` encendido, la entrada del menú se llama «Ropero» y solo enseña las prendas y los cíngulos.
  - Datos e informes e Informe anual: el backend omite las áreas de módulos apagados; las pestañas desaparecen solas.

### 3.4 En la web pública

- Las entradas Tienda, Apadrina y Hazte hermano de `config/navegacion.ts` llevan `modulo` y se filtran también en el pie.
- El botón «Acceso hermanos» de la barra depende de `area-hermanos`.
- Las rutas públicas de un módulo apagado van a la página de «no encontrado» de siempre.
- Los bloques del constructor que tiran de un módulo (`listado` → noticias, agenda y publicaciones según su `fuente`; `programa` → agenda; `donativo`; `itinerario` → cortejo-directo) declaran `modulo` en `tipos-de-bloque.json`. En la web pública no se pintan si está apagado; en el editor salen con un aviso y no se ofrecen al añadir.

### 3.5 En el área de hermanos

- El menú de `MarcoAreaHermano.tsx` pasa a una lista con `modulo`: Procesión con `procesion`, Recibos siempre, el pago en línea según `cuotas-en-linea`.
- El perfil oculta «Vida cofrade» sin Procesión y la forma de pago sin `cuotas-en-linea`.
- Con `area-hermanos` apagado, `/acceso` sigue existiendo para el CMS; una cuenta sin rol de junta recibe «El área de hermanos no está activada en esta instalación».

### 3.6 Dependencias

- Encender un módulo con requisitos apagados: la pantalla propone encenderlos en el mismo paso.
- Apagar uno con dependientes encendidos: no se deja, y se dicen cuáles.
- El backend lo comprueba igual (400 con la lista en los dos casos): la pantalla no es la única defensa.

## 4. Pantalla Sistema → «Módulos»

Solo `ADMIN`. Los módulos por grupo, cada uno con interruptor, descripción, lo que requiere y **cuántos datos tiene** («12 productos, 40 pedidos»). El recuento lo da `GET /api/cms/modulos`, que para cada módulo ejecuta la cuenta que el backend declara (un `count` por modelo principal). Al apagar, un diálogo repite el recuento y explica que se conserva y se oculta. Cada cambio queda en la auditoría (`MODULO_ENCENDER`, `MODULO_APAGAR`).

## 5. Pruebas

- **Guardiana de cobertura** (`backend-desamparados/test/modulos-cobertura.test.ts`): toda ruta montada en `app.ts`, toda entrada de los tres menús (`cmsNavegacion.ts`, `config/navegacion.ts`, `MarcoAreaHermano.tsx`), toda ruta de `routes/index.tsx` y todo tipo de `tipos-de-bloque.json` llevan `modulo` (del catálogo o `nucleo`). Lo que no, falla con la lista.
- **Por módulo, en el backend:** apagado → 404 en sus rutas; sus enganches no actúan (Procesión abre el plazo sin crear noticia con `noticias` apagado); sus áreas no salen en Datos.
- **Dependencias:** encender sin requisitos → 400 con la lista; apagar con dependientes → 400 con la lista.
- **Siembra:** carga el lote de `datos-entidad.json`, no pisa cambios, apaga lo desconocido.
- **Web:** menú del CMS, barra y pie públicos y menú del área filtrados; página «módulo no activado»; un bloque de módulo apagado no se pinta.
- **De punta a punta**, con la app arrancada: apagar Tienda y Lotería desde la pantalla y recorrer CMS, web y área; volver a encender y comprobar que los datos siguen.

## Fuera de este spec

Borrar o archivar los datos de un módulo; módulos por rol o por persona; rediseñar las pantallas mezcladas más allá de condicionar sus trozos; otra pasarela de pago que no sea Redsys.
