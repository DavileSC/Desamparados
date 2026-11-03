-- La cuenta de Instagram donde el CMS publica las noticias, y en cada noticia
-- lo que devolvió Instagram al publicarla. `Noticia` corregido a mano: el diff
-- sale en minúsculas desde la MariaDB de Windows y en Linux sería otra tabla.

-- AlterTable
ALTER TABLE `Noticia` ADD COLUMN `instagramEl` DATETIME(3) NULL,
    ADD COLUMN `instagramEnlace` VARCHAR(300) NULL,
    ADD COLUMN `instagramId` VARCHAR(40) NULL;

-- CreateTable
CREATE TABLE `CuentaInstagram` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `cuentaId` VARCHAR(40) NOT NULL,
    `usuario` VARCHAR(60) NOT NULL,
    `token` TEXT NOT NULL,
    `caducaEl` DATETIME(3) NOT NULL,
    `renovadoEl` DATETIME(3) NOT NULL,
    `conectadoEl` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `conectadoPor` VARCHAR(120) NULL,
    `errorAlRenovar` VARCHAR(500) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
