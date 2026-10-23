-- Los certificados de donativos del Modelo 182 salen por la cola de correos,
-- con su tope diario: mandados de golpe, con un censo entero de donantes se
-- pasaban del cupo del servicio de envío. La fila dice qué PDF adjuntar y el
-- PDF se hace al enviarlo.
-- (El nombre de la tabla va con su mayúscula: en Linux MariaDB distingue.)

-- AlterTable
ALTER TABLE `CorreoEnCola` ADD COLUMN `adjunto` JSON NULL;
