-- Primer acceso de los hermanos del censo importado: la cuenta sabe si tiene
-- pendiente revisar su ficha (y las de quien cuelga de ella), cuándo se le
-- mandó la invitación y cuándo la confirmó. Las cuentas que ya existen no lo
-- tienen pendiente: solo lo marca el importador a partir de ahora.
ALTER TABLE `User` ADD COLUMN `fichaConfirmadaEn` DATETIME(3) NULL,
    ADD COLUMN `invitadoEn` DATETIME(3) NULL,
    ADD COLUMN `primerAccesoPendiente` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `User_primerAccesoPendiente_idx` ON `User`(`primerAccesoPendiente`);
