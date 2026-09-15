# Portada y Recorrido editables desde el CMS — diseño

**Fecha:** 15 de septiembre de 2026
**Estado:** aprobado, pendiente de implementar

## 1. Por qué

El CMS gestiona hoy las noticias, las publicaciones, la agenda, el censo, el
inventario y las cuentas, pero **la portada solo por sus fotos**: los textos de
sus seis bloques están escritos a mano en los componentes, la foto del bloque
«Sábado de Pasión» es un fichero del repositorio y el itinerario de la
procesión es un array literal dentro de `RecorridoPage.tsx`.

Eso significa que cambiar una coma de la portada, o la hora de una parada del
recorrido, **exige tocar código y volver a desplegar**. La corporación no puede
depender de eso para un cambio de texto.

Lo pidió el usuario así:

> Me gustaría que en el CMS, la parte de Portada, pueda editar todos los bloques
> de la página web por si un día hay que cambiar algún texto o imagen. La
> estructura no porque me parece demasiado pero aunque sea texto y fotos, sí
> debe poder hacerse. Y en Corporación - Sábado de Pasión - Recorrido, también
> debe dejar cambiarlo en el CMS, tanto añadiendo una imagen como poniendo en
> texto el recorrido como se tiene ya.

## 2. Decisiones tomadas

| Decisión | Elegido | Motivo |
|---|---|---|
| Qué se puede editar | **Textos e imágenes; los destinos de los enlaces, no** | Elección del usuario. Nadie puede dejar un botón apuntando a una página que no existe |
| Añadir o quitar bloques | **No** | «La estructura no»: el orden y el número de bloques siguen en el código |
| Dónde se guarda | **Un documento JSON por página**, tabla `ContenidoPagina` | Las 9 paradas son una lista ordenada y en clave-valor plano no caben sin claves tipo `recorrido.paradas.3.hora`. Un solo `PUT` no puede dejar media portada guardada |
| Cómo lo lee la portada | **Ampliando la llamada que el hero ya hace** | `Hero.tsx` ya espera a `/api/portada/imagenes` antes de pintar; si esa llamada devuelve también los textos, la portada no hace ni una petición más que hoy |
| Textos de hoy | **Valores por defecto en `shared/`**, leídos por la siembra y por el frontend | Un solo fichero para los dos lados: no pueden desajustarse |
| Campo que falta | **Cae en el valor por defecto** (mezcla profunda) | Añadir un campo nuevo más adelante no obliga a migrar las filas guardadas |
| Recorrido: plano o texto | **Los dos, los dos opcionales** | «Tanto una imagen como el texto». Se enseña lo que haya; no hay que elegir un modo |
| Paradas | **Hora + lugar, con añadir, quitar y reordenar** | «Como se tiene ya» |
| Quién edita | **ADMIN, REDES, HERMANO_MAYOR** | Los mismos que ya editan Portada y Noticias |

## 3. Alcance

**Entra:**

1. Tabla `ContenidoPagina` y su siembra con los textos actuales.
2. API pública y de CMS para leer y guardar esos documentos.
3. `/cms/portada` pasa de «fotos de la cabecera» a la portada entera, por
   secciones.
4. `/cms/recorrido`, pantalla nueva.
5. Los seis bloques de la portada y `RecorridoPage` leen del documento.
6. La foto de «Sábado de Pasión» y el plano del recorrido pasan por el mismo
   circuito de subida que el resto (recodificadas sin EXIF, contadas por el
   limpiador de huérfanos).

**No entra:**

- Cambiar los destinos de los enlaces, ni añadir, quitar o reordenar bloques y
  teselas.
- Generar tamaños responsivos de las fotos subidas (ver §9).
- Tocar las demás páginas de Corporación. Solo Recorrido, que es la que se pidió.
- El modelo `Pagina`, que existe pero no lo usa ningún cliente. Se queda como
  está; no es donde va esto.

## 4. Modelo de datos

Una tabla, dos filas:

```prisma
// Contenido editable de una página: un documento por página, validado contra
// su esquema antes de escribirse. La estructura la fija el código; esto guarda
// lo que dentro de ella se puede cambiar (textos e imágenes).
model ContenidoPagina {
  slug      String   @id            // 'portada' | 'recorrido'
  datos     Json
  updatedAt DateTime @updatedAt
}
```

