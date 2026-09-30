---
name: git
description: Convenciones Git del proyecto Desamparados: commits en español, qué nunca se sube y cómo se trabaja con main y GitHub. Usar al preparar un commit, una rama, un push o un Pull Request.
---

# Git

- Repositorio privado `DavileSC/Desamparados`, rama principal `main`. Se
  trabaja sobre `main` salvo que se pida rama; los PR de ramas `claude/…`
  se integran con merge.
- **Commitear y subir solo cuando se pida.** Contestar dudas no es una orden.
- Nunca `push --force`, `reset --hard` ni borrar ramas sin autorización.
- No saltarse los hooks (`--no-verify`).

## Antes del commit

1. `git status` y `git diff` completos: añadir ficheros por nombre, no
   `git add -A` a ciegas.
2. **Nunca al repositorio**: `.env*` (salvo `.env.example`), `backups/`,
   volcados `*.sql` fuera de `prisma/migrations/`, `storage/`, y
   `desamparados-web/vite.config.ts` con los `allowedHosts` del túnel de
   Cloudflare (no commitearlo ni revertirlo).
3. Tipos y pruebas del lado tocado en verde, o decir cuáles no se pasaron.

## Mensaje

En español. Título corto que diga **qué cambia para quien usa la web**
(«Junta: Datos e informes y la Memoria del curso»), no el nombre del fichero.
Cuerpo con el porqué y lo que no se ve en el diff: decisiones, causa de un
fallo, **migraciones que hay que aplicar al desplegar**. Viñetas si son
varias cosas. Termina con las líneas de atribución que marque la sesión.

Un commit por trabajo coherente; si se mezclan dos cosas, dos commits.
