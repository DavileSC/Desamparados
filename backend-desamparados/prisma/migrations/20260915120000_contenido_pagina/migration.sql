-- CreateTable
CREATE TABLE `ContenidoPagina` (
    `slug` VARCHAR(191) NOT NULL,
    `datos` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`slug`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

