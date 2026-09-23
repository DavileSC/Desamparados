-- La mesa de la procesión: la papeleta guarda la faraona y de dónde sale la
-- túnica (ropero, propia o ninguna), que es lo que decide si se cobra el
-- alquiler. Las papeletas de antes quedan sin origen (NULL).

-- AlterTable
ALTER TABLE `PapeletaSitio` ADD COLUMN `numFaraonaAsignada` VARCHAR(191) NULL,
    ADD COLUMN `origenTunica` ENUM('ROPERO', 'PROPIA', 'NINGUNA') NULL;

-- El número de prenda, único dentro de su tipo y no en todo el ropero:
-- capirotes y faraonas se numeran cada uno desde el 1.

-- DropIndex
DROP INDEX `Prenda_numero_key` ON `Prenda`;

-- CreateIndex
CREATE UNIQUE INDEX `Prenda_tipo_numero_key` ON `Prenda`(`tipo`, `numero`);
