-- Avisos al móvil para los hermanos y cola de correos con tope diario (traspaso-2026-10-14 §5).
-- AlterTable
ALTER TABLE `ComunicadoEnvio` ADD COLUMN `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `porMovil` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `userId` INTEGER NULL,
    MODIFY `estado` ENUM('PENDIENTE', 'ENVIADO', 'FALLIDO', 'MOVIL') NOT NULL DEFAULT 'PENDIENTE';

-- CreateTable
CREATE TABLE `MovilDeAvisos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `nombre` VARCHAR(60) NOT NULL,
    `endpoint` TEXT NOT NULL,
    `endpointHash` CHAR(64) NOT NULL,
    `p256dh` VARCHAR(200) NOT NULL,
    `auth` VARCHAR(100) NOT NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `usadoEn` DATETIME(3) NULL,

    UNIQUE INDEX `MovilDeAvisos_endpointHash_key`(`endpointHash`),
    INDEX `MovilDeAvisos_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CorreoEnCola` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lote` VARCHAR(60) NOT NULL,
    `titulo` VARCHAR(150) NOT NULL,
    `userId` INTEGER NULL,
    `porMovil` BOOLEAN NOT NULL DEFAULT false,
    `para` VARCHAR(191) NOT NULL,
    `asunto` VARCHAR(200) NOT NULL,
    `html` LONGTEXT NOT NULL,
    `uso` VARCHAR(60) NOT NULL,
    `aviso` JSON NULL,
    `estado` ENUM('PENDIENTE', 'ENVIADO', 'FALLIDO', 'MOVIL') NOT NULL DEFAULT 'PENDIENTE',
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `enviadoEl` DATETIME(3) NULL,

    INDEX `CorreoEnCola_estado_porMovil_idx`(`estado`, `porMovil`),
    INDEX `CorreoEnCola_lote_idx`(`lote`),
    INDEX `CorreoEnCola_estado_enviadoEl_idx`(`estado`, `enviadoEl`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ComunicadoEnvio_userId_idx` ON `ComunicadoEnvio`(`userId`);

-- CreateIndex
CREATE INDEX `ComunicadoEnvio_estado_enviadoEl_idx` ON `ComunicadoEnvio`(`estado`, `enviadoEl`);

-- AddForeignKey
ALTER TABLE `MovilDeAvisos` ADD CONSTRAINT `MovilDeAvisos_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

