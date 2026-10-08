-- El cíngulo prestado de una papeleta anulada sigue a nombre del hermano
-- hasta que lo devuelva (antes se perdía al borrar la papeleta).
CREATE TABLE `CinguloSinPapeleta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `papeletaId` INTEGER NOT NULL,
    `hermanoId` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CinguloSinPapeleta_papeletaId_key`(`papeletaId`),
    INDEX `CinguloSinPapeleta_hermanoId_idx`(`hermanoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CinguloSinPapeleta` ADD CONSTRAINT `CinguloSinPapeleta_hermanoId_fkey` FOREIGN KEY (`hermanoId`) REFERENCES `Hermano`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
