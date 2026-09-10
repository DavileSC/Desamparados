-- Fotos que rotan en la cabecera de la portada. El CMS sustituye la lista
-- entera y el índice por `orden` es el que usa la web pública al leerlas.


-- CreateTable
CREATE TABLE `ImagenPortada` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `url` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `orden` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ImagenPortada_orden_idx`(`orden`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

