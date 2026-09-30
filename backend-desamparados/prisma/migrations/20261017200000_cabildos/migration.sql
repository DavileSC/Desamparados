-- Cabildos y libro de actas.
--
-- · Cabildo: tipo, fecha, lugar y orden del día; su estado (convocado,
--   celebrado, acta aprobada); el censo con voto guardado al celebrarlo (el
--   quórum del acta no cambia con altas y bajas posteriores); el acta; y el
--   borrador de aviso con la convocatoria.
-- · CabildoAsistencia: quién asistió.
-- · CabildoVotacion: cada votación, con su mayoría y el recuento.


-- CreateTable
CREATE TABLE `Cabildo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` ENUM('ORDINARIO', 'EXTRAORDINARIO') NOT NULL,
    `fecha` DATETIME(3) NOT NULL,
    `lugar` VARCHAR(191) NOT NULL,
    `ordenDelDia` JSON NOT NULL,
    `estado` ENUM('CONVOCADO', 'CELEBRADO', 'ACTA_APROBADA') NOT NULL DEFAULT 'CONVOCADO',
    `censoConVoto` INTEGER NULL,
    `enSegunda` BOOLEAN NOT NULL DEFAULT false,
    `acta` LONGTEXT NOT NULL DEFAULT '',
    `actaAprobadaEl` DATETIME(3) NULL,
    `convocatoriaId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Cabildo_fecha_idx`(`fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CabildoAsistencia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cabildoId` INTEGER NOT NULL,
    `hermanoId` INTEGER NOT NULL,
    `registradaEl` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CabildoAsistencia_hermanoId_idx`(`hermanoId`),
    UNIQUE INDEX `CabildoAsistencia_cabildoId_hermanoId_key`(`cabildoId`, `hermanoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CabildoVotacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cabildoId` INTEGER NOT NULL,
    `asunto` VARCHAR(300) NOT NULL,
    `mayoria` ENUM('SIMPLE', 'DOS_TERCIOS') NOT NULL DEFAULT 'SIMPLE',
    `aFavor` INTEGER NOT NULL,
    `enContra` INTEGER NOT NULL,
    `abstenciones` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CabildoVotacion_cabildoId_idx`(`cabildoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Cabildo` ADD CONSTRAINT `Cabildo_convocatoriaId_fkey` FOREIGN KEY (`convocatoriaId`) REFERENCES `Comunicado`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CabildoAsistencia` ADD CONSTRAINT `CabildoAsistencia_cabildoId_fkey` FOREIGN KEY (`cabildoId`) REFERENCES `Cabildo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CabildoAsistencia` ADD CONSTRAINT `CabildoAsistencia_hermanoId_fkey` FOREIGN KEY (`hermanoId`) REFERENCES `Hermano`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CabildoVotacion` ADD CONSTRAINT `CabildoVotacion_cabildoId_fkey` FOREIGN KEY (`cabildoId`) REFERENCES `Cabildo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

