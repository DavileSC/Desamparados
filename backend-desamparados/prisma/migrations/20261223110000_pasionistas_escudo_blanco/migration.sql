-- Pasionistas (28-11-2026): el escudo de arriba, en blanco en lugar de oro,
-- como el rótulo de la barra. Es la misma imagen, con otro color
-- (instalacion/imagenes/pasionistas/escudo-pasionista-blanco.png); la de oro
-- se queda en la carpeta por si se vuelve a ella.
--
-- Solo cambia la dirección de esa imagen en la página de Pasionistas: si en
-- el CMS se ha puesto otra foto, no hay nada que cambiar.

UPDATE `ContenidoPagina`
SET `datos` = REPLACE(`datos`, '"/images/pasionistas/escudo-pasionista.png"', '"/images/pasionistas/escudo-pasionista-blanco.png"')
WHERE `slug` = 'pasionistas' AND `datos` LIKE '%/images/pasionistas/escudo-pasionista.png%';
