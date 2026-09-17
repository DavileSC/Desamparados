# Constructor de páginas para la web pública — diseño

**Fecha:** 17 de septiembre de 2026
**Estado:** aprobado, pendiente de implementar

## 1. Por qué

El CMS edita hoy los textos y las fotos de **cuatro** páginas (`portada`,
`recorrido`, `historia`, `titular`). Las otras dieciséis páginas públicas tienen
el contenido escrito dentro de su `.tsx`, así que cambiar un párrafo exige tocar
código y desplegar.

Y aun en esas cuatro, **la estructura la fija el código**: el esquema de arktype
de cada slug dice qué bloques hay y en qué orden. No se puede añadir un párrafo
entre dos secciones ni mover una sección de sitio.

El 15 de septiembre el usuario pidió expresamente que la estructura NO fuera
editable («me parece demasiado», ver
[`2026-09-15-portada-y-recorrido-editables-design.md`](2026-09-15-portada-y-recorrido-editables-design.md)).
El 16 de septiembre cambió de criterio y pidió lo contrario:

> La parte de contenido en el CMS está bien, pero lo que tenga que ver con la
> página publica debe ir con su apartado propio y sus subapartados, para que se
> pueda editar toda la página publica (Contenido, estructura, colores, etc)
> desde el CMS.

Al ofrecerle tres alcances, eligió **el constructor de páginas de verdad**:
bloques que se añaden, se quitan y se reordenan.

## 2. Decisiones tomadas

| Decisión | Elegido | Motivo |
|---|---|---|
| Alcance | Recomponer las páginas que ya existen | Sin crear páginas nuevas: no hay rutas dinámicas, ni menú editable, ni sitemap que mantener, ni forma de dejar enlaces rotos |
| Páginas ya editables | Convertir Historia, Recorrido y Titular; **la portada se queda como está** | Su estructura (hero rotativo, cuenta atrás, agenda en directo, teselas) no va a cambiar, y trasladarla es mucho riesgo en la página más vista para ninguna ganancia |
| Publicación | Guardar y publicar a la vez, con vista previa | Es como funciona hoy el CMS; los borradores duplicarían el contenido en la base y añadirían estado que nadie ha pedido |
| Almacenamiento | Lista de bloques dentro del documento JSON que ya existe | Conserva el patrón actual, la validación en servidor y —sin tocar una línea— el limpiador de ficheros huérfanos, que busca rutas dentro del JSON |
| Pantalla del CMS | Lista de bloques plegables (diseño A) | Es como ya funcionan Historia y la galería: a quien use el CMS no le cambia nada salvo que ahora puede añadir y quitar |
| Colores | **Fuera de este spec** | El usuario pidió «contenido, estructura y colores». Los dos primeros son esto; los colores son un proyecto aparte y se decidirá después |

## 3. Cómo se guarda una página

`ContenidoPagina.datos` deja de tener una forma distinta por slug y pasa a tener
siempre la misma:

```json
{
  "cabecera": { "titulo": "…", "subtitulo": "…", "foto": "/storage/public/…", "fotoAlt": "…" },
  "bloques": [
    { "tipo": "texto", "html": "<p>…</p>" },
    { "tipo": "cronologia", "hitos": [ … ] }
  ]
}
```

**La cabecera no es un bloque.** Está siempre y no se puede quitar: así nadie
deja una página sin título por reordenar mal.

### El registro de bloques

Cada tipo de bloque declara en un único sitio:

1. su **esquema** de arktype (servidor), que lo valida;
2. su **componente público** (web), que lo pinta;
3. su **formulario** (CMS), que lo edita;
4. su **nombre y ayuda**, que es lo que lee quien edita.

El documento se valida recorriendo `bloques` y aplicando el esquema que
corresponde a cada `tipo`, con un mapa `tipo → esquema`, igual que hoy hace
`esquemaDeSlug` con los slugs. **No se usa una unión discriminada de arktype:**
arktype 2.1 revienta al describir el error de una unión cuyas ramas llevan
`narrow`, y eso sería un 500 en vez de un 400 (ya obligó a `updateConfigSchema`
y al esquema de la galería a ir por este camino).

Un bloque de tipo desconocido se rechaza con un 400 que nombra el tipo. No se
ignora en silencio: un bloque que desaparece al guardar es peor que un error.

### Que los dos lados no se separen

El riesgo de este diseño es que el catálogo del servidor y el del CMS dejen de
coincidir: se añade un bloque en la web y el servidor lo rechaza, o al revés.

Se resuelve como ya se resuelve en este proyecto con las listas de
`sanitizeHtml`: **un test del backend lee el fichero del registro del frontend**
y falla si la lista de tipos no es la misma en los dos lados.

### Lo que NO hay que tocar

- `utils/ficheros-publicos.ts`: busca rutas `/storage/public/<hex>` dentro del
  JSON serializado, así que sigue encontrando las fotos de cualquier bloque.
