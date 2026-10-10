-- DS11: el sufragio enlaza su acto de la Agenda con clave ajena. Al borrar el
-- acto, el sufragio se queda sin enlace en vez de apuntar a un acto que no
-- existe. Antes de crear la clave, se sueltan los que ya apuntaban a uno borrado.
UPDATE `Sufragio` s LEFT JOIN `Evento` e ON e.`id` = s.`eventoId`
SET s.`eventoId` = NULL
WHERE s.`eventoId` IS NOT NULL AND e.`id` IS NULL;

ALTER TABLE `Sufragio` ADD CONSTRAINT `Sufragio_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- DS13: la asistencia a un cabildo es parte de su acta: borrar al hermano ya no
-- se la lleva en cascada (Restrict). Hoy solo se borran fichas pendientes, que
-- no tienen asistencia; es por defensa.
ALTER TABLE `CabildoAsistencia` DROP FOREIGN KEY `CabildoAsistencia_hermanoId_fkey`;
ALTER TABLE `CabildoAsistencia` ADD CONSTRAINT `CabildoAsistencia_hermanoId_fkey` FOREIGN KEY (`hermanoId`) REFERENCES `Hermano`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
