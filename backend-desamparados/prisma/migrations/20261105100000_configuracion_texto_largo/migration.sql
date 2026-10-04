-- El valor de una clave de configuración pasa a texto largo. Hasta ahora era
-- VARCHAR(191) (lo que Prisma pone a un String), y las fotos del retablo del
-- Inicio por tiempos (Cuaresma, Navidad, fechas a mano) se guardan como un
-- JSON que no cabía. Los valores que ya había se conservan tal cual.
-- El nombre de la tabla, con su mayúscula: en el servidor Linux la distingue.

-- AlterTable
ALTER TABLE `Configuracion` MODIFY `value` TEXT NOT NULL;
