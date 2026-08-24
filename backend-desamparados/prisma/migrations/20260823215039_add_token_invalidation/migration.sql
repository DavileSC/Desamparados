-- AlterTable
-- OJO: NO usamos CURRENT_TIMESTAMP(3) como default aquí: el reloj del servidor
-- MariaDB está en hora LOCAL, pero el cliente Prisma escribe/lee en UTC.
-- Un default con reloj local dejaría la columna ~2h en el futuro e invalidaría
-- todos los JWT emitidos (bug de zona horaria). Usamos epoch como default seguro
-- para inserts SQL crudos; Prisma siempre envía el valor explícito en UTC.
ALTER TABLE `User` ADD COLUMN `tokenValidAfter` DATETIME(3) NOT NULL DEFAULT '1970-01-01 00:00:00.000';

-- Backfill de filas existentes en UTC (UTC_TIMESTAMP usa el reloj del servidor
-- convertido a UTC, consistente con lo que escribe el cliente Prisma).
UPDATE `User` SET `tokenValidAfter` = UTC_TIMESTAMP(3);
