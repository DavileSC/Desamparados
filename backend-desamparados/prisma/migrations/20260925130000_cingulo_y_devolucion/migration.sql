-- El cíngulo en la papeleta: se presta y se devuelve con el resto de la
-- ropa. Los cíngulos no van numerados: se cuentan (el total del Grupo va en
-- Configuracion, clave `cingulos_total`).
ALTER TABLE `PapeletaSitio` ADD COLUMN `cingulo` ENUM('PRESTADO', 'DEBIDO', 'PROPIO', 'NINGUNO', 'DEVUELTO') NULL;

-- Toda la ropa prestada se devuelve después de la salida, y todas las
-- túnicas se lavan: LAVADO es la prenda devuelta que está en el lavado.
-- TALLER queda para lo roto, que hay que arreglar.
ALTER TABLE `Prenda` MODIFY `estado` ENUM('DISPONIBLE', 'PRESTADA', 'LAVADO', 'TALLER', 'BAJA') NOT NULL DEFAULT 'DISPONIBLE';
