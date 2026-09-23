-- Por qué sale alguien del censo: por su voluntad, por impago, por
-- fallecimiento u otro motivo. Las bajas de antes quedan sin motivo (NULL).

-- AlterTable
ALTER TABLE `Hermano` ADD COLUMN `motivoBaja` ENUM('VOLUNTARIA', 'IMPAGO', 'FALLECIMIENTO', 'OTRO') NULL;
