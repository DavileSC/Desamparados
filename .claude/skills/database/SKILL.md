---
name: database
description: Esquema Prisma 7 sobre MariaDB, migraciones y consultas del backend. Usar al tocar prisma/schema.prisma, crear una migración, añadir índices o restricciones únicas, cambiar la forma de un JSON guardado, escribir consultas con transacciones o tocar la siembra (seed).
---

# Base de datos

- **Prisma 7** (no TypeORM) con `@prisma/adapter-mariadb`. Cliente único en
  `src/config/db.ts`. En local, MariaDB nativa de Windows en el puerto 3306 (no
  Docker); la base se elige con `DATABASE_HOST` / `DATABASE_NAME`.
- Esquema: `backend-desamparados/prisma/schema.prisma`. Tras cambiarlo, o tras
  un `git pull`, `npx prisma generate`.

## Migraciones

**Nunca `prisma migrate dev`**: el usuario de la base no puede crear la base
«sombra». El camino es:

```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
```

1. Guardar el SQL en `prisma/migrations/<AAAAMMDD>100000_<nombre>/migration.sql`.
   Las carpetas siguen una fecha correlativa **posterior a la última
   existente** (un día más), no la fecha real: así el orden no se rompe.
2. Encabezar el SQL con un comentario de qué hace y por qué.
3. `npx prisma migrate deploy` para aplicarla en local.
4. Anotar la migración: hay que aplicarla al desplegar.

Las migraciones de **contenido** (la forma del JSON de `ContenidoPagina.datos`)
también van aquí, como `UPDATE` sobre el JSON, o como script idempotente con
modo informe y `--aplicar`. El compilador no ve dentro de una columna JSON.

## Esquema

- `@@unique` para lo que el negocio no permite repetir (DNI, email, slug…):
  el error de clave única se traduce solo a un 409 legible
  (`CAMPOS_UNICOS` en `utils/error.handle.ts`: añadir ahí el nombre del campo).
- `@@index` en las columnas por las que filtran o agrupan los listados.
- `onDelete` pensado en cada relación: `SetNull` si el registro debe
  sobrevivir, `Cascade` solo si es parte del padre. Los autores de versiones y
  auditoría se copian (id y nombre), no se relacionan.
- Secretos del usuario (hash, TOTP, tokens) están omitidos por defecto
  (`omit` en `db.ts`); pedirlos con `omit: { campo: false }` solo donde hagan falta.
- Tablas y columnas nuevas con `utf8mb4_unicode_ci`.

## Consultas

- Paginación: `orderBy` con desempate `{ id: 'asc' }` al final.
- `innodb_snapshot_isolation=ON`: dos transacciones sobre la misma fila chocan
  (1020/1213). Usar `transactionWithRetry` (`utils/transaction-retry.ts`); tras
  subir Prisma, pasar `test/censo-altas-bajas.test.ts` y
  `test/transaction-retry.test.ts`.
- Informes y cifras: `count`, `groupBy`, `aggregate`; nada de sacar personas
  para contarlas.
- Siembra: `prisma/seed*.ts`, idempotente (`npm run seed`). El contenido
  sembrado es de ejemplo.
