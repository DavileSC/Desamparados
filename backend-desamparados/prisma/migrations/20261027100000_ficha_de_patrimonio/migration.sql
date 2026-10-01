-- La ficha de patrimonio: descripción, autor, época, materiales, medidas,
-- conservación, más fotos y la tasación de cada enser. Todo opcional.
-- El nombre de la tabla, con su mayúscula: en el servidor Linux la distinguen.
ALTER TABLE `Enser` ADD COLUMN `autor` VARCHAR(160) NULL,
    ADD COLUMN `conservacion` TEXT NULL,
    ADD COLUMN `descripcion` TEXT NULL,
    ADD COLUMN `dimensiones` VARCHAR(120) NULL,
    ADD COLUMN `epoca` VARCHAR(80) NULL,
    ADD COLUMN `fechaTasacion` DATETIME(3) NULL,
    ADD COLUMN `fotos` JSON NULL,
    ADD COLUMN `materiales` VARCHAR(255) NULL,
    ADD COLUMN `tasadoPor` VARCHAR(160) NULL,
    ADD COLUMN `valorTasacion` DECIMAL(12, 2) NULL;
