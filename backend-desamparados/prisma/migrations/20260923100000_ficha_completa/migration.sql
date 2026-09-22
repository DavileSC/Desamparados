-- La ficha del hermano, completa: los datos que una cofradía lleva de cada
-- hermano y que hasta ahora no tenían dónde guardarse.
--
-- Apellidos: se guardan también por separado. `apellidos` sigue siendo la
-- pareja junta (con ella se busca, se ordena y se enseña) y a partir de ahora
-- la escribe el servidor desde los dos nuevos.
--
-- Bautismo y parroquia son datos religiosos (RGPD, art. 9): opcionales.

-- AlterTable
ALTER TABLE `Hermano`
    ADD COLUMN `primerApellido` VARCHAR(191) NULL,
    ADD COLUMN `segundoApellido` VARCHAR(191) NULL,
    ADD COLUMN `sexo` ENUM('HOMBRE', 'MUJER') NULL,
    ADD COLUMN `estadoCivil` ENUM('SOLTERO', 'CASADO', 'PAREJA_DE_HECHO', 'SEPARADO', 'DIVORCIADO', 'VIUDO') NULL,
    ADD COLUMN `profesion` VARCHAR(191) NULL,
    ADD COLUMN `lugarNacimiento` VARCHAR(191) NULL,
    ADD COLUMN `telefonoFijo` VARCHAR(191) NULL,
    ADD COLUMN `email2` VARCHAR(191) NULL,
    ADD COLUMN `provincia` VARCHAR(191) NULL,
    ADD COLUMN `pais` VARCHAR(191) NULL,
    ADD COLUMN `fechaBautismo` DATETIME(3) NULL,
    ADD COLUMN `parroquiaBautismo` VARCHAR(191) NULL,
    ADD COLUMN `fechaJura` DATETIME(3) NULL,
    ADD COLUMN `presentadoPor` VARCHAR(191) NULL,
    ADD COLUMN `presentadoPor2` VARCHAR(191) NULL;

-- Las fichas que ya hay: con exactamente dos palabras, una por apellido
-- («Benítez Salas»). Con más («de la Vega Ruiz») no se puede saber dónde
-- acaba el primero: van enteras al primero y Secretaría las corrige a mano.
UPDATE `Hermano`
SET `primerApellido` = CASE
        WHEN TRIM(`apellidos`) REGEXP '^[^ ]+ [^ ]+$' THEN SUBSTRING_INDEX(TRIM(`apellidos`), ' ', 1)
        ELSE NULLIF(TRIM(`apellidos`), '')
    END,
    `segundoApellido` = CASE
        WHEN TRIM(`apellidos`) REGEXP '^[^ ]+ [^ ]+$' THEN SUBSTRING_INDEX(TRIM(`apellidos`), ' ', -1)
        ELSE NULL
    END;
