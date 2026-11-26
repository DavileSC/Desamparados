-- Los boletines pasan a llamarse «Newsletter» y su página, a
-- /publicaciones/newsletter (26-11-2026). La ruta y el menú están en el
-- código; aquí, los textos guardados de la página y de la tesela de la portada.
--
-- Cada cambio es un REPLACE del valor de partida, entre comillas: lo que ya se
-- editó en el CMS no se encuentra y se queda como está. Se busca el valor y no
-- la pareja clave-valor porque unas filas guardan espacio tras los dos puntos y
-- otras no (notas del proyecto, §9).

UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(REPLACE(REPLACE(`datos`,
  '"Boletines"', '"Newsletter"'),
  '"El boletín informativo del Grupo Parroquial, número a número."', '"La newsletter del Grupo Parroquial, número a número."'),
  '"El boletín informativo de la corporación, número a número."', '"La newsletter de la corporación, número a número."'),
  '"Todos los boletines"', '"Todos los números"')
WHERE `slug` = 'boletines';

-- En la portada, «"Boletines"» solo es el título de su tesela.
UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(`datos`,
  '"Boletines"', '"Newsletter"'),
  '"Boletín informativo y anuarios"', '"Todos los números, uno a uno"')
WHERE `slug` = 'portada';
