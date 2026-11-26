-- Trono y Enseres dejan de ser páginas y pasan a ser secciones de una nueva,
-- Patrimonio (/sabado-de-pasion/patrimonio), con una tercera, el Cortejo
-- (26-11-2026). Sus direcciones desaparecen sin redirección. La ruta y el menú
-- están en el código; aquí, el contenido guardado.
--
-- La página nueva se hace con los bloques de las dos tal como estén, para no
-- perder lo editado en el CMS (los carruseles y las fotos del Grupo). Sin las
-- dos filas (otra instalación, o ya movidas a mano) no se toca nada y Patrimonio
-- nace de la semilla al arrancar, como cualquier página que falte.
--
-- Todo con funciones JSON y una guarda: si el resultado no tiene los bloques
-- esperados, no se escribe nada (notas, §9; con la fusión de Rosario y Cultos
-- una ruta mal calculada dejó `bloques` a NULL y se perdieron fotos).

SET @trono = (SELECT `datos` FROM `ContenidoPagina` WHERE `slug` = 'trono');
SET @enseres = (SELECT `datos` FROM `ContenidoPagina` WHERE `slug` = 'enseres');
SET @nTrono = JSON_LENGTH(@trono, '$.bloques');
SET @nEnseres = JSON_LENGTH(@enseres, '$.bloques');
SET @hay = @nTrono > 0 AND @nEnseres > 0;

-- El primer bloque de cada una abre su sección: lleva el ancla y, si no tenía
-- título, el de la sección. JSON_SET no crea `presentacion` si falta, así que
-- se rehace entera mezclando la que tuviera.
SET @trono = JSON_SET(@trono,
  '$.bloques[0].titulo', IF(COALESCE(JSON_VALUE(@trono, '$.bloques[0].titulo'), '') = '', 'El trono', JSON_VALUE(@trono, '$.bloques[0].titulo')),
  '$.bloques[0].presentacion', JSON_MERGE_PATCH(COALESCE(JSON_EXTRACT(@trono, '$.bloques[0].presentacion'), JSON_OBJECT()), JSON_OBJECT('ancla', 'trono')));
SET @enseres = JSON_SET(@enseres,
  '$.bloques[0].titulo', IF(COALESCE(JSON_VALUE(@enseres, '$.bloques[0].titulo'), '') = '', 'Enseres', JSON_VALUE(@enseres, '$.bloques[0].titulo')),
  '$.bloques[0].presentacion', JSON_MERGE_PATCH(COALESCE(JSON_EXTRACT(@enseres, '$.bloques[0].presentacion'), JSON_OBJECT()), JSON_OBJECT('ancla', 'enseres')));

-- El Cortejo, con texto PROVISIONAL (inventado; el mismo que la semilla).
SET @cortejo = JSON_ARRAY(JSON_OBJECT(
  'tipo', 'texto', 'titulo', 'El cortejo',
  'html', '<p>Abre el cortejo la cruz de guía, escoltada por dos faroles, y tras ella los banderines del primer tramo. Detrás van los nazarenos con su cirio, en tramos, cada uno con su insignia y su mayordomo, que cuida el orden y el paso.</p><p>Antes del trono, la presidencia: la junta de gobierno con sus varas y el estandarte del Grupo Parroquial. Luego la Virgen, sobre los hombros de sus hombres de trono, y cerrando la marcha la banda que la acompaña.</p><p>Los hermanos que quieran salir se apuntan en el reparto de puestos, que se abre unas semanas antes del Sábado de Pasión.</p>',
  'presentacion', JSON_OBJECT('ancla', 'cortejo')));

-- La cabecera es la del trono con otro título: su foto es la que mejor abre.
SET @nueva = JSON_OBJECT(
  'cabecera', JSON_SET(JSON_EXTRACT(@trono, '$.cabecera'),
    '$.titulo', 'Patrimonio',
    '$.subtitulo', 'El trono, los enseres y el cortejo del Sábado de Pasión.'),
  'bloques', JSON_MERGE_PRESERVE(JSON_EXTRACT(@trono, '$.bloques'), JSON_EXTRACT(@enseres, '$.bloques'), @cortejo));

SET @valida = @hay
  AND JSON_VALID(@nueva)
  AND JSON_LENGTH(@nueva, '$.bloques') = @nTrono + @nEnseres + 1
  AND JSON_VALUE(@nueva, '$.cabecera.titulo') = 'Patrimonio';

-- Si la siembra ya creó Patrimonio (el servidor arrancó antes que la migración)
-- y nadie la ha guardado desde el CMS (sin historial), se cambia por la de los
-- bloques de verdad; una ya editada se queda.
DELETE FROM `ContenidoPagina` WHERE `slug` = 'patrimonio' AND @valida
  AND NOT EXISTS (SELECT 1 FROM `VersionContenido` WHERE `slug` = 'patrimonio');

