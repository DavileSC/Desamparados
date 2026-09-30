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

## Mapa

| Carpeta | Qué es |
|---|---|
| `backend-desamparados/` | API: Express 5, TypeScript, Prisma 7 sobre MariaDB, validación con arktype |
| `desamparados-web/` | React 19, Vite, MUI 9, React Query; web pública, CMS (`/cms`) y área de hermanos |
| `shared/` | JSON que leen los dos lados (tipos de bloque, páginas, topes…). Un cambio aquí toca a ambos |
| `docs/` | notas, despliegue, `hoja-de-ruta.md` (qué falta y cómo va: se actualiza con cada commit) y traspasos (`traspaso-*.md`, del más reciente hacia atrás) |

Una tarea que cruza API, web y `shared/` se diseña de punta a punta antes de
escribir código: primero el contrato (esquema arktype y tipo de `lib/api/`).

## Comprobar

| | Tipos | Pruebas |
|---|---|---|
| Backend | `npm run comprobar-tipos` (no `tsc --noEmit`) | `npm test` (necesita MariaDB) |
| Frontend | `npx tsc -b` (no `tsc --noEmit`) | `npx vitest run --testTimeout=20000` |

Después de un `git pull`, `npx prisma generate` en el backend.

## Skills del proyecto

`backend`, `frontend`, `cms`, `database`, `testing`, `revision` y `git`, en
`.claude/skills/`. La auditoría de seguridad es la skill global `security-audit`.
