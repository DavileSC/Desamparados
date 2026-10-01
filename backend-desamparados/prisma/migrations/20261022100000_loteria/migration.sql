-- La lotería: los sorteos en que juega el Grupo (números, décimos y cómo se
-- reparten en participaciones) y los talonarios que se dan a vender. La
-- compra de los décimos y la liquidación de cada talonario se apuntan en la
-- contabilidad (Transaccion); si alguien borra ese apunte, aquí queda a null.
-- CreateTable
CREATE TABLE `SorteoLoteria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(120) NOT NULL,
    `fecha` DATE NOT NULL,
    `numeros` JSON NOT NULL,
    `precioDecimo` DECIMAL(10, 2) NOT NULL,
    `decimos` INTEGER NOT NULL,
    `precioParticipacion` DECIMAL(10, 2) NOT NULL,
    `jugado` DECIMAL(10, 2) NOT NULL,
    `porTalonario` INTEGER NOT NULL,
    `leyenda` TEXT NOT NULL DEFAULT '',
    `compraId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SorteoLoteria_compraId_key`(`compraId`),
    INDEX `SorteoLoteria_fecha_idx`(`fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TalonarioLoteria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sorteoId` INTEGER NOT NULL,
    `numero` INTEGER NOT NULL,
    `responsable` VARCHAR(120) NULL,
    `telefono` VARCHAR(30) NULL,
    `entregadoEl` DATETIME(3) NULL,
    `vendidas` INTEGER NULL,
    `metodoPago` ENUM('EFECTIVO', 'BIZUM', 'TRANSFERENCIA', 'TARJETA', 'DOMICILIACION') NULL,
    `liquidadoEl` DATETIME(3) NULL,
    `transaccionId` INTEGER NULL,

    UNIQUE INDEX `TalonarioLoteria_transaccionId_key`(`transaccionId`),
    UNIQUE INDEX `TalonarioLoteria_sorteoId_numero_key`(`sorteoId`, `numero`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SorteoLoteria` ADD CONSTRAINT `SorteoLoteria_compraId_fkey` FOREIGN KEY (`compraId`) REFERENCES `Transaccion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TalonarioLoteria` ADD CONSTRAINT `TalonarioLoteria_sorteoId_fkey` FOREIGN KEY (`sorteoId`) REFERENCES `SorteoLoteria`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TalonarioLoteria` ADD CONSTRAINT `TalonarioLoteria_transaccionId_fkey` FOREIGN KEY (`transaccionId`) REFERENCES `Transaccion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

