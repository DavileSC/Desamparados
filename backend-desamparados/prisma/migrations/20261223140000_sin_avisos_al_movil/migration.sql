-- Fuera los avisos al móvil (Web Push): todo va por correo. Volverán con la
-- app, como notificaciones suyas. La página Avisos del área se queda solo
-- para la papeleta pendiente (sin recoger, el recordatorio de la cita).

-- Lo que llegó al móvil sí se envió: cuenta como enviado antes de quitar el valor.
UPDATE `ComunicadoEnvio` SET `estado` = 'ENVIADO' WHERE `estado` = 'MOVIL';
UPDATE `CorreoEnCola` SET `estado` = 'ENVIADO' WHERE `estado` = 'MOVIL';

-- El justificante de un pago ya no se guarda en Avisos: está en el correo y en Recibos.
DELETE FROM `AvisoPersonal` WHERE `uso` = 'justificante_pago';

-- El módulo ya no existe.
DELETE FROM `Modulo` WHERE `clave` = 'avisos-a-los-hermanos';

-- DropForeignKey
ALTER TABLE `MovilDeAvisos` DROP FOREIGN KEY `MovilDeAvisos_userId_fkey`;

-- DropIndex
DROP INDEX `CorreoEnCola_estado_porMovil_idx` ON `CorreoEnCola`;

-- AlterTable
ALTER TABLE `ComunicadoEnvio` DROP COLUMN `porMovil`,
    MODIFY `estado` ENUM('PENDIENTE', 'ENVIADO', 'FALLIDO', 'REBOTADO') NOT NULL DEFAULT 'PENDIENTE';

-- AlterTable
ALTER TABLE `CorreoEnCola` DROP COLUMN `aviso`,
    DROP COLUMN `porMovil`,
    MODIFY `estado` ENUM('PENDIENTE', 'ENVIADO', 'FALLIDO', 'REBOTADO') NOT NULL DEFAULT 'PENDIENTE';

-- DropTable
DROP TABLE `MovilDeAvisos`;

-- CreateIndex
CREATE INDEX `CorreoEnCola_estado_idx` ON `CorreoEnCola`(`estado`);
