-- El Rosario vespertino pasa a /cultos/rosario, debajo de Cultos (26-11-2026).
-- La ruta y el menú están en el código; aquí, que la fila del Rosario del
-- programa de Cultos lleve a su página, si aún no lleva botón.
--
-- La fila se busca por su título y se escribe por su ruta dentro del JSON: si
-- alguien la renombró o ya le puso botón, no se toca.
SET @fila = REGEXP_REPLACE(JSON_UNQUOTE(JSON_SEARCH(
  (SELECT `datos` FROM `ContenidoPagina` WHERE `slug` = 'cultos'),
  'one', 'Rosario vespertino', NULL, '$.bloques[*].filas[*].titulo')), '\.titulo$', '');

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  CONCAT(@fila, '.boton'), 'El Rosario vespertino',
  CONCAT(@fila, '.enlace'), '/cultos/rosario')
WHERE `slug` = 'cultos' AND @fila IS NOT NULL
  AND COALESCE(JSON_VALUE(`datos`, CONCAT(@fila, '.boton')), '') = '';
