-- Segunda auditoría visual (29-09-2026).
--
-- Como en las migraciones de contenido anteriores, cada cambio de texto es un
-- REPLACE del valor de partida: si alguien ya lo ha editado en el CMS, no se
-- encuentra y se queda como está.

-- Trono: el vocabulario de Málaga. Hombres de trono, no costaleros, y trono,
-- no paso de palio.
UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(`datos`,
  'El trono es portado por una cuadrilla de costaleros que, con esfuerzo y devoción, hacen posible',
  'El trono lo llevan sus hombres de trono, que con esfuerzo y devoción hacen posible'),
  'para vestir de manera única el paso de palio.', 'para vestir de manera única el trono.')
WHERE `slug` = 'trono';

-- Desamparados: «sede canónica» en minúscula, en mitad de la frase.
UPDATE `ContenidoPagina` SET `datos` = REPLACE(`datos`,
  'venerada en la Sede Canónica de la corporación', 'venerada en la sede canónica de la corporación')
WHERE `slug` = 'desamparados';

-- Cultos: el besamanos, sin fecha todavía, pasa al final del año (antes del
-- culto de cada mes) en vez de quedar entre noviembre y diciembre. Se quita de
-- donde está y se pone delante de «Cada mes», solo si estaba tal cual; con y
-- sin espacios en el JSON guardado.
UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(`datos`,
  ',{"cuando":"Por anunciar","mes":0,"titulo":"Besamanos","texto":"Los devotos y hermanos pueden venerar de cerca la imagen de la Sagrada Titular.","boton":"","enlace":""}', ''),
  '{"cuando":"Cada mes"',
  '{"cuando":"Por anunciar","mes":0,"titulo":"Besamanos","texto":"Los devotos y hermanos pueden venerar de cerca la imagen de la Sagrada Titular.","boton":"","enlace":""},{"cuando":"Cada mes"')
WHERE `slug` = 'cultos'
  AND INSTR(`datos`, ',{"cuando":"Por anunciar","mes":0,"titulo":"Besamanos","texto":"Los devotos y hermanos pueden venerar de cerca la imagen de la Sagrada Titular.","boton":"","enlace":""}') > 0;

UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(`datos`,
  ', {"cuando": "Por anunciar", "mes": 0, "titulo": "Besamanos", "texto": "Los devotos y hermanos pueden venerar de cerca la imagen de la Sagrada Titular.", "boton": "", "enlace": ""}', ''),
  '{"cuando": "Cada mes"',
  '{"cuando": "Por anunciar", "mes": 0, "titulo": "Besamanos", "texto": "Los devotos y hermanos pueden venerar de cerca la imagen de la Sagrada Titular.", "boton": "", "enlace": ""}, {"cuando": "Cada mes"')
WHERE `slug` = 'cultos'
  AND INSTR(`datos`, ', {"cuando": "Por anunciar", "mes": 0, "titulo": "Besamanos", "texto": "Los devotos y hermanos pueden venerar de cerca la imagen de la Sagrada Titular.", "boton": "", "enlace": ""}') > 0;

-- Recibos: un solo nombre para la papeleta, «Papeleta de sitio», el que ya
-- llevaban casi todos. Solo donde no choque con otro recibo del mismo hermano
-- y año (la clave única no distingue mayúsculas).
UPDATE `Recibo` r
LEFT JOIN `Recibo` otro
  ON otro.hermanoId = r.hermanoId AND otro.year = r.year
  AND otro.concepto = REPLACE(r.concepto, 'Papeleta Sitio', 'Papeleta de sitio')
SET r.concepto = REPLACE(r.concepto, 'Papeleta Sitio', 'Papeleta de sitio')
WHERE r.concepto LIKE BINARY 'Papeleta Sitio%' AND otro.id IS NULL;

-- Y en los apuntes que copian el concepto del recibo.
UPDATE `Transaccion` SET `concepto` = REPLACE(`concepto`, 'Papeleta Sitio', 'Papeleta de sitio')
WHERE `concepto` LIKE BINARY '%Papeleta Sitio%';
