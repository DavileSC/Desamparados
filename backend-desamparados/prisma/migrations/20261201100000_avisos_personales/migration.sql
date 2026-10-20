-- Avisos personales: lo que va a una sola cuenta (el justificante de un pago,
-- la papeleta sin recoger, el recordatorio de la cita) se guarda para leerlo
-- en la página Avisos del área. Y la cita apunta cuándo se recordó la víspera.
-- (El nombre de la tabla va con su mayúscula: en Linux MariaDB distingue.)

-- CreateTable
CREATE TABLE `AvisoPersonal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `uso` VARCHAR(60) NOT NULL,
    `asunto` VARCHAR(200) NOT NULL,
    `resumen` VARCHAR(300) NOT NULL,
    `html` LONGTEXT NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AvisoPersonal_userId_creadoEn_idx`(`userId`, `creadoEn`),
    INDEX `AvisoPersonal_creadoEn_idx`(`creadoEn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AvisoPersonal` ADD CONSTRAINT `AvisoPersonal_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `Cita` ADD COLUMN `recordadaEl` DATETIME(3) NULL;
