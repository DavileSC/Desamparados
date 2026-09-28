-- Fuera los datos de relleno, las fotos que no son del Grupo y los textos que
-- se habían quedado atrás (auditoría visual del 28-09-2026).
--
-- Cada cambio es un REPLACE del valor de partida, entre comillas: si alguien
-- ya lo ha editado en el CMS, no se encuentra y se queda como está. Se busca
-- el valor y no la pareja clave-valor porque la base guarda unas páginas con
-- espacios tras los dos puntos y otras sin ellos.

-- Contacto: los datos de ejemplo (otro correo, un teléfono inventado,
-- «Calle Ejemplo, 12» y otro horario) pasan a los de verdad, los del pie de
-- la web. El teléfono del Grupo está pendiente: mejor sin él que con uno falso.
UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`datos`,
  '"info@desamparados.es"', '"info@desamparadosmalaga.com"'),
  ', {"etiqueta": "Teléfono", "valor": "+34 951 234 567"}', ''),
  ',{"etiqueta":"Teléfono","valor":"+34 951 234 567"}', ''),
  '"Calle Ejemplo, 12, Málaga"', '"Iglesia Parroquial Santa María Goretti, C. Corregidor Paz Guzmán, 13, Málaga"'),
  '"Lunes a Viernes, 9:00 - 14:00"', '"Lunes a viernes, de 18:00 a 21:00"')
WHERE `slug` = 'contacto';

-- Sábado de Pasión: la tarjeta de Enseres hablaba de la música y las insignias;
-- la página es ahora el patrimonio, pieza a pieza.
UPDATE `ContenidoPagina` SET `datos` = REPLACE(`datos`,
  '"Acompañamiento musical e insignias que acompañan a la corporación."', '"El patrimonio del Grupo Parroquial, pieza a pieza."')
WHERE `slug` = 'sabado-de-pasion';

-- Boletines: no es una revista anual (salen dos al año).
UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(`datos`,
  '"Revista anual del Grupo Parroquial."', '"El boletín informativo del Grupo Parroquial, número a número."'),
  '"Boletines anuales"', '"Todos los boletines"')
WHERE `slug` = 'boletines';

-- Dossier de prensa: lo que hay son dossieres, no apariciones en los medios.
UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(REPLACE(`datos`,
  '"Dossier de Prensa"', '"Dossier de prensa"'),
  '"Recopilación de apariciones mediáticas."', '"La información del Grupo Parroquial para los medios y para quien la necesite."'),
  '"Apariciones mediáticas"', '"Dossieres"')
WHERE `slug` = 'dossier-prensa';

-- Fotos que no son del Grupo: una procesión de otra hermandad (procesion.jpg,
-- nazarenos de morado) y una captura de la web de otra (live.jpg). Pasan a
-- fotos del Grupo, con su descripción donde seguía la de partida.
UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(`datos`,
  '"El trono de la Sagrada Titular entre el público, en una calle del centro"', '"El trono de Nuestra Señora de los Desamparados en la calle, entre ciriales y árboles"'),
  '"Sábado de Pasión, centro histórico de Málaga"', '"Sábado de Pasión, por las calles de Málaga"')
WHERE `slug` = 'historia' AND `datos` LIKE '%/images/procesion.jpg%';

UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(`datos`,
  '"Procesión del Sábado de Pasión"', '"El trono de la Virgen en la calle, entre ciriales y árboles"'),
  '"Sede Canónica"', '"Los hombres de trono en fila bajo los varales"')
WHERE `slug` = 'sabado-de-pasion' AND `datos` LIKE '%/images/live.jpg%';

UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(`datos`,
  '"/images/procesion.jpg"', '"/images/trono-comitiva.webp"'),
  '"/images/live.jpg"', '"/images/trono-varales.webp"')
WHERE `datos` LIKE '%/images/procesion.jpg%' OR `datos` LIKE '%/images/live.jpg%';
