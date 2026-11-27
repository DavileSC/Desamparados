-- La Sagrada Titular pasa a ser una sola página, /sagrada-titular, del núcleo
-- (27-11-2026): arriba lo que tenía Desamparados (la Virgen) y debajo, en su
-- sección (#ajuar), lo que tenía Ajuar. /desamparados y /ajuar desaparecen sin
-- redirección (lo pidió así el usuario). La ruta y el menú están en el código;
-- aquí, el contenido guardado.
--
-- La página nueva se hace con los bloques de las dos tal como estén, para no
-- perder lo editado en el CMS (la galería y el carrusel con fotos del Grupo).
-- Sin Ajuar (otra instalación, o ya movida a mano) no se toca nada y la página
-- nace de la semilla al arrancar. Sin Desamparados, que es de las páginas
-- propias, se hace solo con el Ajuar.
--
-- Todo con funciones JSON y una guarda: si el resultado no tiene los bloques
-- esperados, no se escribe nada (notas, §9).

SET @virgen = (SELECT `datos` FROM `ContenidoPagina` WHERE `slug` = 'desamparados');
SET @ajuar = (SELECT `datos` FROM `ContenidoPagina` WHERE `slug` = 'ajuar');
SET @nVirgen = COALESCE(JSON_LENGTH(@virgen, '$.bloques'), 0);
SET @nAjuar = COALESCE(JSON_LENGTH(@ajuar, '$.bloques'), 0);

-- El primer bloque del Ajuar abre su sección: lleva el ancla y, si no tenía
-- título, «Ajuar». JSON_SET no crea `presentacion` si falta: se rehace entera
-- mezclando la que tuviera.
SET @ajuar = JSON_SET(@ajuar,
  '$.bloques[0].titulo', IF(COALESCE(JSON_VALUE(@ajuar, '$.bloques[0].titulo'), '') = '', 'Ajuar', JSON_VALUE(@ajuar, '$.bloques[0].titulo')),
  '$.bloques[0].presentacion', JSON_MERGE_PATCH(COALESCE(JSON_EXTRACT(@ajuar, '$.bloques[0].presentacion'), JSON_OBJECT()), JSON_OBJECT('ancla', 'ajuar')));

-- La cabecera es la de la Virgen (o la del Ajuar, si no hay) con el nombre del menú.
SET @nueva = JSON_OBJECT(
  'cabecera', JSON_SET(COALESCE(JSON_EXTRACT(@virgen, '$.cabecera'), JSON_EXTRACT(@ajuar, '$.cabecera')),
    '$.titulo', 'Sagrada titular'),
  'bloques', JSON_MERGE_PRESERVE(COALESCE(JSON_EXTRACT(@virgen, '$.bloques'), JSON_ARRAY()), JSON_EXTRACT(@ajuar, '$.bloques')));

SET @valida = @nAjuar > 0
  AND JSON_VALID(@nueva)
  AND JSON_LENGTH(@nueva, '$.bloques') = @nVirgen + @nAjuar
  AND JSON_VALUE(@nueva, '$.cabecera.titulo') = 'Sagrada titular';

-- Si la siembra ya creó la página (el servidor arrancó antes que la migración)
-- y nadie la ha guardado desde el CMS (sin historial), se cambia por la de los
-- bloques de verdad; una ya editada se queda.
DELETE FROM `ContenidoPagina` WHERE `slug` = 'sagrada-titular' AND @valida
  AND NOT EXISTS (SELECT 1 FROM `VersionContenido` WHERE `slug` = 'sagrada-titular');

INSERT INTO `ContenidoPagina` (`slug`, `datos`, `updatedAt`)
SELECT 'sagrada-titular', @nueva, NOW(3)
WHERE @valida AND NOT EXISTS (SELECT 1 FROM `ContenidoPagina` WHERE `slug` = 'sagrada-titular');

SET @hecho = @valida AND EXISTS (SELECT 1 FROM `ContenidoPagina` WHERE `slug` = 'sagrada-titular');

-- Las dos viejas y su historial: sin página en el catálogo no los lee nadie.
-- Solo si la nueva existe ya, para no quedarse sin ninguna.
DELETE FROM `VersionContenido` WHERE `slug` IN ('desamparados', 'ajuar') AND @hecho;
DELETE FROM `ContenidoPagina` WHERE `slug` IN ('desamparados', 'ajuar') AND @hecho;

-- Los enlaces guardados a las dos llevan a la nueva; los del Ajuar, a su
-- sección. Sin esto, la página que los tenga no se podría volver a guardar (el
-- servidor rechaza un destino que no existe). Con la comilla de apertura
-- delante, como en sin_direcciones_antiguas: vale en un "enlace" y en un href
-- dentro de un HTML, y conserva el ancla. "/ajuar#x" pasa a "#x", porque las
-- anclas de sus bloques siguen en la página nueva.
UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(REPLACE(`datos`,
  '"/ajuar"', '"/sagrada-titular#ajuar"'), '"/ajuar#', '"/sagrada-titular#'), '"/desamparados', '"/sagrada-titular')
WHERE `datos` REGEXP '"/(ajuar|desamparados)["#]';

UPDATE `VersionContenido` SET `datos` = REPLACE(REPLACE(REPLACE(`datos`,
  '"/ajuar"', '"/sagrada-titular#ajuar"'), '"/ajuar#', '"/sagrada-titular#'), '"/desamparados', '"/sagrada-titular')
WHERE `datos` REGEXP '"/(ajuar|desamparados)["#]';

UPDATE `SeccionGuardada` SET `bloques` = REPLACE(REPLACE(REPLACE(`bloques`,
  '"/ajuar"', '"/sagrada-titular#ajuar"'), '"/ajuar#', '"/sagrada-titular#'), '"/desamparados', '"/sagrada-titular')
WHERE `bloques` REGEXP '"/(ajuar|desamparados)["#]';

UPDATE `Noticia` SET `contenido` = REPLACE(REPLACE(REPLACE(`contenido`,
  '"/ajuar"', '"/sagrada-titular#ajuar"'), '"/ajuar#', '"/sagrada-titular#'), '"/desamparados', '"/sagrada-titular')
WHERE `contenido` REGEXP '"/(ajuar|desamparados)["#]';

-- En el menú, el nombre que se le puso en el CMS al título que desplegaba
-- (clave «seccion:/sagrada-titular») pasa a la página, que ahora es un enlace;
-- los de Desamparados y Ajuar ya no tienen página.
UPDATE `Configuracion` SET `value` = JSON_REMOVE(
  IF(JSON_EXISTS(`value`, '$."seccion:/sagrada-titular"') AND NOT JSON_EXISTS(`value`, '$."/sagrada-titular"'),
    JSON_SET(`value`, '$."/sagrada-titular"', JSON_EXTRACT(`value`, '$."seccion:/sagrada-titular"')),
    `value`),
  '$."seccion:/sagrada-titular"', '$."/desamparados"', '$."/ajuar"')
WHERE `key` = 'nombres_en_menu' AND JSON_VALID(`value`)
  AND `value` REGEXP '"(seccion:/sagrada-titular|/desamparados|/ajuar)"';
