-- Quitar una pieza ya no se lleva sus apadrinamientos: con un cobro en el
-- banco o ya pagado, se perdía a quién devolver y su NIF del Modelo 182.

-- DropForeignKey
ALTER TABLE `Apadrinamiento` DROP FOREIGN KEY `Apadrinamiento_piezaId_fkey`;

-- AddForeignKey
ALTER TABLE `Apadrinamiento` ADD CONSTRAINT `Apadrinamiento_piezaId_fkey` FOREIGN KEY (`piezaId`) REFERENCES `PiezaApadrinable`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
