-- Las plantillas de los correos (sección Emails): varias por uso y una en uso.
-- Sin ninguna en uso, el correo sale con su texto original (shared/usos-de-correo.json).

-- CreateTable
CREATE TABLE `PlantillaCorreo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(120) NOT NULL,
    `uso` VARCHAR(40) NOT NULL,
    `asunto` VARCHAR(200) NOT NULL,
    `titulo` VARCHAR(200) NOT NULL,
    `cuerpo` TEXT NOT NULL,
    `despedida` VARCHAR(300) NOT NULL DEFAULT '',
    `enUso` BOOLEAN NOT NULL DEFAULT false,
    `autorNombre` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PlantillaCorreo_uso_enUso_idx`(`uso`, `enUso`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