- `utils/sanear-html.ts`: el bloque de texto guarda HTML y pasa por el mismo
  saneado que las noticias.
- `shared/contenido-por-defecto.json`: sigue siendo la fuente de los valores de
  partida; solo cambia la forma de su contenido.

## 4. El catálogo de bloques

### Bloques de contenido

| Bloque | Qué es | De dónde sale |
|---|---|---|
| `texto` | Párrafos con formato, títulos, listas, citas, enlaces y fotos | TipTap y el saneado, ya hechos |
| `galeria` | Pase de fotos y vídeos | `GaleriaMedios`, ya hecho |
| `cronologia` | Hitos con periodo, relato, foto y tono | Extraer de `HistoryPage` |
| `itinerario` | Paradas con hora y lugar, con plano | Extraer de `RecorridoPage` |
| `tarjetas` | Rejilla de tarjetas con título, texto y enlace | `GlassCard`, hoy repetido en tres páginas |
| `foto` | Una foto a lo ancho con su pie | Nuevo, pequeño |
| `llamada` | Título, texto y botón | Nuevo, pequeño |
| `datos` | Lista de pares (horario de cultos, datos de contacto) | Nuevo, pequeño |

### Bloques que encapsulan funcionalidad

Cuatro páginas no son solo contenido. En vez de dejarlas fuera, su parte
funcional se convierte en un bloque que no lleva datos editables salvo su
configuración:

| Bloque | Qué hace | Páginas |
|---|---|---|
| `listadoPublicaciones` | Lista paginada de publicaciones de una categoría | Publicaciones, Boletines, Dossier de prensa |
| `formularioHermano` | El formulario de solicitud de ingreso | Hazte hermano |

Así esas páginas también se recomponen: se les puede poner texto antes y después
del listado, que es justo lo que hoy exige tocar código.

## 5. Las páginas, y en qué fase entra cada una

**Puro contenido (13).** Corporación, Cultos, Órganos de gobierno, Parroquia,
Nuestros fines, Caridad, Formación, Sábado de Pasión, Trono, Enseres, Hermanos,
Ajuar y Desamparados.

**Con funcionalidad (4).** Publicaciones, Boletines, Dossier de prensa y Hazte
hermano.

**Con CMS a medida hoy (3).** Historia, Recorrido y Sagrada Titular.

**Fuera.** Portada. Y las páginas que no son contenido: actualidad, noticias,
agenda, legales, área del hermano y CMS.

## 6. La migración del contenido

El contenido de esas páginas **está hoy escrito en el código** y hay que
trasladarlo a la base de datos. Es la parte con más riesgo de perder cosas.

- Un guion de migración vuelca el contenido actual de cada página a su documento
  de bloques, y se guarda como valores de partida en
  `shared/contenido-por-defecto.json`.
- **Un test por página compara el texto visible antes y después de la
  conversión.** Si un párrafo se pierde por el camino, falla.
- La migración es idempotente, como la siembra: correrla dos veces no pisa lo
  que se haya editado.

## 7. Cómo se prueba

- **Dominio y esquemas:** cada bloque, con sus casos de rechazo (una foto que no
  es nuestra, un texto con etiquetas que el saneado no admite, un tipo
  desconocido).
- **Coherencia:** el test que compara el catálogo del servidor con el del CMS.
- **Migración:** el texto visible de cada página, antes y después.
- **CMS:** añadir, quitar, reordenar y guardar; y que la cabecera no se pueda
  quitar.
- **Web pública:** que cada bloque se pinta, y que una página sin bloques no
  revienta.
- **De punta a punta:** arrancar la aplicación y recorrer una página real. Esto
  no es opcional: con las suites en verde, la galería de vídeo estaba rota
  porque el servidor rechazaba justo lo que el CMS pedía pegar.

## 8. Fases de entrega

1. **Motor y página piloto.** El registro, la validación, el editor de la lista
   en el CMS, los bloques `texto`, `foto` y `tarjetas`, y la conversión de
   Corporación. Al terminar esta fase ya se ve funcionando de verdad.
2. **Resto de bloques y páginas planas.** Los bloques `llamada`, `datos` y
   `galeria`, los dos funcionales, y las dieciséis páginas restantes. Repetitivo
   y de bajo riesgo.
3. **Las tres con CMS a medida.** Los bloques `cronologia` e `itinerario` —que
   se hacen aquí y no antes porque es aquí donde se estrenan— y la conversión de
   Historia, Recorrido y Titular. Se retiran sus pantallas propias del CMS.

## 9. Lo que este diseño NO hace

- No crea páginas nuevas ni toca las rutas, el menú o el sitemap.
- No toca la portada.
- No permite elegir colores ni tipografías: los bloques se pintan con el tema de
  la web. Cada bloque sabe pintarse bien solo, y esa es la decisión que impide
  que un constructor genérico empeore el diseño que ya existe.
- No añade borradores, historial de versiones ni permisos por página.
