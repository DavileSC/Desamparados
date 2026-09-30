-- CreateTable
CREATE TABLE `PagoEnLinea` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pedido` VARCHAR(12) NULL,
    `userId` INTEGER NOT NULL,
    `metodo` ENUM('EFECTIVO', 'BIZUM', 'TRANSFERENCIA', 'TARJETA', 'DOMICILIACION') NOT NULL,
    `importe` DECIMAL(10, 2) NOT NULL,
    `reciboIds` JSON NOT NULL,
    `solicitudIds` JSON NOT NULL,
    `estado` ENUM('PENDIENTE', 'PAGADO', 'RECHAZADO', 'INCIDENCIA') NOT NULL DEFAULT 'PENDIENTE',
    `respuesta` VARCHAR(8) NULL,
    `autorizacion` VARCHAR(12) NULL,
    `motivo` TEXT NULL,
    `resueltaPor` INTEGER NULL,
    `resueltaEl` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PagoEnLinea_pedido_key`(`pedido`),
    INDEX `PagoEnLinea_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `PagoEnLinea_estado_createdAt_idx`(`estado`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

