-- El Modelo 182: quien apadrina puede pedir el certificado de donación, y
-- para eso hacen falta su NIF, su nombre y sus apellidos por separado y su
-- código postal. Los donativos en línea los guardan en su JSON y no
-- necesitan columna.
-- El nombre de la tabla, con su mayúscula: en el servidor Linux la distinguen.
ALTER TABLE `Apadrinamiento` ADD COLUMN `nif` VARCHAR(9) NULL,
    ADD COLUMN `nombreFiscal` VARCHAR(120) NULL,
    ADD COLUMN `apellidosFiscales` VARCHAR(120) NULL,
    ADD COLUMN `codigoPostal` VARCHAR(5) NULL;
