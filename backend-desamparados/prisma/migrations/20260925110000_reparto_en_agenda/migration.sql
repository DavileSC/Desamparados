-- Los días de reparto salen en la Agenda pública, para que la gente sepa
-- cuándo ir a apuntarse: cada turno guarda el acto que lo anuncia. Si alguien
-- borra el acto desde la Agenda, el turno sigue y solo pierde el enlace.

-- AlterTable
ALTER TABLE `Turno` ADD COLUMN `eventoId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Turno_eventoId_key` ON `Turno`(`eventoId`);

-- AddForeignKey
ALTER TABLE `Turno` ADD CONSTRAINT `Turno_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
