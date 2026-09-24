-- Los cultos solemnes salen en la Agenda pública como un cartel: si lo son,
-- su dedicatoria y la foto del cartel (sin ella, la web pone una por tipo).

-- AlterTable
ALTER TABLE `Evento` ADD COLUMN `cartel` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `dedicatoria` VARCHAR(191) NULL,
    ADD COLUMN `fotoCartel` VARCHAR(191) NULL;
