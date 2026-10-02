---
name: frontend
description: Convenciones de la web (React 19 + TypeScript + Vite + MUI 9 + React Query). Usar al crear o modificar páginas, componentes, hooks, llamadas a la API, formularios, estilos o el tema en desamparados-web/.
---

# Frontend

## Estructura de `desamparados-web/src`

- **`app/`**: los marcos de cada zona (`MarcoPublico`, `MarcoCms`,
  `MarcoAreaHermano`, `MarcoAcceso`) y la navegación del CMS.
- **`routes/index.tsx`**: todas las rutas con `pagina(Componente, modulo)`,
  con `lazy()` por página; `ExigeSesion` / `ExigeRol` protegen el área de
  hermanos y el CMS. Menús con `modulo:`; `useModulos()` para condicionar
  trozos de pantalla.
- **`features/<área>/`**: una carpeta por área (`actualidad`, `altas`,
  `areaHermano`, `cms`, `corporacion`…), con sus páginas `XxxPage.tsx` y sus
  pruebas en `__tests__/`. No hay separación `Page`/`View` ni Atomic Design.
- **`components/`**: piezas compartidas (`Boton`, `CabeceraDePagina`,
  `MetaDePagina`, `DialogoConfirmacion`, tarjetas…) y los bloques de página en
  `components/bloques/`.
- **`lib/api/`**: un módulo por recurso sobre `llamarApi` (`cliente.ts`), que
  traduce la respuesta del servidor a los tipos de la web (`aNoticia`…).
- **`hooks/`**, **`lib/`**, **`domain/`** (lógica pura), **`theme/`** (tema
  público `index.ts` y del CMS `cms.ts`), **`config/site.ts`** (datos del
  Grupo: `null` = pendiente de confirmar, nunca inventar).

## Datos

- Siempre por `llamarApi` de `lib/api/cliente.ts`: `fetch` nativo a `/api`
  (mismo origen), cookie de sesión adjunta sola; **no se guarda ningún token**.
  Los errores llegan como `ErrorDeApi` con `status` y `fields` por campo.
- Lecturas con `useQuery` y claves en array (`['contenido', slug]`); tras
  guardar, `invalidateQueries` de las claves afectadas.
- Formularios: `react-hook-form` + `zod` (el backend valida aparte con
  arktype; lo compartido entre los dos, en `shared/`).
- Estado global solo el de la sesión (`zustand`, `features/altas/auth/store`).

## Estilo

- Identificadores, textos y comentarios en español.
- Colores y tipografías del tema, no a mano. Antes de meter un color nuevo,
  calcular el contraste WCAG AA (`docs/notas-del-proyecto.md` §11).
- Botones con `Boton` (`appVariant`: `primary`, `claro`, `outline`), sin
  iconos. Tarjetas sin bordes.
- Todo adaptable: móvil, tableta y portátil (1280×552 útil es una pantalla
  real del equipo).
- Cargas con esqueleto de la forma real de la página
  (`components/esqueleto/`), no con un spinner.
- Accesibilidad: etiquetas en los campos, roles correctos, foco visible.
- Para elegir un diseño se enseñan maquetas a tamaño real, no esquemas.

## Comprobar

- Tipos: `npx tsc -b` (con `--noEmit` no comprueba nada).
- `npm run lint` (oxlint). Si cambian las rutas públicas, `npm run sitemap` y
  commitear `public/sitemap.xml` (el CI lo exige).
- Nunca commitear `vite.config.ts` con los `allowedHosts` del túnel.

Páginas por bloques y CMS: skill `cms`. Pruebas: skill `testing`.
