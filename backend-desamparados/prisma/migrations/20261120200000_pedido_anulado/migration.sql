-- Un pedido de la tienda se puede anular (NG8, auditoría del 13-10-2026): el
-- cobrado con incidencia (agotado) y el desistimiento de los 14 días. Guarda
-- cuándo se anuló y el gasto del reembolso, si llegó a cobrarse.

-- AlterTable
ALTER TABLE `PedidoTienda` ADD COLUMN `canceladoEl` DATETIME(3) NULL,
    ADD COLUMN `reembolsoId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `PedidoTienda_reembolsoId_key` ON `PedidoTienda`(`reembolsoId`);

-- AddForeignKey
ALTER TABLE `PedidoTienda` ADD CONSTRAINT `PedidoTienda_reembolsoId_fkey` FOREIGN KEY (`reembolsoId`) REFERENCES `Transaccion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
