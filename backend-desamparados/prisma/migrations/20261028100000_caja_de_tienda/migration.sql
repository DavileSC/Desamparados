-- La caja de la tienda: sesiones de caja (abrir con fondo, cerrar contando
-- el efectivo), sus ventas y lo vendido en cada una. Cada venta apunta su
-- ingreso en la contabilidad (Transaccion), que se quita si se anula.

-- CreateTable
CREATE TABLE `CajaSesion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `abiertaEl` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `abiertaPor` VARCHAR(120) NULL,
    `fondoInicial` DECIMAL(10, 2) NOT NULL,
    `cerradaEl` DATETIME(3) NULL,
    `cerradaPor` VARCHAR(120) NULL,
    `efectivoEsperado` DECIMAL(10, 2) NULL,
    `efectivoContado` DECIMAL(10, 2) NULL,
    `observaciones` TEXT NULL,

    INDEX `CajaSesion_cerradaEl_idx`(`cerradaEl`),
    INDEX `CajaSesion_abiertaEl_idx`(`abiertaEl`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CajaVenta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sesionId` INTEGER NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `metodo` ENUM('EFECTIVO', 'BIZUM', 'TRANSFERENCIA', 'TARJETA', 'DOMICILIACION') NOT NULL,
    `vendidaEl` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `vendedor` VARCHAR(120) NULL,
    `anuladaEl` DATETIME(3) NULL,
    `anuladaPor` VARCHAR(120) NULL,
    `transaccionId` INTEGER NULL,

    UNIQUE INDEX `CajaVenta_transaccionId_key`(`transaccionId`),
    INDEX `CajaVenta_sesionId_idx`(`sesionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CajaVentaLinea` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ventaId` INTEGER NOT NULL,
    `productoId` INTEGER NULL,
    `nombre` VARCHAR(120) NOT NULL,
    `precio` DECIMAL(10, 2) NOT NULL,
    `cantidad` INTEGER NOT NULL,

    INDEX `CajaVentaLinea_ventaId_idx`(`ventaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CajaVenta` ADD CONSTRAINT `CajaVenta_sesionId_fkey` FOREIGN KEY (`sesionId`) REFERENCES `CajaSesion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CajaVenta` ADD CONSTRAINT `CajaVenta_transaccionId_fkey` FOREIGN KEY (`transaccionId`) REFERENCES `Transaccion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CajaVentaLinea` ADD CONSTRAINT `CajaVentaLinea_ventaId_fkey` FOREIGN KEY (`ventaId`) REFERENCES `CajaVenta`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CajaVentaLinea` ADD CONSTRAINT `CajaVentaLinea_productoId_fkey` FOREIGN KEY (`productoId`) REFERENCES `Producto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

