-- AlterTable
ALTER TABLE `Hermano` ADD COLUMN `fechaMedalla` DATETIME(3) NULL,
    ADD COLUMN `tratamiento` VARCHAR(40) NULL;

-- CreateTable
CREATE TABLE `ListaGuardada` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pantalla` VARCHAR(30) NOT NULL,
    `nombre` VARCHAR(80) NOT NULL,
    `consulta` TEXT NOT NULL,
    `autorId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ListaGuardada_pantalla_nombre_key`(`pantalla`, `nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

