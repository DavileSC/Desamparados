-- Pasionistas (28-11-2026): el escudo, como es de verdad. El blanco de
-- `pasionistas_escudo_blanco` era la silueta recortada y pintada de un color,
-- y salía al revés: el corazón en blanco y la cruz y el lema en hueco. Ahora
-- va el archivo oficial, el corazón en negro con la cruz, el lema, los clavos
-- y los contornos en blanco
-- (instalacion/imagenes/pasionistas/escudo-pasionista-oficial.png).
--
-- Se cambia venga de la de oro o de la blanca; si en el CMS se ha puesto otra
-- foto, no se toca.

UPDATE `ContenidoPagina`
SET `datos` = REPLACE(REPLACE(`datos`,
  '"/images/pasionistas/escudo-pasionista-blanco.png"', '"/images/pasionistas/escudo-pasionista-oficial.png"'),
  '"/images/pasionistas/escudo-pasionista.png"', '"/images/pasionistas/escudo-pasionista-oficial.png"')
WHERE `slug` = 'pasionistas' AND `datos` LIKE '%/images/pasionistas/escudo-pasionista%';
