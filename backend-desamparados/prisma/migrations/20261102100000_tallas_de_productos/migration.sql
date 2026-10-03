-- Tallas de los productos de la tienda (la camiseta: S, M, L…), cada una con
-- sus existencias. Un producto con tallas se compra y se vende siempre por
-- talla; los de antes, sin tallas, siguen igual. Las líneas de los pedidos y
-- de la caja guardan la talla y copian su nombre, como copian el del producto.
-- Los nombres de tabla, con su mayúscula: en el servidor Linux la distinguen.

-- AlterTable
ALTER TABLE `CajaVentaLinea` ADD COLUMN `nombreTalla` VARCHAR(20) NULL,
    ADD COLUMN `tallaId` INTEGER NULL;

-- AlterTable
ALTER TABLE `PedidoTiendaLinea` ADD COLUMN `nombreTalla` VARCHAR(20) NULL,
    ADD COLUMN `tallaId` INTEGER NULL;

-- CreateTable
CREATE TABLE `TallaProducto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productoId` INTEGER NOT NULL,
    `nombre` VARCHAR(20) NOT NULL,
    `existencias` INTEGER NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,

    INDEX `TallaProducto_productoId_orden_idx`(`productoId`, `orden`),
    UNIQUE INDEX `TallaProducto_productoId_nombre_key`(`productoId`, `nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TallaProducto` ADD CONSTRAINT `TallaProducto_productoId_fkey` FOREIGN KEY (`productoId`) REFERENCES `Producto`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CajaVentaLinea` ADD CONSTRAINT `CajaVentaLinea_tallaId_fkey` FOREIGN KEY (`tallaId`) REFERENCES `TallaProducto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PedidoTiendaLinea` ADD CONSTRAINT `PedidoTiendaLinea_tallaId_fkey` FOREIGN KEY (`tallaId`) REFERENCES `TallaProducto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
