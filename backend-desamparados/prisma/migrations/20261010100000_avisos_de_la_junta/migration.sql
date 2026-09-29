-- Los avisos de la junta: lo que un cargo apunta a mano en el Inicio del CMS
-- para otro cargo o para toda la junta. Solo crea la tabla.
-- CreateTable
CREATE TABLE `AvisoJunta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `texto` VARCHAR(160) NOT NULL,
    `para` ENUM('USER', 'ADMIN', 'TESORERIA', 'ALBACERIA', 'HERMANO_MAYOR', 'REDES', 'SECRETARIA') NULL,
    `hasta` DATE NULL,
    `urgente` BOOLEAN NOT NULL DEFAULT false,
    `creadoPorId` INTEGER NULL,
    `creadorRol` ENUM('USER', 'ADMIN', 'TESORERIA', 'ALBACERIA', 'HERMANO_MAYOR', 'REDES', 'SECRETARIA') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `hechoAt` DATETIME(3) NULL,
    `hechoPorId` INTEGER NULL,

    INDEX `AvisoJunta_hechoAt_idx`(`hechoAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

