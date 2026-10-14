-- Aprobar la entrada al CMS desde el móvil: los móviles apuntados para recibir
-- el aviso (Web Push) y las aprobaciones pendientes, atadas al testigo del
-- primer factor. El TOTP sigue de reserva; esto es otra forma de pasarlo.

-- CreateTable
CREATE TABLE `MovilApuntado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `nombre` VARCHAR(60) NOT NULL,
    `endpoint` TEXT NOT NULL,
    `endpointHash` CHAR(64) NOT NULL,
    `p256dh` VARCHAR(200) NOT NULL,
    `auth` VARCHAR(100) NOT NULL,
    `claveHash` CHAR(64) NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `usadoEn` DATETIME(3) NULL,

    UNIQUE INDEX `MovilApuntado_endpointHash_key`(`endpointHash`),
    INDEX `MovilApuntado_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AprobacionEntrada` (
    `id` VARCHAR(32) NOT NULL,
    `userId` INTEGER NOT NULL,
    `numero` INTEGER NOT NULL,
    `opciones` VARCHAR(20) NOT NULL,
    `desde` VARCHAR(80) NOT NULL,
    `pendienteDe` CHAR(64) NOT NULL,
    `estado` ENUM('PENDIENTE', 'APROBADA', 'USADA', 'RECHAZADA', 'FALLADA', 'CADUCADA') NOT NULL DEFAULT 'PENDIENTE',
    `expiraEn` DATETIME(3) NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AprobacionEntrada_pendienteDe_key`(`pendienteDe`),
    INDEX `AprobacionEntrada_userId_estado_idx`(`userId`, `estado`),
    INDEX `AprobacionEntrada_creadoEn_idx`(`creadoEn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MovilApuntado` ADD CONSTRAINT `MovilApuntado_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AprobacionEntrada` ADD CONSTRAINT `AprobacionEntrada_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

