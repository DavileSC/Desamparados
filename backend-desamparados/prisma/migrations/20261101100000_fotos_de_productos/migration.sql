-- Más fotos de cada producto de la tienda, además de la principal: se ven en
-- una galería al pulsar la foto. Opcional: los productos de antes siguen igual.
-- El nombre de la tabla, con su mayúscula: en el servidor Linux la distinguen.
ALTER TABLE `Producto` ADD COLUMN `fotos` JSON NULL;
