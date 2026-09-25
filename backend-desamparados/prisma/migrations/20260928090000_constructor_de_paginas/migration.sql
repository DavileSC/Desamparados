-- El constructor de páginas crece: historial de versiones de cada página y
-- secciones guardadas para reutilizar bloques. Las opciones de presentación de
-- los bloques viven dentro del JSON de `ContenidoPagina` y no necesitan tabla:
-- lo que no dice nada se ve como siempre.

-- CreateTable
CREATE TABLE `VersionContenido` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(191) NOT NULL,
    `datos` JSON NOT NULL,
    `autorId` INTEGER NULL,
    `autorNombre` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VersionContenido_slug_createdAt_idx`(`slug`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SeccionGuardada` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `bloques` JSON NOT NULL,
    `autorId` INTEGER NULL,
    `autorNombre` VARCHAR(191) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
