-- La contabilidad por partida doble: cada categoría del libro de caja tiene
-- su cuenta del plan de las entidades sin fines lucrativos. Sin ella (null),
-- se usa la que se propone por el nombre de la categoría.


-- AlterTable
ALTER TABLE `CategoriaTransaccion` ADD COLUMN `cuentaContable` VARCHAR(10) NULL;

