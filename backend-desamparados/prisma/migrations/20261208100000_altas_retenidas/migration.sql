-- Las altas por la web con un DNI ya registrado: esperan en Solicitudes a
-- que Secretaría las tramite con el DNI corregido o las descarte. Nombre de la
-- tabla escrito a mano con su mayúscula, como las demás: el diff sale en
-- minúsculas desde la MariaDB de Windows y en Linux sería otra tabla.

-- CreateTable
CREATE TABLE `AltaRetenida` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `creadaEl` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `datos` JSON NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `choques` JSON NOT NULL,

    INDEX `AltaRetenida_creadaEl_idx`(`creadaEl`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
