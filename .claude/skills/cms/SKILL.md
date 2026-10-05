---
name: cms
description: El CMS del Grupo Parroquial y el constructor de páginas por bloques. Usar al añadir o cambiar un tipo de bloque, sus opciones de presentación, una página de la web pública editable, el contenido por defecto, la portada o las mesas de contenido (noticias, publicaciones, agenda) del CMS.
---

# CMS

## Cómo está montado

- **Toda la web pública se edita desde el CMS.** Las páginas son documentos de
  bloques guardados como JSON en `ContenidoPagina.datos` (clave: `slug`); cada
  guardado deja una copia en el historial de versiones, desde el que se vuelve
  atrás.
- **La portada es aparte**: esquema propio en `schemas/contenido.schema.ts` y
  pantalla propia (`PortadaAdminPage`).
- **Noticias, publicaciones y agenda** son tablas con su «mesa» en el CMS:
  listado con apartados (publicadas, borradores, incompletas…) + ficha única
  de edición. Publicar = `visible: true`.
- La vista previa pinta la página real con el borrador
  (`BorradorPaginaContext`) sin tocar la caché pública.
- Separación contenido / presentación: lo que dice un bloque va en sus datos;
  cómo se ve, en `presentacion`, con valores cerrados.

## Catálogos compartidos (`shared/`)

Los leen el servidor y la web. Un cambio en uno exige tocar los dos lados.

| Fichero | Qué fija |
|---|---|
| `tipos-de-bloque.json` | los tipos de bloque y su orden en «Añadir bloque» |
| `presentacion-de-bloques.json` | opciones de presentación; **el primer valor es el de siempre** |
| `paginas-publicas.json` | páginas editables: slug, ruta, grupo del índice |
| `contenido-por-defecto.json` | el contenido de partida de cada página |
| `destinos-de-enlace.json`, `topes-*.json` | destinos de enlaces y límites de texto y vídeo |

## Añadir un tipo de bloque

1. `shared/tipos-de-bloque.json` (y opciones en `presentacion-de-bloques.json`),
   con su entrada en `modulo`.
2. Backend: su esquema arktype en `src/schemas/bloques.schema.ts`.
3. Web: el componente `components/bloques/BloqueXxx.tsx` y su entrada en
   `components/bloques/registro.tsx`; el tipo en `lib/api/contenido.ts`.
4. CMS: su formulario en `features/cms/bloques/formularios*`, su nombre en
   `features/cms/constructor/etiquetas.ts`, su miniatura en `Miniatura.tsx` y
   su icono en `components/bloques/iconos.tsx`.
5. Pruebas: `test/bloques-catalogo.test.ts` y `bloques-esquemas.test.ts` en el
   backend comprueban que catálogo y esquemas cuadran.

Una página nueva: `paginas-publicas.json`, su contenido por defecto, su ruta
pública (que pinta `PaginaDeBloquesPublica slug="…"`) y el sitemap.

## Cuidado

- **Cambiar la forma del JSON guardado es una migración de contenido**:
  `prisma migrate` no la ve. `mezclarConDefectos` descarta en silencio las
  claves que no reconoce, así que sin migración lo editado se pierde. Hace
  falta migración (SQL en `prisma/migrations/`, o script como
  `migrar:bloques`) y avisarlo al desplegar. Ver `docs/notas-del-proyecto.md` §9.
- Opciones de presentación nuevas: añadir al final, sin cambiar el primer valor.
- El HTML de los textos se sanea en el servidor; en la web, `limpiarHtml`.
- El contenido de ejemplo (textos inventados) se marca como tal y se avisa
  antes de desplegar.
