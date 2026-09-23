-- La agenda ya no tiene actos solo para hermanos: todos son públicos.
-- Los que estaban reservados pasan a públicos (decisión expresa) y la columna
-- desaparece. El UPDATE va primero por claridad; al borrar la columna los
-- datos de visibilidad se pierden igualmente.
UPDATE `Evento` SET `visibility` = 'public' WHERE `visibility` = 'members_only';

ALTER TABLE `Evento` DROP COLUMN `visibility`;
