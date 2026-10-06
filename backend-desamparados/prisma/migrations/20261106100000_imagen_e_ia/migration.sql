-- Permiso de cada hermano para publicar las fotos en que aparece. Las fichas
-- que ya existen quedan sin marcar: nadie lo ha autorizado todavía, y la
-- política de privacidad dice que sin permiso no se publica su cara.
ALTER TABLE `Hermano` ADD COLUMN `autorizaImagen` BOOLEAN NOT NULL DEFAULT false;

-- La ilustración del templo de la página Parroquia está generada con IA: se
-- marca para que la web lo diga debajo. MariaDB puede guardar el JSON con o
-- sin espacio tras los dos puntos, así que se prueban las dos formas. Si
-- alguien cambió la ilustración en el CMS, no se toca. También en el historial.
UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(`datos`,
  '"url": "/images/templo-goretti.webp"', '"url": "/images/templo-goretti.webp", "ia": true'),
  '"url":"/images/templo-goretti.webp"', '"url":"/images/templo-goretti.webp","ia":true')
WHERE `datos` LIKE '%/images/templo-goretti.webp%' AND `datos` NOT LIKE '%templo-goretti.webp", "ia"%' AND `datos` NOT LIKE '%templo-goretti.webp","ia"%';

UPDATE `VersionContenido` SET `datos` = REPLACE(REPLACE(`datos`,
  '"url": "/images/templo-goretti.webp"', '"url": "/images/templo-goretti.webp", "ia": true'),
  '"url":"/images/templo-goretti.webp"', '"url":"/images/templo-goretti.webp","ia":true')
WHERE `datos` LIKE '%/images/templo-goretti.webp%' AND `datos` NOT LIKE '%templo-goretti.webp", "ia"%' AND `datos` NOT LIKE '%templo-goretti.webp","ia"%';
