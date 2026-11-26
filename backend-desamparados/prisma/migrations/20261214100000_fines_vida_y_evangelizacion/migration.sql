-- Nuestros fines pasan a ser Vida, Evangelización y Caridad (26-11-2026). Las
-- dos primeras son páginas propias nuevas: su fila la crea la siembra del
-- arranque desde instalacion/contenido-inicial.json, como cualquier página que
-- falte. Aquí, lo que la siembra no hace: quitar Formación, que deja el
-- catálogo, y cambiar lo ya guardado que la nombraba.

-- Formación y su historial: sin página en el catálogo, la fila no la lee nadie.
DELETE FROM `VersionContenido` WHERE `slug` = 'formacion';
DELETE FROM `ContenidoPagina` WHERE `slug` = 'formacion';

-- Los enlaces guardados a Formación (la vocalía de Órganos de Gobierno, un
-- botón o un texto del CMS) llevan a Evangelización, que la sustituye. Se busca
-- el valor entre comillas, como en boletines_a_newsletter: dentro de un HTML va
-- como href="/nuestros-fines/formacion" y también vale.
UPDATE `ContenidoPagina` SET `datos` = REPLACE(`datos`, '/nuestros-fines/formacion"', '/nuestros-fines/evangelizacion"')
WHERE `datos` LIKE '%/nuestros-fines/formacion"%';

-- Los tres anillos de Nuestros fines, solo en la página de Desamparados (con
-- «Desamparados» en el cruce) y si el tercero sigue siendo Formación: lo ya
-- cambiado en el CMS, o la página neutra de otra instalación, no se toca. El
-- bloque se busca por su tipo y se escribe con funciones JSON, no con REPLACE:
-- unas filas guardan espacio tras los dos puntos y otras no (notas, §9).
SET @anillos = REGEXP_REPLACE(JSON_UNQUOTE(JSON_SEARCH(
  (SELECT `datos` FROM `ContenidoPagina` WHERE `slug` = 'nuestros-fines'),
  'one', 'anillos', NULL, '$.bloques[*].tipo')), '\\.tipo$', '');

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`, CONCAT(@anillos, '.fines'), JSON_ARRAY(
  JSON_OBJECT('titulo', 'Vida',
    'texto', 'La misa de hermandad, las convivencias y el trabajo de cada culto: un año entero haciéndose familia.',
    'boton', 'Cómo es', 'enlace', '/nuestros-fines/vida'),
  JSON_OBJECT('titulo', 'Evangelización',
    'texto', 'Catequesis, charlas y retiros para conocer la fe y poder contarla.',
    'boton', 'Qué ofrecemos', 'enlace', '/nuestros-fines/evangelizacion'),
  JSON_OBJECT('titulo', 'Caridad',
    'texto', 'La ayuda a quien la necesita, desde la parroquia y con lo que aportan los hermanos.',
    'boton', 'Qué hacemos', 'enlace', '/nuestros-fines/caridad')))
WHERE `slug` = 'nuestros-fines' AND @anillos IS NOT NULL
  AND JSON_VALUE(`datos`, CONCAT(@anillos, '.centro')) = 'Desamparados'
  AND JSON_VALUE(`datos`, CONCAT(@anillos, '.fines[2].titulo')) = 'Formación'
  AND JSON_LENGTH(`datos`, CONCAT(@anillos, '.fines')) = 3;

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`, '$.cabecera.subtitulo',
  'Vida, evangelización y caridad: para qué existe el Grupo Parroquial.')
WHERE `slug` = 'nuestros-fines'
  AND JSON_VALUE(`datos`, '$.cabecera.subtitulo') = 'Culto, caridad y formación: para qué existe el Grupo Parroquial.';
