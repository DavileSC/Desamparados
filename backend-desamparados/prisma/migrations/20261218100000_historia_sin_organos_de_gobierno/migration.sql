-- Órganos de Gobierno (/historia/organos-de-gobierno) se quita entera, con su
-- contenido, el 27-11-2026: ni redirección ni sección en otra página (lo pidió
-- así el usuario). La ruta y el menú están en el código; aquí, lo guardado.

-- La página y su historial: sin página en el catálogo no los lee nadie.
DELETE FROM `VersionContenido` WHERE `slug` = 'organos-de-gobierno';
DELETE FROM `ContenidoPagina` WHERE `slug` = 'organos-de-gobierno';

-- La llamada que cerraba Historia («Quién gobierna hoy…») solo llevaba allí:
-- se quita el bloque entero, en Historia o en cualquier página que tenga una
-- igual. Se busca por su enlace y solo se quita si es una llamada, para no
-- llevarse otro bloque si el CMS lo cambió.
UPDATE `ContenidoPagina` SET `datos` = JSON_REMOVE(`datos`,
  REGEXP_REPLACE(JSON_UNQUOTE(JSON_SEARCH(`datos`, 'one', '/historia/organos-de-gobierno', NULL, '$.bloques[*].enlace')), '\\.enlace$', ''))
WHERE JSON_SEARCH(`datos`, 'one', '/historia/organos-de-gobierno', NULL, '$.bloques[*].enlace') IS NOT NULL
  AND JSON_VALUE(`datos`, CONCAT(REGEXP_REPLACE(JSON_UNQUOTE(JSON_SEARCH(`datos`, 'one', '/historia/organos-de-gobierno', NULL, '$.bloques[*].enlace')), '\\.enlace$', ''), '.tipo')) = 'llamada';

-- Cualquier otro enlace guardado (una tarjeta, un href dentro de un texto)
-- lleva a Historia: sin esto, la página que lo tenga no se podría volver a
-- guardar (el servidor rechaza un destino que no existe), y un enlace dentro
-- de un párrafo no se puede quitar sin estropear la frase. Se busca el valor
-- con la comilla de cierre, como en boletines_a_newsletter.
UPDATE `ContenidoPagina` SET `datos` = REPLACE(`datos`, '/historia/organos-de-gobierno"', '/historia"')
WHERE `datos` LIKE '%/historia/organos-de-gobierno"%';

UPDATE `SeccionGuardada` SET `bloques` = REPLACE(`bloques`, '/historia/organos-de-gobierno"', '/historia"')
WHERE `bloques` LIKE '%/historia/organos-de-gobierno"%';

UPDATE `Noticia` SET `contenido` = REPLACE(`contenido`, '/historia/organos-de-gobierno"', '/historia"')
WHERE `contenido` LIKE '%/historia/organos-de-gobierno"%';

-- Un nombre propio para ella en el menú, puesto en el CMS, ya no tiene página.
UPDATE `Configuracion` SET `value` = JSON_REMOVE(`value`, '$."/historia/organos-de-gobierno"')
WHERE `key` = 'nombres_en_menu' AND JSON_VALID(`value`)
  AND `value` LIKE '%/historia/organos-de-gobierno"%';
