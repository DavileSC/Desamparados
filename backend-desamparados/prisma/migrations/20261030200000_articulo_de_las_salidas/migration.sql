-- El artículo de cada salida («el Sábado de Pasión», «la Procesión Magna»,
-- «los Santos Oficios»): con él se escribe «del», «de la» o «de los» en los
-- correos y las pantallas. Las de siempre son masculinas.
ALTER TABLE `Salida` ADD COLUMN `articulo` VARCHAR(3) NOT NULL DEFAULT 'el';
