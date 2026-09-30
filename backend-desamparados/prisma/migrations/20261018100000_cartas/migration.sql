-- CreateTable
CREATE TABLE `Carta` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(120) NOT NULL,
    `asunto` VARCHAR(200) NOT NULL,
    `cuerpo` TEXT NOT NULL,
    `consulta` TEXT NOT NULL,
    `firmaCargo` VARCHAR(80) NOT NULL,
    `firmaNombre` VARCHAR(120) NULL,
    `autorId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

