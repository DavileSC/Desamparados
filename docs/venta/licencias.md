# Licencias y material de terceros

Qué hay en el proyecto que no es nuestro, con qué licencia y qué obliga a
hacer. Sirve para venderlo con tranquilidad y para preparar cada instalación.
Revisado el 01-10-2026.

La lista completa de librerías, con su versión y su licencia, está en
[licencias-de-terceros.md](licencias-de-terceros.md). Se genera con
`npm run licencias` (en `backend-desamparados`): hay que volver a generarla
cuando cambian las dependencias y antes de entregar una instalación.

## El código propio

La API y la web son **privativas**: los dos `package.json` dicen
`"license": "UNLICENSED"` y `"private": true`. Antes la API decía `ISC`, que es
una licencia libre y daba permiso a cualquiera para copiarla. A cada cliente se
le da una **licencia de uso para su instalación**, no el código: eso va en el
contrato del Servicio, no aquí.

## Fuentes

Todas con la **SIL Open Font License 1.1**: se pueden usar, incrustar en
PDF y servir en una web comercial. Lo único prohibido es vender la fuente
suelta, y quien distribuya los ficheros de la fuente tiene que acompañarlos de
la licencia.

| Fuente | Dónde | Licencia |
|---|---|---|
| Exo 2 y Saira | La web (`@fontsource-variable`) | OFL 1.1, dentro de su paquete |
| Cormorant Garamond | El calendario de la Agenda (`@fontsource`) | OFL 1.1, dentro de su paquete |
| Newsreader e Instrument Sans | Los PDF de la API (`src/services/informes/fuentes`) | OFL 1.1, en `OFL-Newsreader.txt` y `OFL-Instrument-Sans.txt` junto a los `.ttf` |

## Mapas

- **Las calles del recorrido** son datos de **OpenStreetMap**, con licencia
  **ODbL**. Se descargaron de Overpass el 25-09-2026 y se sirven desde un fichero
  propio (`public/mapas/barrio-desamparados.json`), sin pedir nada a ningún
  servidor de mapas. La licencia obliga a dos cosas, y las dos están hechas:
  - el mapa dice «© colaboradores de OpenStreetMap» con su enlace, en la web
    pública y en el editor del CMS (`ATRIBUCION`, en `components/mapa/barrio.ts`);
  - el fichero es público y declara su licencia ODbL en el campo `licencia`.
- **MapLibre GL**, la librería que lo pinta: BSD-3-Clause, en la lista de
  librerías.
- **El mapa de Google del pie** es un `iframe` de Google Maps, con sus
  condiciones. Solo se carga si el visitante acepta las cookies o pulsa
  «Mostrar mapa», porque manda su IP a Google.

**En cada instalación nueva** hay que descargar el barrio de su recorrido. El de
este Grupo solo cubre unos 400 m alrededor del suyo.

## Fotos

| Fotos | De quién | Qué permite |
|---|---|---|
| Todas las de `public/images` (cabeceras, trono, Virgen, hero, nazarenos, triduo, ajuar y enseres) y las fotos de partida de la portada (`prisma/activos/portada`) | **Del Grupo**, según el historial del proyecto. Conviene tener por escrito el permiso de quien las hizo | Las usa el Grupo en su web. **No se entregan a otro cliente**: son contenido suyo |
| `templo-goretti.webp`, la ilustración de la parroquia | **Generada con IA** para el proyecto, tomando una foto del templo como referencia (confirmado el 01-10-2026) | Se puede usar. Es un dibujo nuevo del edificio, que se ve desde la calle, y no una copia de la foto. Si se rehace, que siga así: la foto como referencia, nunca calcada |
| El escudo y el escudo en oro | **Del Grupo** | Su marca. Cada cliente trae la suya |

**Las de Wikimedia Commons ya no están.** Las piezas de ejemplo de Enseres
llevaban siete fotos de otras hermandades bajadas de Commons, con el pie
«Wikimedia Commons, CC BY-SA». Esa licencia exige el nombre del autor, la
licencia y el enlace a cada original, y no se apuntaron, así que no se podían
publicar. Se han cambiado por fotos del Grupo recortadas (cruz de guía,
banderines, manto y candelería) y se han quitado las tres piezas que no tenían
una foto propia que encajara: simpecado, libro de reglas e incensario. La
migración `enseres_sin_fotos_ajenas` hace lo mismo en las bases ya desplegadas.
Los autores y los años de esas piezas **siguen siendo de ejemplo**.

**Tampoco las de la portada ni la de Unsplash.** El seed ponía en la portada
seis fotos de Commons, cinco de otras hermandades, con su autor apuntado en el
código pero sin crédito en la web: cualquier instalación nueva las habría
enseñado sin él. Ahora arranca con seis del Grupo. Y la foto de los nazarenos
de la portada y de la cabecera de Sábado de Pasión, que era de Unsplash y de
otra cofradía, es ahora una del Grupo en la salida procesional, con el mismo
nombre de fichero (la migración `nazarenos_del_grupo` cambia su descripción).

**Regla para lo que venga:** una foto que no sea del cliente solo entra con
autor, licencia y enlace apuntados aquí. Las de licencia CC BY o CC BY-SA
llevan ese crédito en su pie, en la web.

## Iconos

Los de Material (`@mui/icons-material`): MIT el paquete, Apache 2.0 los dibujos.
El `public/icons.svg` de la plantilla de Vite (con logotipos de Bluesky y
GitHub) no lo usaba nada y se ha quitado.

## Librerías que hay que mirar

Casi todas son MIT, ISC, BSD o Apache 2.0, que solo piden conservar su aviso
de licencia, y ese aviso va dentro de cada paquete. Las que tienen algo más:

| Librería | Licencia | Qué supone |
|---|---|---|
| `sharp` y sus binarios `@img/sharp-*` (libvips) | Apache 2.0 y **LGPL 3.0** | La LGPL deja usar libvips sin tocarla en un programa privativo, si se puede cambiar por otra versión. Se instala con npm sin modificar, así que se cumple. No hay que modificarla ni copiarla dentro del código |
| `mariadb`, el conector de la base de datos | **LGPL 2.1** | Lo mismo: se usa tal cual desde npm |
| `buffers` 0.1.1 (lo trae `exceljs` → `unzipper` → `binary`) | **No declara licencia** | En rigor, sin licencia no hay permiso. Es un paquete antiguo, sin cambios desde hace años y muy extendido, así que el riesgo práctico es bajo, pero no es cero. Para quitarlo del todo, habría que buscar otra forma de leer los Excel del censo |
| `dompurify` | MPL 2.0 **o** Apache 2.0 | Se elige la Apache 2.0 |
| `jszip` | MIT **o** GPL 3.0 | Se elige la MIT |

En la lista generada salen los binarios de sharp de la máquina en la que se
genera. En el servidor (Linux) son `@img/sharp-linux-x64` y
`@img/sharp-libvips-linux-x64`, con las mismas licencias.

## Para cada instalación nueva

1. Fotos, escudo y textos del cliente, y ninguno del Grupo: ni las cabeceras, ni
   el trono, ni la Virgen, ni las piezas de Enseres o Ajuar.
2. El barrio de su recorrido, descargado de OpenStreetMap, con la misma
   atribución.
3. El mapa de Google del pie, con la dirección de su sede.
4. `npm run licencias`, para entregar la lista al día.
