-- La última posición del cortejo en la calle, que manda desde el móvil un
-- miembro de la Junta y enseña el mapa del recorrido. Una sola fila.
-- CreateTable
CREATE TABLE `CortejoEnDirecto` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `enMarcha` BOOLEAN NOT NULL DEFAULT false,
    `lng` DECIMAL(9, 6) NOT NULL,
    `lat` DECIMAL(9, 6) NOT NULL,
    `precision` INTEGER NULL,
    `autorId` INTEGER NULL,
    `autorNombre` VARCHAR(120) NULL,
    `actualizadoEl` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

