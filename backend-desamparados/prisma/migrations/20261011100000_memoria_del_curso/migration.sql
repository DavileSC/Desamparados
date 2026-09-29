-- Los textos a mano de la Memoria del curso (presentación, epílogo, nota de
-- patrimonio y fecha del cabildo). Solo crea la tabla.
-- CreateTable
CREATE TABLE `MemoriaCurso` (
    `curso` INTEGER NOT NULL,
    `presentacion` TEXT NULL,
    `firmaPresentacion` VARCHAR(120) NULL,
    `lugarFecha` VARCHAR(120) NULL,
    `epilogo` TEXT NULL,
    `firmaEpilogo` VARCHAR(120) NULL,
    `notaPatrimonio` TEXT NULL,
    `fechaCabildo` VARCHAR(120) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`curso`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
