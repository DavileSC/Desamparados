-- La mesa por zonas y el Rosario vespertino.
--
-- Cada salida del año (la del Sábado de Pasión y el Rosario de octubre) tiene
-- sus días de reparto y su papeleta: un hermano puede tener una de cada.
--
-- Pedir la papeleta (desde el área de hermanos o en la mesa) crea una
-- Solicitud, no una papeleta: la papeleta nace cuando se recoge en la zona de
-- Túnicas. Si alguien no aparece a recogerla, no queda nada que anular.

-- AlterTable
ALTER TABLE `Turno` ADD COLUMN `salida` ENUM('PASION', 'ROSARIO') NOT NULL DEFAULT 'PASION';

-- AlterTable
ALTER TABLE `PapeletaSitio` ADD COLUMN `salida` ENUM('PASION', 'ROSARIO') NOT NULL DEFAULT 'PASION';

-- La clave nueva antes de quitar la vieja: empieza por hermanoId y sostiene
-- la clave ajena, que así no hay que soltar.
-- CreateIndex
CREATE UNIQUE INDEX `PapeletaSitio_hermanoId_year_salida_key` ON `PapeletaSitio`(`hermanoId`, `year`, `salida`);

-- DropIndex
DROP INDEX `PapeletaSitio_hermanoId_year_key` ON `PapeletaSitio`;

-- CreateIndex
CREATE INDEX `PapeletaSitio_year_salida_idx` ON `PapeletaSitio`(`year`, `salida`);

-- DropIndex
DROP INDEX `PapeletaSitio_year_idx` ON `PapeletaSitio`;

-- CreateTable
CREATE TABLE `Solicitud` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `salida` ENUM('PASION', 'ROSARIO') NOT NULL,
    `puesto` VARCHAR(191) NOT NULL,
    `donativo` DECIMAL(10, 2) NULL,
    `observaciones` VARCHAR(191) NULL,
    `origen` ENUM('WEB', 'MESA') NOT NULL,
    `estado` ENUM('PENDIENTE', 'RECOGIDA', 'CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
    `hermanoId` INTEGER NOT NULL,
    `citaId` INTEGER NULL,
    `reciboId` INTEGER NULL,
    `papeletaId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Solicitud_citaId_key`(`citaId`),
    UNIQUE INDEX `Solicitud_reciboId_key`(`reciboId`),
    UNIQUE INDEX `Solicitud_papeletaId_key`(`papeletaId`),
    INDEX `Solicitud_year_salida_estado_idx`(`year`, `salida`, `estado`),
    INDEX `Solicitud_hermanoId_year_salida_idx`(`hermanoId`, `year`, `salida`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Solicitud` ADD CONSTRAINT `Solicitud_hermanoId_fkey` FOREIGN KEY (`hermanoId`) REFERENCES `Hermano`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Solicitud` ADD CONSTRAINT `Solicitud_citaId_fkey` FOREIGN KEY (`citaId`) REFERENCES `Cita`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Solicitud` ADD CONSTRAINT `Solicitud_reciboId_fkey` FOREIGN KEY (`reciboId`) REFERENCES `Recibo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Solicitud` ADD CONSTRAINT `Solicitud_papeletaId_fkey` FOREIGN KEY (`papeletaId`) REFERENCES `PapeletaSitio`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `OperacionMesa` (
    `clave` VARCHAR(64) NOT NULL,
    `tipo` VARCHAR(40) NOT NULL,
    `resultado` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OperacionMesa_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`clave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