INSERT INTO `ContenidoPagina` (`slug`, `datos`, `updatedAt`)
SELECT 'patrimonio', @nueva, NOW(3)
WHERE @valida AND NOT EXISTS (SELECT 1 FROM `ContenidoPagina` WHERE `slug` = 'patrimonio');

SET @hecho = @valida AND EXISTS (SELECT 1 FROM `ContenidoPagina` WHERE `slug` = 'patrimonio');

-- Trono y Enseres y su historial: sin página en el catálogo no los lee nadie.
-- Solo si Patrimonio existe ya, para no quedarse sin ninguna de las tres.
DELETE FROM `VersionContenido` WHERE `slug` IN ('trono', 'enseres') AND @hecho;
DELETE FROM `ContenidoPagina` WHERE `slug` IN ('trono', 'enseres') AND @hecho;

-- En Sábado de Pasión, la tarjeta del trono pasa a ser la de Patrimonio y la de
-- los enseres sobra. Se buscan por su enlace; si el CMS ya las quitó, nada.
SET @sabado = (SELECT `datos` FROM `ContenidoPagina` WHERE `slug` = 'sabado-de-pasion');
SET @tarjetaTrono = REGEXP_REPLACE(JSON_UNQUOTE(JSON_SEARCH(@sabado, 'one', '/sabado-de-pasion/trono', NULL, '$.bloques[*].tarjetas[*].enlace')), '\\.enlace$', '');
UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  CONCAT(@tarjetaTrono, '.titulo'), 'Patrimonio',
  CONCAT(@tarjetaTrono, '.descripcion'), 'El trono, los enseres y el cortejo del Grupo Parroquial, cada uno en su sección.',
  CONCAT(@tarjetaTrono, '.enlace'), '/sabado-de-pasion/patrimonio')
WHERE `slug` = 'sabado-de-pasion' AND @tarjetaTrono IS NOT NULL;

SET @tarjetaEnseres = REGEXP_REPLACE(JSON_UNQUOTE(JSON_SEARCH(
  (SELECT `datos` FROM `ContenidoPagina` WHERE `slug` = 'sabado-de-pasion'),
  'one', '/sabado-de-pasion/enseres', NULL, '$.bloques[*].tarjetas[*].enlace')), '\\.enlace$', '');
UPDATE `ContenidoPagina` SET `datos` = JSON_REMOVE(`datos`, @tarjetaEnseres)
WHERE `slug` = 'sabado-de-pasion' AND @tarjetaEnseres IS NOT NULL AND @tarjetaTrono IS NOT NULL;

-- Cualquier otro enlace guardado a las dos direcciones lleva a su sección: sin
-- esto, la página que lo tenga no se podría volver a guardar (el servidor
-- rechaza un destino que no existe). Se busca el valor con la comilla de
-- cierre, como en boletines_a_newsletter: así vale igual en un "enlace" que en
-- un href dentro de un HTML. También en noticias y en secciones guardadas.
UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(`datos`,
  '/sabado-de-pasion/trono"', '/sabado-de-pasion/patrimonio#trono"'),
  '/sabado-de-pasion/enseres"', '/sabado-de-pasion/patrimonio#enseres"')
WHERE `datos` LIKE '%/sabado-de-pasion/trono"%' OR `datos` LIKE '%/sabado-de-pasion/enseres"%';

UPDATE `SeccionGuardada` SET `bloques` = REPLACE(REPLACE(`bloques`,
  '/sabado-de-pasion/trono"', '/sabado-de-pasion/patrimonio#trono"'),
  '/sabado-de-pasion/enseres"', '/sabado-de-pasion/patrimonio#enseres"')
WHERE `bloques` LIKE '%/sabado-de-pasion/trono"%' OR `bloques` LIKE '%/sabado-de-pasion/enseres"%';

UPDATE `Noticia` SET `contenido` = REPLACE(REPLACE(`contenido`,
  '/sabado-de-pasion/trono"', '/sabado-de-pasion/patrimonio#trono"'),
  '/sabado-de-pasion/enseres"', '/sabado-de-pasion/patrimonio#enseres"')
WHERE `contenido` LIKE '%/sabado-de-pasion/trono"%' OR `contenido` LIKE '%/sabado-de-pasion/enseres"%';

-- Un nombre propio para las dos en el menú, puesto en el CMS, ya no tiene página.
UPDATE `Configuracion` SET `value` = JSON_REMOVE(`value`, '$."/sabado-de-pasion/trono"', '$."/sabado-de-pasion/enseres"')
WHERE `key` = 'nombres_en_menu' AND JSON_VALID(`value`)
  AND (`value` LIKE '%/sabado-de-pasion/trono"%' OR `value` LIKE '%/sabado-de-pasion/enseres"%');
