-- El alta, completa: lo que pide el formulario de «Hazte hermano» y no tenía
-- dónde guardarse. El boletín, la comunidad autónoma, dónde se bautizó, quién
-- es el titular de la cuenta y los dos documentos que se adjuntan (foto y
-- certificado de bautismo, en storage/private).

-- AlterTable
ALTER TABLE `Hermano`
    ADD COLUMN `comunidadAutonoma` VARCHAR(191) NULL,
    ADD COLUMN `boletin` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `lugarBautismo` VARCHAR(191) NULL,
    ADD COLUMN `titularidadCuenta` ENUM('PROPIA', 'FAMILIAR_HERMANO', 'OTRA_PERSONA') NULL,
    ADD COLUMN `foto` VARCHAR(191) NULL,
    ADD COLUMN `certificadoBautismo` VARCHAR(191) NULL;
