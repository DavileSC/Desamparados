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

- Vitest + Testing Library + jsdom. Ejecutar con `npx vitest run`. El tope
  (30 s) ya está en `vitest.config.ts`: no pasar `--testTimeout`, que manda
  sobre el fichero y, si es menor, da rojos falsos por carga.
- `renderWithProviders` (`src/test/test-utils.tsx`) y `stubFetchPublico`
  (`src/test/fetchPublico.ts`) para simular la API.
- **MUI y `*ByRole`**: con un menú o diálogo abierto o cerrándose, el resto
  queda `aria-hidden`. `getByRole` no encuentra nada y un
  `queryByRole(...)` + `not.toBeInTheDocument()` pasa sin mirar. Esperar antes:
  `await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())`.
- Tipos: `npx tsc -b`.

## Punta a punta (`desamparados-web/e2e/`)

- Playwright contra la web y la API de verdad: `npm run e2e` en la web. En
  local corre contra el backend y el Vite que ya estén levantados (no arranca
  nada); en el CI los arranca él, con la base sembrada (job «Punta a punta»).
- Ficheros `*.e2e.ts`, fuera de `src/`: Vitest no los ve. Tipos con `npx tsc -b`
  (`tsconfig.e2e.json`).
- Los datos los crea y los borra la API: `backend-desamparados/scripts/e2e-datos.ts`
  (`preparar`/`limpiar` con un sufijo), desde `e2e/preparacion.ts`. Cuentas
  `e2e-…@pruebas.invalido`: a `.invalido` la API nunca manda correo. Una cuenta
  con doble factor por prueba: el mismo código TOTP no vale dos veces en el
  mismo medio minuto. Lo que crea una prueba (la noticia, el pedido, el alta)
  lleva el sufijo y lo borra `limpiar`.
- El alta avisa al buzón de Secretaría: con la cuenta de correo de verdad en
  el `.env` se salta. Para probarla en local, la API con `EMAIL_BUZON_PRUEBAS=true`.
- La tienda con `PAGO_EN_LINEA=redsys` (el CI) no sale a Redsys: la prueba
  intercepta el formulario, comprueba la firma con su propia implementación
  (`e2e/redsys.ts`) y hace de banco. Con el pago simulado, esa parte se salta.
- Si falla en el CI, el artefacto «punta-a-punta» trae la traza:
  `npx playwright show-trace trace.zip`.

## Navegador

Lo que aún no cubre `e2e/` se mira con la app real (skill `run`, Playwright o
Chrome) con backend y web levantados; antes, comprobar qué proceso escucha en
el 3001 (`docs/notas-del-proyecto.md` §5). Sigue mereciendo pasarse a mano:
la mesa de procesión y la puerta, y cualquier pantalla nueva a 390 px.

## CI (`.github/workflows/verificacion.yml`)

Reproduce en local así: apartar el `.env`, exportar las seis variables de
arranque (`notas-del-proyecto.md` §3) y pasar las suites. Un rojo solo en el
CI suele ser una carrera de MUI o un tope de tiempo.
