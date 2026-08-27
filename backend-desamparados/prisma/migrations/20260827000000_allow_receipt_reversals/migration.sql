-- A receipt can have its original income entry and one or more adjustment entries.
ALTER TABLE `Transaccion` DROP FOREIGN KEY `Transaccion_reciboId_fkey`;
DROP INDEX `Transaccion_reciboId_key` ON `Transaccion`;
ALTER TABLE `Transaccion`
  ADD INDEX `Transaccion_reciboId_idx`(`reciboId`),
  ADD CONSTRAINT `Transaccion_reciboId_fkey`
    FOREIGN KEY (`reciboId`) REFERENCES `Recibo`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