La migración se escribe a mano con `prisma migrate diff`, como manda
`docs/notas-del-proyecto.md` §3: el usuario de la base no puede crear la base
sombra que necesita `migrate dev`.

## 5. API

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `GET /api/portada` | público | `{ imagenes, textos }`: la única llamada que necesita la portada |
| `GET /api/contenido/:slug` | público | El documento de `portada` o `recorrido`, ya mezclado con los valores por defecto |
| `PUT /api/contenido/:slug` | CMS | Guarda el documento entero, validado |
| `PUT /api/portada/imagenes` | CMS | **Sin cambios**, la que ya existe |

`GET /api/portada/imagenes` desaparece: lo absorbe `GET /api/portada` y no hay
todavía nadie a quien mantenerle compatibilidad
(`proyecto-sin-usuarios-todavia`).

`:slug` se valida contra una lista cerrada (`portada` | `recorrido`), no contra
un patrón: un slug libre convertiría la tabla en un almacén de JSON arbitrario
escrito por el CMS.

`PUT /api/contenido/:slug` va **después** del `.use(authenticateToken)` de su
router, o lleva sus middlewares en línea con el comentario que explica por qué
—la regla de `notas-del-proyecto.md` §4—, y se comprueba sondeando el servidor,
no leyendo el router.

## 6. El documento de la portada

Seis bloques, en el orden en que salen en la web. Entre paréntesis, dónde está
hoy escrito a mano.

```jsonc
{
  "hero": {                    // Hero.tsx
    "ceja": "Grupo Parroquial · Málaga",
    "titulo": "Desamparados Málaga",
    "parrafo": "Devoción, historia y patrimonio…",
    "botonPrincipal": "Conoce el Grupo Parroquial",
    "enlaceSecundario": "Agenda y cultos"
  },
  "actualidad": {              // FeaturedNews.tsx
    "ceja": "Actualidad",
    "titulo": "Últimas noticias",
    "enlace": "Ver todas"
  },
  "agenda": {                  // EventsAndLive.tsx
    "ceja": "Cultos",
    "titulo": "Agenda y Cultos",
    "parrafo": "La vida de oración del Grupo Parroquial…",
    "enlace": "Calendario completo",
    "directoTitulo": "Ver en directo",
    "directoTexto": "Retransmisión desde la sede"
  },
  "accesos": {                 // QuickAccess.tsx
    "placa": {
      "ceja": "Hazte hermano",
      "titulo": "Forma parte de nuestra historia",
      "texto": "Una comunidad de fe que vive la devoción…",
      "boton": "Quiero ser hermano"
    },
    "teselas": [
      { "clave": "sede",       "titulo": "Nuestra sede", "descripcion": "Parroquia de los Pasionistas" },
      { "clave": "caridad",    "titulo": "Caridad",      "descripcion": "Ayuda social y obra asistencial" },
      { "clave": "historia",   "titulo": "Historia",     "descripcion": "Orígenes y evolución del Grupo Parroquial" },
      { "clave": "boletines",  "titulo": "Boletines",    "descripcion": "Boletín informativo y anuarios" },
      { "clave": "youtube",    "titulo": "Canal de YouTube", "descripcion": "Vídeos y retransmisiones" },
      { "clave": "contacto",   "titulo": "Contacto",     "descripcion": "Estamos a tu disposición" }
    ]
  },
  "sabadoDePasion": {          // ProcessionScene.tsx
    "ceja": "Sábado de Pasión",
    "titulo": "Una devoción que\ncamina con nosotros.",
    "parrafo": "La fe compartida, el encuentro y la emoción…",
    "enlace": "Vive el Sábado de Pasión",
    "imagenUrl": "/images/nazarenos-1280.webp",
    "imagenAlt": "Nazarenos de capirote blanco durante la procesión"
  },
  "publicaciones": {           // FeaturedPublications.tsx
    "boton": "Archivo de publicaciones",
    "marcaDeAgua": "DESAMPARADOS"
  }
}
```

Tres detalles que no son evidentes:

