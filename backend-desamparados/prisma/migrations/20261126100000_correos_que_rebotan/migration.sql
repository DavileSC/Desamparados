-- Rebotes de correo (16-10-2026). Brevo avisa a la API de los correos que no
-- llegaron (buzón que no existe, dirección mal escrita, bloqueada o queja de
-- spam): la dirección se apunta aquí para que el censo la señale y la cola no
-- gaste cupo en ella, y el envío del boletín pasa de ENVIADO a REBOTADO.
-- Por dirección, no por ficha: al corregirla en la ficha, la nueva ya no está.
-- Nombres de tabla con mayúsculas: en el VPS (Linux) MariaDB las distingue.

ALTER TABLE `ComunicadoEnvio` MODIFY `estado` ENUM('PENDIENTE', 'ENVIADO', 'FALLIDO', 'MOVIL', 'REBOTADO') NOT NULL DEFAULT 'PENDIENTE';

ALTER TABLE `CorreoEnCola` MODIFY `estado` ENUM('PENDIENTE', 'ENVIADO', 'FALLIDO', 'MOVIL', 'REBOTADO') NOT NULL DEFAULT 'PENDIENTE';

CREATE TABLE `CorreoQueRebota` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `motivo` ENUM('REBOTE', 'INVALIDO', 'BLOQUEADO', 'SPAM') NOT NULL,
    `detalle` VARCHAR(250) NULL,
    `creadoEn` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizadoEn` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CorreoQueRebota_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
