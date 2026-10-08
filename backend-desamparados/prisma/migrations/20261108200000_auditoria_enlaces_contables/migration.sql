-- Auditoría del 07-10-2026 (NG4 y FR8).
--
-- NG4: los ingresos que apunta el cobro de un pedido de la tienda, de un
-- apadrinamiento o de un donativo en línea nacían sin enlace, y la
-- contabilidad dejaba corregirlos o borrarlos a mano como si fueran manuales.
-- Cada uno guarda ahora su apunte (como ya hacía CajaVenta), y el apunte
-- enlazado no se toca desde la contabilidad. Columnas opcionales: los cobros
-- de antes se quedan sin enlace (no hay datos reales todavía).
--
-- FR8: Transaccion no tenía índices y todo lo que la lee filtra por fecha (el
-- libro, el panel, los informes), y por categoría dentro de un periodo.

-- AlterTable
ALTER TABLE `Apadrinamiento` ADD COLUMN `transaccionId` INTEGER NULL;

-- AlterTable
ALTER TABLE `PagoEnLinea` ADD COLUMN `transaccionId` INTEGER NULL;

-- AlterTable
ALTER TABLE `PedidoTienda` ADD COLUMN `transaccionId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Apadrinamiento_transaccionId_key` ON `Apadrinamiento`(`transaccionId`);

-- CreateIndex
CREATE UNIQUE INDEX `PagoEnLinea_transaccionId_key` ON `PagoEnLinea`(`transaccionId`);

-- CreateIndex
CREATE UNIQUE INDEX `PedidoTienda_transaccionId_key` ON `PedidoTienda`(`transaccionId`);

-- CreateIndex
CREATE INDEX `Transaccion_fecha_idx` ON `Transaccion`(`fecha`);

-- CreateIndex
CREATE INDEX `Transaccion_categoriaId_fecha_idx` ON `Transaccion`(`categoriaId`, `fecha`);

-- AddForeignKey
ALTER TABLE `PagoEnLinea` ADD CONSTRAINT `PagoEnLinea_transaccionId_fkey` FOREIGN KEY (`transaccionId`) REFERENCES `Transaccion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PedidoTienda` ADD CONSTRAINT `PedidoTienda_transaccionId_fkey` FOREIGN KEY (`transaccionId`) REFERENCES `Transaccion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Apadrinamiento` ADD CONSTRAINT `Apadrinamiento_transaccionId_fkey` FOREIGN KEY (`transaccionId`) REFERENCES `Transaccion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

