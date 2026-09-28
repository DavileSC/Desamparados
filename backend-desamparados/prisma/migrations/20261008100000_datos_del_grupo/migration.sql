-- Los datos del Grupo Parroquial, confirmados por él el 28-09-2026: correo,
-- teléfono y horario de Secretaría (el primer viernes de cada mes).
--
-- Como en contenido_sin_relleno, cada cambio es un REPLACE del valor de
-- partida: si alguien ya lo ha editado en el CMS, no se encuentra y se queda
-- como está.

-- Contacto: el correo de verdad, con el teléfono detrás, y el horario de
-- Secretaría. El teléfono se engancha al cierre de la línea del correo, así
-- vale con y sin espacios en el JSON guardado.
UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(REPLACE(`datos`,
  '"info@desamparadosmalaga.com"}', '"goretti.desamparados@gmail.com"}, {"etiqueta": "Teléfono", "valor": "644 90 01 67"}'),
  '"Horario de atención"', '"Horario de Secretaría"'),
  '"Lunes a viernes, de 18:00 a 21:00"', '"Primer viernes de cada mes, de 19:30 a 21:00"')
WHERE `slug` = 'contacto';

-- La página suelta del horario de Secretaría.
UPDATE `Pagina` SET `contenido` = REPLACE(`contenido`,
  '<p>La secretaría atiende de lunes a viernes, de 18:00 a 21:00, en la casa parroquial.</p>',
  '<p>La secretaría atiende el primer viernes de cada mes, de 19:30 a 21:00, en la casa parroquial (C. Corregidor Paz Guzmán, 13).</p>')
WHERE `slug` = 'horario-secretaria';
