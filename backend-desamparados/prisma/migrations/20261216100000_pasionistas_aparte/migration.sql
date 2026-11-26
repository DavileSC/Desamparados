-- Los Pasionistas salen de Parroquia a su propia página, /pasionistas, de las
-- páginas propias (26-11-2026). La ruta y el menú están en el código; aquí, el
-- contenido guardado: la página nueva se hace con los dos bloques que Parroquia
-- tenga de ellos (el texto con el signo pasionista y la cita de su fundador),
-- tal como estén, para no perder lo editado en el CMS; luego salen de Parroquia.
--
-- Sin esos bloques (otra instalación, o ya movidos a mano) Parroquia no se toca
-- y la página nace de la semilla al arrancar, como cualquiera que falte. Los bloques
-- se buscan por su contenido y se escriben con funciones JSON (notas, §9).

SET @datos = (SELECT `datos` FROM `ContenidoPagina` WHERE `slug` = 'parroquia');
SET @dibujo = REGEXP_REPLACE(JSON_UNQUOTE(JSON_SEARCH(@datos, 'one', 'signoPasionista', NULL, '$.bloques[*].dibujo')), '\\.dibujo$', '');
SET @cita = REGEXP_REPLACE(JSON_UNQUOTE(JSON_SEARCH(@datos, 'one', 'San Pablo de la Cruz', NULL, '$.bloques[*].autor')), '\\.autor$', '');
SET @hay = @dibujo IS NOT NULL AND @cita IS NOT NULL;

-- La página nueva: una plantilla con dos huecos que se llenan con los bloques.
-- Si la siembra ya la creó (el servidor arrancó antes que la migración), se
-- queda la de la siembra, que lleva el mismo texto de partida.
INSERT INTO `ContenidoPagina` (`slug`, `datos`, `updatedAt`)
SELECT 'pasionistas',
  JSON_SET(JSON_SET(
    '{"cabecera":{"titulo":"Pasionistas","subtitulo":"La comunidad que atiende la parroquia desde que se fundó, en 1972.","foto":"/images/cabeceras/cera.webp","fotoAlt":"Cirios del trono con el emblema pasionista; detrás, la Virgen desenfocada","encuadre":40},"bloques":[null,null,{"tipo":"botones","titulo":"","presentacion":{"alineacion":"centro"},"botones":[{"texto":"La parroquia","enlace":"/parroquia","estilo":"principal"},{"texto":"Cómo llegar","enlace":"/parroquia#como-llegar","estilo":"secundario"}]}]}',
    '$.bloques[0]', JSON_EXTRACT(@datos, @dibujo)),
    '$.bloques[1]', JSON_EXTRACT(@datos, @cita)),
  NOW(3)
WHERE @hay AND NOT EXISTS (SELECT 1 FROM `ContenidoPagina` WHERE `slug` = 'pasionistas');

-- Fuera de Parroquia, de uno en uno: al quitar el primero, el índice del
-- segundo puede cambiar, así que se vuelve a buscar.
UPDATE `ContenidoPagina` SET `datos` = JSON_REMOVE(`datos`, @dibujo)
WHERE `slug` = 'parroquia' AND @hay;

SET @cita = REGEXP_REPLACE(JSON_UNQUOTE(JSON_SEARCH(
  (SELECT `datos` FROM `ContenidoPagina` WHERE `slug` = 'parroquia'),
  'one', 'San Pablo de la Cruz', NULL, '$.bloques[*].autor')), '\\.autor$', '');
UPDATE `ContenidoPagina` SET `datos` = JSON_REMOVE(`datos`, @cita)
WHERE `slug` = 'parroquia' AND @hay AND @cita IS NOT NULL;

-- La cabecera, si sigue siendo la de partida; y donde nombra a los Padres
-- Pasionistas, un enlace a su página.
UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.titulo', 'Parroquia',
  '$.cabecera.subtitulo', 'Santa María Goretti, nuestra sede canónica.')
WHERE `slug` = 'parroquia' AND @hay
  AND JSON_VALUE(`datos`, '$.cabecera.titulo') = 'Parroquia · Pasionistas';

UPDATE `ContenidoPagina` SET `datos` = REPLACE(`datos`,
  '<strong>Padres Pasionistas</strong>', '<a href=\\"/pasionistas\\"><strong>Padres Pasionistas</strong></a>')
WHERE `slug` = 'parroquia' AND @hay
  AND `datos` NOT LIKE '%/pasionistas\\\\"%';

-- El nombre del menú vuelve a ser «Parroquia» (lo puso la migración
-- nombres_en_menu); uno distinto, puesto en el CMS, se queda.
UPDATE `Configuracion` SET `value` = JSON_REMOVE(`value`, '$."/parroquia"')
WHERE `key` = 'nombres_en_menu'
  AND JSON_VALID(`value`)
  AND JSON_VALUE(`value`, '$."/parroquia"') = 'Parroquia · Pasionistas';
