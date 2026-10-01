# El género y el nombre de la corporación en las frases

Fecha: 01-10-2026 · PC B · Tarea de la hoja de ruta: «Lo propio del Grupo, a configuración» (lo que falta tras la identidad y las salidas)

## Por qué

La identidad ya vive en `shared/datos-entidad.json` y las salidas ya son filas
editables, pero quedan unas 70 frases en el código escritas para un Grupo
Parroquial: «del Grupo Parroquial», «el Grupo», «nuestro Grupo Parroquial»,
«Datos del Grupo». Para una Hermandad tendrían que decir «de la Hermandad»,
«la Hermandad», «nuestra Hermandad»; para las Cofradías Fusionadas, «de las
Cofradías Fusionadas». Lo mismo pasa con las salidas: «del ${nombre}» falla
con «la Procesión Magna» o «los Santos Oficios».

## Alcance

- **Dentro:** todo lo que escribe la aplicación (correos, PDF, actas e
  informes, mensajes de error, CMS, área de hermanos, web pública fuera del
  contenido editable) y los textos originales de las plantillas de correo
  (`shared/usos-de-correo.json`).
- **Fuera:** el contenido de la web pública (`shared/contenido-por-defecto.json`):
  es de ejemplo y cada corporación lo reescribe desde el CMS. Tampoco las
  plantillas de correo que alguien ya haya guardado (se editan en Emails), ni
  las concordancias que dependen del hermano («Bienvenido/a» ya va por su sexo).

## Decisiones

- **Artículo, no género.** Se guarda el artículo (`el`, `la`, `los`, `las`)
  porque hay corporaciones y salidas en plural. Del artículo salen la
  contracción y el posesivo.
- **Frases calculadas, no escritas en el JSON.** Unas funciones pequeñas
  construyen «del», «al», «nuestro». En castellano solo hay dos contracciones
  (de + el, a + el): la regla es corta y se prueba entera.
- **Una prueba guardiana** impide que vuelvan a escribirse a mano.

## Datos

`shared/datos-entidad.json`, bloque `identidad`, dos campos nuevos:

```json
"articulo": "el",
"tipoCorto": "Grupo"
```

- `articulo`: `"el" | "la" | "los" | "las"`, el de `tipo` («el Grupo
  Parroquial», «la Hermandad»).
- `tipoCorto`: la forma corta que se usa dentro de un texto ya situado
  («Datos del Grupo», «las cifras del Grupo»). Para una Hermandad,
  «Hermandad».

`Salida` gana `articulo String @default("el")` (migración
`2026…200000_articulo_de_las_salidas`, del PC B). Las dos salidas de siempre
quedan con `el`.

## Funciones (`domain/articulos.ts`, en backend y en web)

Dos copias, como el resto del código compartido entre paquetes. Las dos se
prueban contra la misma tabla `shared/casos-articulos.json`, igual que
`casos-identidad.json`.

```ts
type Articulo = 'el' | 'la' | 'los' | 'las';

conArticulo(art, nombre)  // «el Grupo Parroquial», «la Hermandad», «las Cofradías Fusionadas»
deArticulo(art, nombre)   // «del Grupo Parroquial», «de la Hermandad», «de los Santos Oficios»
aArticulo(art, nombre)    // «al Grupo Parroquial», «a la Hermandad», «a las Cofradías Fusionadas»
nuestro(art)              // «nuestro», «nuestra», «nuestros», «nuestras»
mayuscula(texto)          // «El Grupo Parroquial…» al empezar frase
```

Atajos sobre la identidad (con la identidad por parámetro, por defecto la de
`datos-entidad.json`, para poder probar otra instalación):

```ts
laCorporacion({ corto?, identidad? })       // «el Grupo Parroquial» / «el Grupo»
deLaCorporacion({ corto?, identidad? })     // «del Grupo Parroquial» / «del Grupo»
aLaCorporacion({ corto?, identidad? })      // «al Grupo Parroquial»
nuestraCorporacion({ corto?, identidad? })  // «nuestro Grupo Parroquial»
```

## El barrido

Cada frase de `backend-desamparados/src` y `desamparados-web/src` (sin pruebas
ni comentarios) que nombra la corporación pasa a las funciones:

| Hoy | Pasa a |
|---|---|
| «el Grupo Parroquial» / «El Grupo Parroquial» | `laCorporacion()` / `mayuscula(laCorporacion())` |
| «del Grupo Parroquial» | `deLaCorporacion()` |
| «al Grupo Parroquial» | `aLaCorporacion()` |
| «nuestro Grupo Parroquial» | `nuestraCorporacion()` |
| «el Grupo», «del Grupo», «al Grupo» (forma corta) | las mismas con `{ corto: true }` |
| «Grupo Parroquial» suelto (rótulos, versalitas) | `identidad.tipo` |
| «Grupo» suelto en rótulos («Datos del Grupo») | la forma corta |

Con las salidas, las frases `del ${nombre}`, `al ${nombre}` y «en el
${nombre}» pasan a `deArticulo(salida.articulo, salida.nombre)` y sus
hermanas. La API (`SalidaWeb`, el alta y la edición) y el tipo `Salida` de la
web llevan `articulo`. La ficha de Salidas tiene un desplegable «Artículo» (el
/ la / los / las) con la vista previa «Papeleta del Sábado de Pasión».

## Plantillas de correo

`shared/usos-de-correo.json`:
- **Campos comunes nuevos:** `{{la_corporacion}}`, `{{de_la_corporacion}}`,
  `{{a_la_corporacion}}` y `{{nuestra_corporacion}}` (y la forma corta si hace
  falta), que `PlantillasCorreoService` rellena desde la identidad, como ya
  hace con `{{grupo}}`.
- **En `papeleta`, `apertura` y `papeleta_sin_recoger`:** `{{de_la_salida}}`
  (y `{{la_salida}}` si hace falta), rellenado con el artículo de la salida.
- **Los textos originales** usan estos campos en lugar de «Grupo Parroquial»
  escrito.

## Prueba guardiana

`backend-desamparados/test/sin-corporacion-escrita.test.ts` recorre
`backend-desamparados/src`, `desamparados-web/src` (sin pruebas, sin
comentarios) y `shared/usos-de-correo.json`. Falla si encuentra, en el código o
en el texto, «Grupo Parroquial», «el Grupo», «del Grupo», «al Grupo» o
«nuestro Grupo». Las excepciones justificadas van en una lista dentro de la
prueba, cada una con fichero, texto y motivo. Para los textos de salida, falla
si encuentra `del ${` o `al ${` seguido de un nombre de salida.

## Pruebas

- Las funciones contra `shared/casos-articulos.json`: los cuatro artículos con
  «de» y «a» (de + el = del, a + el = al; de los, a las sin contraer), el
  posesivo, la mayúscula y la forma corta.
- **Una instalación de mentira:** con una identidad «la Hermandad», el correo de
  alta aprobada, el pie de los correos, la papeleta en PDF y un acta dicen «de
  la Hermandad», «nuestra Hermandad» y ninguno contiene «Grupo».
- Una salida con `articulo: 'la'` da «Papeleta de la Procesión Magna» en el
  correo.
- La guardiana.
- De punta a punta, con la app arrancada: un correo de alta, una papeleta y el
  pie de los correos a ojo, y el desplegable de artículo en Salidas.
