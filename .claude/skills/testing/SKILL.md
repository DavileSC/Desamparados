---
name: testing
description: Cómo se prueba el proyecto: node:test en el backend, Vitest + Testing Library en la web y el navegador para los flujos completos. Usar al escribir o arreglar pruebas, al investigar un fallo del CI o al comprobar que un cambio funciona de verdad.
---

# Pruebas

## Backend (`backend-desamparados/test/`)

- Runner de Node con `tsx`: `npm test` (≈3,5 min). Ficheros **en serie**
  (`--test-concurrency=1`): comparten la base. No quitar el flag.
- Un fichero por tema (`noticias-cms.test.ts`…), con un comentario inicial
  que dice qué fija. Lo que no necesita base (esquemas, `domain/`) se prueba
  sin ella; lo demás, contra MariaDB.
- Si falta MariaDB, el test se omite **con motivo** dentro del cuerpo:
  `t.skip(SIN_DB)`, o `t.skip(sinDb(detalle))` con el porqué, los dos de
  `test/fixtures/sin-db.ts`: empiezan por «requiere MariaDB», que es lo que
  busca la guarda del CI, y `omisiones-sin-db.test.ts` rechaza un motivo
  escrito a mano. Nunca `skip: () => …` (queda omitido para siempre).
  Omitido no es pasado.
- Los tests nunca envían correo (guarda en `services/correos/envio.ts`).
- Datos propios con sufijo aleatorio y limpieza en `after`; si se retiene una
  transacción, soltarla en `finally`. No depender de totales globales.
- Nada de `as unknown as` para llegar a interiores: la pieza se hace
  alcanzable o sale a su módulo.
- Tipos de las pruebas: `npm run comprobar-tipos` (incluye `test/`).
- Rutas protegidas: se prueban levantando `app` y midiendo el 401 sin sesión.

## Web (`desamparados-web/src/**/__tests__/`)

- Vitest + Testing Library + jsdom. Ejecutar con
  `npx vitest run --testTimeout=20000` (con 5 s caen varias por carga, en
  falso).
- `renderWithProviders` (`src/test/test-utils.tsx`) y `stubFetchPublico`
  (`src/test/fetchPublico.ts`) para simular la API.
- **MUI y `*ByRole`**: con un menú o diálogo abierto o cerrándose, el resto
  queda `aria-hidden`. `getByRole` no encuentra nada y un
  `queryByRole(...)` + `not.toBeInTheDocument()` pasa sin mirar. Esperar antes:
  `await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())`.
- Tipos: `npx tsc -b`.

## Navegador

No hay suite E2E. Para comprobar un flujo completo se abre la app real (skill
`run`, Playwright o Chrome) con backend y web levantados; antes, comprobar qué
proceso escucha en el 3001 (`docs/notas-del-proyecto.md` §5). Merecen pasarse
por el navegador: acceso con segundo factor, alta de hermano, área de hermanos,
papeletas y mesa de procesión, y guardar/publicar en el CMS.

## CI (`.github/workflows/verificacion.yml`)

Reproduce en local así: apartar el `.env`, exportar las seis variables de
arranque (`notas-del-proyecto.md` §3) y pasar las suites. Un rojo solo en el
CI suele ser una carrera de MUI o un tope de tiempo.
