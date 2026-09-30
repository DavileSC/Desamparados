-- Remesas SEPA: Tesorería genera el fichero de adeudos domiciliados
-- (pain.008, SEPA CORE) para subirlo a la banca en línea.
--
-- · Remesa: cada lote, con el XML tal cual salió, para volver a descargarlo
--   con los mismos identificadores que el banco ya conoce.
-- · Recibo.remesaId: qué remesa mandó el recibo al banco; la Norma 43 lo
--   necesitará para casar las devoluciones.
-- · Hermano.fechaMandato: cuándo autorizó el adeudo. Cada adeudo lleva la
--   fecha de firma de su mandato. A quien ya domicilia se le pone la fecha de
--   alta, que es cuando dio la cuenta.

-- AlterTable
ALTER TABLE `Hermano` ADD COLUMN `fechaMandato` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Recibo` ADD COLUMN `remesaId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Remesa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mensajeId` VARCHAR(35) NOT NULL,
    `fechaCobro` DATE NOT NULL,
    `numRecibos` INTEGER NOT NULL,
    `total` DECIMAL(10, 2) NOT NULL,
    `xml` LONGTEXT NOT NULL,
    `estado` ENUM('ENVIADA', 'COBRADA') NOT NULL DEFAULT 'ENVIADA',
    `cobradaEl` DATETIME(3) NULL,
    `autorId` INTEGER NULL,
    `autorNombre` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Remesa_mensajeId_key`(`mensajeId`),
    INDEX `Remesa_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Recibo_remesaId_idx` ON `Recibo`(`remesaId`);

-- AddForeignKey
ALTER TABLE `Recibo` ADD CONSTRAINT `Recibo_remesaId_fkey` FOREIGN KEY (`remesaId`) REFERENCES `Remesa`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


-- Quien ya domicilia autorizó el adeudo al darse de alta con su cuenta.
UPDATE `Hermano` SET `fechaMandato` = `fechaAlta`
WHERE `formaPagoPref` = 'DOMICILIACION' AND `iban` IS NOT NULL AND `fechaMandato` IS NULL;
