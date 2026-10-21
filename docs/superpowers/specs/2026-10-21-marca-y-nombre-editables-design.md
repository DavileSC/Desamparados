# La marca y el nombre, editables desde el CMS

21-10-2026. Fila «La marca y el nombre, editables desde el CMS» de la hoja de
ruta (pasa del PC B al A). Mismo patrón que el contacto (11-10-2026): **el
fichero de la instalación solo siembra el primer arranque y desde ahí manda la
base**.

## Qué se edita

En Sistema → «Datos de la corporación», una pestaña nueva **«Identidad y
marca»**, solo ADMIN (la de contacto sigue para ADMIN y SECRETARIA). Auditoría
`MARCA_ACTUALIZAR`.

- **Identidad**: nombre, nombre corto, tipo, tipo corto, artículo,
  titulares, localidad, descripción, denominación, domicilio y normas.
- **Titulares** (añadido el 21-10-2026): uno o varios, en orden, el principal
  primero (`titulares`; el fichero acepta también `titular` suelto). Donde se
  nombran todos (membretes de correos y PDF, pie, títulos) salen unidos con
  «y» (`titular`, que sale de la lista: `shared/titulares.mjs`); lo de una
  sola imagen (la foto en el trono) usa el principal; las frases concuerdan
  («le guarden y bendigan»: campo `{{bendicion}}` de los correos). Las mismas reglas
  que hoy valida `shared/datos-entidad.mjs` (se sacan a `validarIdentidad` para
  usarlas también en la API).
- **Colores**: principal y acento (`#rrggbb` o vacío = los de partida). Vista
  previa en el navegador antes de guardar con `paletaDeMarca` y los avisos de
  contraste de `avisosDeMarca` (los dos son puros y ya se usan en la web).
- **Imágenes** (las de `shared/marca.mjs`, con su validación de formato,
  medidas y peso, y el antivirus como cualquier subida):
  - escudo sobre oscuro: al subirlo se reduce (lo de `--optimizar`) y salen
    de él los **cuatro iconos** (favicon, Apple, 192 y 512), con `sharp` del
    backend; lo de `preparar-marca.mjs` pasa a una función compartida;
  - escudo sobre claro;
  - escudo destacado, imagen de compartir y cabecera de los correos
    (opcionales: se pueden quitar).
  Quitar una obligatoria la devuelve a la de partida.

**Fuera:** el dominio (atado a nginx y a los certificados), `paginas-propias`
y los módulos (ya tienen su pantalla).

## Dónde vive

- **Base**: `Configuracion`, clave `corporacion_marca`, en JSON: identidad,
  colores y, por imagen, `{ fichero, version, tipo, ancho, alto }` o `null`
  (= la de partida, o ninguna en las opcionales). Sin migración.
- **Imágenes**: `storage/public/marca/`, con los nombres fijos del catálogo y
  `?v=<hash>` en las URL, como hoy. Entran en la copia de seguridad con el
  resto de `storage/`.
- **Lo que lee la web**, escrito por la API en `storage/public/instalacion/`
  al arrancar (siempre desde la base) y al guardar: `instalacion.js`,
  `manifest.json` y `cabecera.html` (el trozo del `<head>` con título,
  descripción, iconos, Open Graph y JSON-LD). Escritura atómica (temporal +
  `rename`): nginx nunca lee uno a medias.

**Primer arranque:** sin la fila, se toman la identidad y los colores del
fichero y se copian a `storage/public/marca/` las imágenes de
`instalacion/marca/` que haya. Desde entonces el fichero no cuenta para esto. Si
difiere de la base, se dice en el registro de arranque («manda lo del CMS»). En
el VPS de pruebas, el primer arranque tras desplegar siembra con lo de hoy y
nada cambia a la vista.

## La API

- `identidad`, `coloresDeMarca`, `FICHEROS_MARCA`, `IMAGENES_MARCA` e
  `IMPRENTA` pasan a ser objetos que **se cambian en su sitio** (`aplicarMarca`),
  como `secretaria`. Las copias que se hacen al cargar un módulo dejan de
  existir: `BURDEOS`, `ORO`… de `informes/pdf.ts` se leen de `IMPRENTA` en
  cada uso y la medida del escudo de los correos, al componer.
- Rutas (núcleo, solo ADMIN):
  - `GET /api/cms/corporacion/marca`: lo guardado, las URL y los avisos.
  - `PUT /api/cms/corporacion/identidad`: identidad y colores (arktype para
    la forma y el validador compartido para las reglas).
  - `PUT /api/cms/corporacion/marca/:clave` (multipart): una imagen.
  - `DELETE /api/cms/corporacion/marca/:clave`: vuelve a la de partida, o a
    ninguna.
  Cada una vuelve a escribir los tres ficheros de la web.
- `renderIndex`, `instalacionPublica`, `instalacionJs`, `manifest` e
  `imagenesDeMarca` salen de `desamparados-web/scripts/instalacion-web.mjs` a
  `shared/instalacion-publica.mjs`: los usan la API, Vite y las pruebas.

## nginx

- `/instalacion.js` y `/manifest.json`: `alias` a
  `/srv/storage/public/instalacion/…`, sin caché.
- `/marca/`: `alias` a `/srv/storage/public/marca/` (hoy, copia en `dist/`).
- `index.html` con `ssi on`: la plantilla lleva
  `<!--# include virtual="/_cabecera" -->` en lugar de las líneas con
  `{{…}}`, y `location = /_cabecera` es `internal` y apunta a `cabecera.html`.
  Así el nombre y los iconos que leen WhatsApp, Facebook y Google sin ejecutar
  JavaScript cambian al guardar, sin reiniciar nada.
- El arranque de la web (`40-instalacion.sh`) ya no escribe esos ficheros:
  valida el fichero, escribe `robots.txt` y el sitio con el dominio. La web
  ya espera a la API sana (`depends_on`), así que los ficheros existen antes
  de que nginx sirva.
- Lo mismo en `sitio-local.conf`, que no incluye `ubicaciones.conf`.

## Desarrollo

`instalacion-vite.mjs` sirve `/instalacion.js`, `/manifest.json` y `/marca/`
de `backend-desamparados/storage/public/` si la API local ya los ha escrito; si
no, los genera del fichero como hoy. `transformIndexHtml` cambia el `include`
por `cabecera.html`.

## La web

- Visitantes: lo nuevo, en la siguiente página que abran.
- Quien guarda: el tema y el nombre se leen al cargar la página. Tras guardar,
  aviso con «Recargar» para verlo en su pestaña.
- La forma de la pestaña se elige con maquetas antes de programarla.

## Pruebas

- Backend: siembra desde el fichero y que después no lo lea; guardar cambia
  el nombre y los colores en los correos y los PDF sin reiniciar; subir el
  escudo saca los cuatro iconos; formatos, medidas y peso rechazados; solo
  ADMIN; los tres ficheros escritos.
- Web: la pestaña, la vista previa y los avisos; el plugin de Vite con y sin
  ficheros de la API.
- Las guardianas de siempre (`sin-corporacion-escrita`, `sin-colores-de-marca`,
  `modulos-cobertura`).

## Despliegue

Sin migración. nginx e `instalacion-web` nuevos van en la misma imagen. La API
crea `storage/public/marca/` e `instalacion/`. `docs/despliegue.md`, «La
marca»: `instalacion/marca/` pasa a ser solo la semilla. Notas del proyecto §13,
al día.

## Después

El asistente de primer arranque (fila siguiente, PC A) ordena en pasos esta
pestaña, el contacto y los módulos.
