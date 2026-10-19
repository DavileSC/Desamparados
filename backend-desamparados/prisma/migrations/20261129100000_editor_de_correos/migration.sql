-- El editor de correos por piezas (CMS → Emails): cada plantilla guarda sus
-- piezas en JSON (`contenido`) y el texto que enseña la bandeja junto al
-- asunto (`resumen`). Las guardadas antes se quedan con `contenido` a NULL y
-- se siguen leyendo de `cuerpo`: pasan a piezas al volver a guardarse, así que
-- no hace falta convertir nada aquí.
--
-- Y el historial de cada plantilla, para volver a una versión anterior.
-- (El nombre de la tabla va con su mayúscula: en Linux MariaDB distingue.)

-- AlterTable
ALTER TABLE `PlantillaCorreo` ADD COLUMN `contenido` JSON NULL,
    ADD COLUMN `resumen` VARCHAR(200) NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE `VersionPlantillaCorreo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plantillaId` INTEGER NOT NULL,
    `datos` JSON NOT NULL,
    `autorNombre` VARCHAR(120) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VersionPlantillaCorreo_plantillaId_createdAt_idx`(`plantillaId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VersionPlantillaCorreo` ADD CONSTRAINT `VersionPlantillaCorreo_plantillaId_fkey` FOREIGN KEY (`plantillaId`) REFERENCES `PlantillaCorreo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
