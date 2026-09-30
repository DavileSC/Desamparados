-- Apadrinamiento sobre una foto: campañas (una foto con sus piezas marcadas
-- en porcentaje del ancho y del alto), las piezas y quién las apadrina, sin
-- cuenta y pagando por la pasarela como en la tienda.


-- CreateTable
CREATE TABLE `CampanaApadrinamiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `titulo` VARCHAR(150) NOT NULL,
    `descripcion` TEXT NOT NULL DEFAULT '',
    `foto` VARCHAR(191) NOT NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PiezaApadrinable` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campanaId` INTEGER NOT NULL,
    `nombre` VARCHAR(120) NOT NULL,
    `precio` DECIMAL(10, 2) NOT NULL,
    `x` DECIMAL(5, 2) NOT NULL,
    `y` DECIMAL(5, 2) NOT NULL,

    INDEX `PiezaApadrinable_campanaId_idx`(`campanaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Apadrinamiento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(32) NOT NULL,
    `piezaId` INTEGER NOT NULL,
    `nombre` VARCHAR(120) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(30) NOT NULL,
    `dedicatoria` VARCHAR(200) NULL,
    `mostrarNombre` BOOLEAN NOT NULL DEFAULT false,
    `estado` ENUM('PENDIENTE_PAGO', 'PAGADO', 'ENTREGADO', 'CANCELADO') NOT NULL DEFAULT 'PENDIENTE_PAGO',
    `importe` DECIMAL(10, 2) NOT NULL,
    `metodo` ENUM('EFECTIVO', 'BIZUM', 'TRANSFERENCIA', 'TARJETA', 'DOMICILIACION') NULL,
    `pagadoEl` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Apadrinamiento_token_key`(`token`),
    INDEX `Apadrinamiento_piezaId_estado_idx`(`piezaId`, `estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PiezaApadrinable` ADD CONSTRAINT `PiezaApadrinable_campanaId_fkey` FOREIGN KEY (`campanaId`) REFERENCES `CampanaApadrinamiento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Apadrinamiento` ADD CONSTRAINT `Apadrinamiento_piezaId_fkey` FOREIGN KEY (`piezaId`) REFERENCES `PiezaApadrinable`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

