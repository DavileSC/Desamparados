-- Boletín y avisos masivos por correo.
--
-- · Comunicado: el boletín (solo a los suscritos) o el aviso (a los activos
--   del segmento elegido), con su cuerpo saneado y los filtros del segmento.
-- · ComunicadoEnvio: cada destinatario. Se apuntan todos al pulsar «Enviar» y
--   el servidor los manda poco a poco (el cupo diario de la cuenta de correo);
--   si se reinicia a medias, sigue por donde iba y a nadie le llega dos veces.


-- CreateTable
CREATE TABLE `Comunicado` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` ENUM('BOLETIN', 'AVISO') NOT NULL,
    `asunto` VARCHAR(150) NOT NULL,
    `cuerpo` LONGTEXT NOT NULL,
    `segmento` JSON NOT NULL,
    `estado` ENUM('BORRADOR', 'ENVIANDO', 'ENVIADO') NOT NULL DEFAULT 'BORRADOR',
    `enviadoEl` DATETIME(3) NULL,
    `autorId` INTEGER NULL,
    `autorNombre` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Comunicado_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ComunicadoEnvio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `comunicadoId` INTEGER NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NULL,
    `sexo` ENUM('HOMBRE', 'MUJER') NULL,
    `estado` ENUM('PENDIENTE', 'ENVIADO', 'FALLIDO') NOT NULL DEFAULT 'PENDIENTE',
    `enviadoEl` DATETIME(3) NULL,

    INDEX `ComunicadoEnvio_comunicadoId_estado_idx`(`comunicadoId`, `estado`),
    UNIQUE INDEX `ComunicadoEnvio_comunicadoId_email_key`(`comunicadoId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ComunicadoEnvio` ADD CONSTRAINT `ComunicadoEnvio_comunicadoId_fkey` FOREIGN KEY (`comunicadoId`) REFERENCES `Comunicado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

