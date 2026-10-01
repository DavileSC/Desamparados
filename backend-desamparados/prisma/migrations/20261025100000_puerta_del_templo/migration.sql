-- La puerta del templo: cuándo entró cada hermano con su papeleta y quién lo
-- apuntó. Va en la propia papeleta porque hay una por hermano, salida y año.
-- El nombre de la tabla, con sus mayúsculas: en el servidor Linux las distinguen.
ALTER TABLE `PapeletaSitio` ADD COLUMN `entradaEl` DATETIME(3) NULL,
    ADD COLUMN `entradaPor` VARCHAR(120) NULL;
