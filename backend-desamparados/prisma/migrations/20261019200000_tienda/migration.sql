-- La tienda en línea y los pagos sin cuenta.
--
-- · PagoEnLinea: el pago ya no es solo del área de hermanos. origen dice qué
--   se paga (recibos, un pedido de la tienda o un apadrinamiento) y
--   referenciaId, cuál; userId pasa a ser opcional, porque en la tienda se
--   compra sin cuenta. Los pagos que ya había son del área de hermanos.
-- · Producto, PedidoTienda y PedidoTiendaLinea: el catálogo y los pedidos,
--   que se recogen en Secretaría.


-- AlterTable
ALTER TABLE `PagoEnLinea` ADD COLUMN `origen` ENUM('AREA_HERMANOS', 'TIENDA', 'APADRINAMIENTO') NOT NULL DEFAULT 'AREA_HERMANOS',
    ADD COLUMN `referenciaId` INTEGER NULL,
    MODIFY `userId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Producto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(120) NOT NULL,
    `descripcion` TEXT NOT NULL DEFAULT '',
    `precio` DECIMAL(10, 2) NOT NULL,
    `foto` VARCHAR(191) NULL,
    `existencias` INTEGER NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Producto_activo_orden_idx`(`activo`, `orden`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PedidoTienda` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(32) NOT NULL,
    `nombre` VARCHAR(120) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(30) NOT NULL,
    `estado` ENUM('PENDIENTE_PAGO', 'PAGADO', 'ENTREGADO', 'CANCELADO') NOT NULL DEFAULT 'PENDIENTE_PAGO',
    `total` DECIMAL(10, 2) NOT NULL,
    `metodo` ENUM('EFECTIVO', 'BIZUM', 'TRANSFERENCIA', 'TARJETA', 'DOMICILIACION') NULL,
    `pagadoEl` DATETIME(3) NULL,
    `entregadoEl` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PedidoTienda_token_key`(`token`),
    INDEX `PedidoTienda_estado_createdAt_idx`(`estado`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PedidoTiendaLinea` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pedidoId` INTEGER NOT NULL,
    `productoId` INTEGER NULL,
    `nombre` VARCHAR(120) NOT NULL,
    `precio` DECIMAL(10, 2) NOT NULL,
    `cantidad` INTEGER NOT NULL,

    INDEX `PedidoTiendaLinea_pedidoId_idx`(`pedidoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PedidoTiendaLinea` ADD CONSTRAINT `PedidoTiendaLinea_pedidoId_fkey` FOREIGN KEY (`pedidoId`) REFERENCES `PedidoTienda`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PedidoTiendaLinea` ADD CONSTRAINT `PedidoTiendaLinea_productoId_fkey` FOREIGN KEY (`productoId`) REFERENCES `Producto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

