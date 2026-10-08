---
name: backend
description: Convenciones de la API (Express 5 + TypeScript + Prisma 7 + MariaDB + arktype). Usar al crear o modificar rutas, controladores, servicios, esquemas de validación, permisos por rol, sesiones, subidas o correos en backend-desamparados/.
---

# Backend

## Capas

`routes/` → `controllers/` → `services/` → Prisma (`config/db.ts`). **No hay capa
DAO**: los servicios consultan con `db` directamente.

- **`routes/*.routes.ts`**: declara middlewares en orden — `authenticateToken`,
  `checkRole([...])`, `validate(esquema)` — y el controlador. Nada de lógica.
- **`controllers/*.controller.ts`**: clases con métodos estáticos envueltos en
  `manejar('Error haciendo X', async (req, res) => …)` (`utils/manejar.ts`). Leen
  `req`, llaman al servicio, responden. Sin `try/catch` a mano.
- **`services/`**: la lógica de negocio y las consultas. Lanzan `HttpError(msg,
  status)` o `NotFoundError` (`utils/error.handle.ts`) para errores esperados; su
  mensaje llega al usuario tal cual, así que va en español y sin datos internos.
  Cualquier otro error se registra y sale como 500 genérico.
- **`domain/`**: funciones puras sin Express ni Prisma (cálculos, reglas,
  formatos). Lo que se pueda probar sin base de datos, aquí.
- **`schemas/*.schema.ts`**: esquemas **arktype** (no Zod) con la forma
  `{ params, query, body }`. **`dtos/`**: solo tipos TypeScript.
- **`utils/`**: piezas transversales (cookies, JWT, saneado de HTML, ficheros,
  reintento de transacciones).

## Rutas y permisos

- Todo router se monta en `app.ts` con `conModulo('…')` o `nucleo`; los
  enganches opcionales entre módulos, con `siModulo`.
- El **orden de declaración manda**: una ruta escrita antes del
  `router.use(authenticateToken)` queda abierta. Si tiene que ir antes (p. ej.
  `/admin/…` delante de `/:slug`), lleva sus middlewares en línea y un comentario
  que explique por qué. No reordenar esos ficheros.
- Roles (`enum Role` de Prisma): `USER`, `ADMIN`, `TESORERIA`, `ALBACERIA`,
  `HERMANO_MAYOR`, `REDES`, `SECRETARIA`. Cada router define su lista
  (`rolesCMS`…); `checkRole` es obligatorio en toda ruta de staff y ya exige la
  sesión del CMS.
- Una ruta protegida se comprueba **sondeando** el servidor sin sesión (401 =
  protegida, 500 = no), no leyendo el router. Ver `docs/notas-del-proyecto.md` §4.

## Sesión

- **Cookies httpOnly, no `Authorization: Bearer`.** Dos sesiones separadas:
  CMS (con segundo factor TOTP) y área de hermanos. `req.sesiones.{cms,hermano}`
  y `req.user` los rellena `middleware/session.ts`.
- La sesión se valida contra la base en cada petición (usuario activo, cortes
  de revocación, rol refrescado). No confiar en el rol del token.
- CORS solo `GET/POST/PUT/PATCH/DELETE` y `Content-Type`.

## Reglas

- Todo listado paginado: `orderBy` con desempate final `{ id: 'asc' }`, y
  `sanearPaginacion` / `respuestaPaginada` de `domain/paginacion.ts`. Si el
  esquema declara `query`, esparcir `...paginacionQuery`.
- Acciones del CMS que cambian datos → `AuditoriaService` con su acción de
  `ACCIONES_AUDITORIA`. Sin datos personales en claro en el registro.
- HTML del CMS → `sanearContenidoCms` (`utils/sanear-html.ts`) antes de guardar.
- Subidas: multer en `middleware/upload.middleware.ts`; el tipo real
  (`file-type`), ClamAV y el paso a WebP de 1920 px, en
  `controllers/subida.controller.ts`. Lo público se comprueba en
  `storage/subiendo` y solo después pasa a `storage/public`; cada foto pública
  deja además sus copias de 640 y 1280 px (`domain/variantes-de-foto.ts`). Documentos privados, en `storage/private`.
- Transacciones que pueden chocar → `utils/transaction-retry.ts`; el conflicto
  se reconoce en `esConflictoDeConcurrencia` y sale como 409.
- Correos: `services/correos/`; en pruebas nunca se envían. Los datos del Grupo
  (dirección, horario…) salen de `shared/datos-entidad.json`, nunca a mano.
- Variables de entorno nuevas: validarlas en `config/entorno.ts` y añadirlas a
  los `.env.example`.

Esquema, migraciones y consultas: skill `database`. Pruebas: skill `testing`.