- **Las teselas son una lista con `clave` fija**, no un array libre. El destino,
  el icono y el orden siguen en el código, atados a esa clave; el documento solo
  aporta título y descripción. Una tesela cuyo `clave` el código no conozca se
  ignora, y una que el documento no traiga usa su texto por defecto. Así el
  documento no puede romper el mosaico.
- **`titulo` de «Sábado de Pasión» lleva un salto de línea real** (`\n`). Hoy es
  un `<br />` dentro del JSX, y un campo de texto no puede guardar etiquetas: se
  pinta con `white-space: pre-line`. Es la única forma de conservar el corte a
  dos líneas que tiene el diseño.
- **La ceja de Publicaciones no está**: es «Publicaciones · *mes año*» calculada
  de la publicación destacada. Ese bloque solo tiene dos campos propios, y eso
  explica que su sección del CMS sea tan corta.

## 7. El documento del recorrido

```jsonc
{
  "titulo": "Recorrido",
  "subtitulo": "Itinerario oficial de la estación de penitencia.",
  "introduccion": "El itinerario de la procesión del Sábado de Pasión…",
  "tituloItinerario": "Itinerario y horarios aproximados",
  "plano": { "url": "", "alt": "" },
  "paradas": [
    { "hora": "17:30", "lugar": "Salida desde la Parroquia de los Desamparados" }
  ]
}
```

Reglas de pintado, todas comprobables:

- Con `plano.url` vacío, no se pinta imagen ninguna (ni hueco, ni marco).
- Con `paradas` vacío, no se pinta la rejilla ni su título.
- Con las dos cosas, el plano va primero y las paradas debajo.
- Sin ninguna de las dos, queda la cabecera y la introducción. No es un error:
  es una página en preparación.

`plano.alt` es obligatorio si hay `plano.url`. Un plano sin descripción deja sin
recorrido a quien use lector de pantalla, que es justo lo que este bloque cuenta.

## 8. Las pantallas del CMS

### 8.1 `/cms/portada`

Deja de ser «fotos que rotan en la cabecera» y pasa a ser la portada entera, en
**secciones plegables en el orden real de la web**:

1. **Cabecera** — los textos del hero y, debajo, las fotos que ya se editan hoy
   (el componente actual entra tal cual como contenido de esta sección).
2. **Actualidad** — ceja, título, enlace.
3. **Agenda y Cultos** — ceja, título, párrafo, enlace y los dos textos del aviso
   de retransmisión.
4. **Accesos directos** — la placa (4 campos) y las 6 teselas (título y
   descripción cada una).
5. **Sábado de Pasión** — ceja, título (con su salto de línea), párrafo, enlace,
   y la foto con `CampoImagen` más su descripción.
6. **Publicaciones** — botón y marca de agua.

Un solo «Guardar» al pie, con el aviso de cambios sin guardar de
`PantallaEdicion`, que es lo que ya hace esta pantalla. Las fotos y los textos
se guardan con **dos peticiones distintas** (`PUT /portada/imagenes` y
`PUT /contenido/portada`) porque son dos almacenes; el botón las encadena y, si
la segunda falla, lo dice sin fingir que se guardó todo.

Cada campo lleva debajo, en gris, dónde sale en la web («el antetítulo pequeño
sobre el título del bloque»). Sin eso, «ceja» no significa nada para quien no ha
hecho el diseño.

### 8.2 `/cms/recorrido`

Entrada nueva en el menú, grupo **«Contenido»**, detrás de Portada. Mismos roles.

Cabecera (título y subtítulo), introducción, título del itinerario, el plano con
`CampoImagen` y su descripción, y la tabla de paradas: cada fila con hora y
lugar, y los botones de subir, bajar y quitar que ya usa `PortadaAdminPage` para
las fotos. «Añadir parada» al final.

`rolesPorRutaCms` y `itemsMenu` se tocan a la vez, en `cmsNavegacion.ts`:
`AdminLayout.test.tsx` compara las dos y falla si divergen.

## 9. Riesgos y costes aceptados

