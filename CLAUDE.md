# Desamparados

Web del Grupo Parroquial Nuestra Señora de los Desamparados (Málaga): web
pública, CMS y área de hermanos.

## Siempre

- **Hablar en español**, también en commits, comentarios y mensajes al usuario.
- La corporación es **el Grupo Parroquial** (masculino). Nunca «Hermandad» ni
  «Cofradía» en texto visible. Sus miembros sí son «hermanos».
- Antes de tocar nada delicado, leer `docs/notas-del-proyecto.md`: recoge las
  trampas que no se ven en el código. No repetirlas aquí.
- Los comentarios explican **por qué**, no qué: así está escrito todo el código.
- Se trabaja en **dos PC a la vez (A y B)**, cada uno con sus tareas: antes de
  coger una, leer el reparto en `docs/hoja-de-ruta.md`. Si no sabes en cuál
  estás, pregúntalo.

## Mapa

| Carpeta | Qué es |
|---|---|
| `backend-desamparados/` | API: Express 5, TypeScript, Prisma 7 sobre MariaDB, validación con arktype |
| `desamparados-web/` | React 19, Vite, MUI 9, React Query; web pública, CMS (`/cms`) y área de hermanos |
| `shared/` | JSON que leen los dos lados (tipos de bloque, páginas, topes…). Un cambio aquí toca a ambos |
| `docs/` | notas, despliegue, `servidor.md` (el VPS tal como está y la web de pruebas), `hoja-de-ruta.md` (qué falta y cómo va: se actualiza con cada commit) y traspasos (`traspaso-*.md`, del más reciente hacia atrás) |

Una tarea que cruza API, web y `shared/` se diseña de punta a punta antes de
escribir código: primero el contrato (esquema arktype y tipo de `lib/api/`).

## Comprobar

| | Tipos | Pruebas |
|---|---|---|
| Backend | `npm run comprobar-tipos` (no `tsc --noEmit`) | `npm test` (necesita MariaDB) |
| Frontend | `npx tsc -b` (no `tsc --noEmit`) | `npx vitest run` (el tope de 30 s ya está en `vitest.config.ts`) |
| Punta a punta | (en el `tsc -b` de la web) | `npm run e2e` en la web, con backend y Vite levantados (skill `testing`) |

Después de un `git pull`, `npx prisma generate` en el backend. Los datos de la
corporación están fuera de git, en `instalacion/datos-entidad.json`: sin él no
arranca nada (las pruebas usan el ejemplo, `shared/datos-entidad.ejemplo.json`).

## Skills del proyecto

`backend`, `frontend`, `cms`, `database`, `testing`, `revision` y `git`, en
`.claude/skills/`. La auditoría de seguridad es la skill global `security-audit`.

También en `.claude/skills/`, las de antislop (filtro contra diseño, textos y
comentarios genéricos): `antislop` (la base, va siempre), `antislop-ui`,
`antislop-copywriting`, `antislop-human`, `antislop-layoutmobile` y
`antislop-code`. Son de terceros: no se editan, se actualizan copiando la
versión nueva.
