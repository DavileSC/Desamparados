-- AlterTable
ALTER TABLE `Hermano` ADD COLUMN `fechaDefuncion` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `Sufragio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `hermanoId` INTEGER NOT NULL,
    `tipo` ENUM('MISA_FUNERAL', 'MISA_ANIVERSARIO', 'MISA_SUFRAGIO', 'ORACION') NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `lugar` VARCHAR(200) NULL,
    `notas` TEXT NULL,
    `eventoId` INTEGER NULL,
    `familiaAvisada` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Sufragio_hermanoId_fecha_idx`(`hermanoId`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Sufragio` ADD CONSTRAINT `Sufragio_hermanoId_fkey` FOREIGN KEY (`hermanoId`) REFERENCES `Hermano`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