**La foto de «Sábado de Pasión» pierde el `srcset`.** Hoy existe en cuatro
tamaños (1200/1280/1600/1920) porque está puesta a mano. Las subidas del CMS se
sirven en un solo fichero: es lo que ya les pasa a las fotos del hero, que van a
pantalla completa. Se acepta por coherencia y para no meter aquí la generación
de tamaños, que es un trabajo propio. Hasta que alguien suba otra, el valor por
defecto sigue apuntando al fichero de 1280 del repositorio.

**El limpiador de huérfanos no conoce la tabla nueva.**
`subidasReferenciadas()` y `contarReferencias()`
(`src/utils/ficheros-publicos.ts`) enumeran tabla por tabla qué ficheros están
en uso. Si `ContenidoPagina` no entra en las dos, `npm run limpiar:huerfanos`
**borraría la foto de «Sábado de Pasión» y el plano estando publicados**, y el
guardado de la portada borraría del disco la foto que acaba de sustituir sin
comprobar que nadie más la usa. Son dos filas: se leen enteras y se mete su
`JSON.stringify` en la lista de textos donde ya se buscan nombres de subida. El
propio fichero avisa de esto en el comentario de `contarReferencias`.

**La pantalla de Portada se hace larga.** Seis secciones y unos treinta campos.
Se pliegan, y la primera (Cabecera) viene abierta.

**Un documento guardado puede quedarse corto** si mañana se añade un campo. Por
eso la lectura es una **mezcla profunda** sobre los valores por defecto y no una
sustitución: lo que el documento no traiga, sale del defecto. Sin esto, cada
campo nuevo obligaría a migrar las filas o dejaría huecos en la web.

La mezcla es profunda **en los objetos y no en las listas**, y esto hay que
escribirlo porque la alternativa es un fallo silencioso:

- **`paradas` se sustituye entera.** Si se mezclara elemento a elemento, borrar
  las nueve paradas dejaría las nueve por defecto de vuelta y el CMS parecería
  no guardar. Una lista vacía guardada significa vacía.
- **`teselas` se casa por `clave`, no por posición.** Del documento se toman
  título y descripción de la tesela cuya clave coincide; las claves que el
  código no conoce se descartan y las que el documento no trae se quedan con su
  texto por defecto. Por posición, quitar una del documento correría todas las
  demás y cada tesela quedaría con el texto de otra.

## 10. Verificación

TDD en los dos lados. Lo que hay que probar, y por qué cada cosa:

**Backend**

- `PUT /api/contenido/portada` con un documento mal formado responde 400 y **no
  escribe**. Sin la segunda mitad, un 400 podría llegar después de haber tocado
  la fila.
- Un slug que no es `portada` ni `recorrido` responde 404, no crea fila.
- Sin sesión, 401 (sondeando el servidor, no leyendo el router).
- Con sesión de hermano pero sin cargo, 403.
- `GET /api/contenido/portada` sobre una fila a la que le falta un campo lo
  devuelve con su valor por defecto.
- `GET /api/portada` trae imágenes y textos en la misma respuesta.
- `subidasReferenciadas()` incluye la foto que menciona `ContenidoPagina`. Este
  test se escribe **viéndolo fallar primero**: es el que evita borrar una foto
  publicada.
- La siembra es idempotente y no pisa un documento ya editado.

**Frontend**

- Cada bloque de la portada enseña el texto guardado.
- Cada bloque cae en el texto de siempre cuando el campo falta o la API falla.
- El título de «Sábado de Pasión» conserva sus dos líneas.
- Recorrido: solo plano, solo paradas, las dos, y ninguna.
- Borrar todas las paradas las deja borradas: la mezcla no las repone desde el
  valor por defecto.
- Una tesela con `clave` desconocida se ignora sin romper el mosaico, y una que
  falta conserva su texto por defecto **en su sitio**, sin correr a las demás.
- Un plano sin descripción no se puede guardar (lo rechazan el formulario y el
  servidor).
- La pantalla de Portada avisa si falla el guardado de los textos después de
  haber guardado las fotos.

**Comprobación final, con los servidores levantados:** entrar al CMS, cambiar un
texto de cada bloque y la foto de «Sábado de Pasión», guardar, y ver la portada
a 390 y 1440 px con los textos nuevos. Y después `npm run limpiar:huerfanos`
(sin `--borrar`) para confirmar que la foto recién subida **no** sale en la
lista de huérfanos.
