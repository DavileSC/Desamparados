-- La foto de los nazarenos de la portada (Sábado de Pasión) y de la cabecera
-- de Sábado de Pasión era de Unsplash, de nazarenos de capirote blanco de otra
-- cofradía. Ahora es una del Grupo con el mismo nombre de fichero, así que solo
-- cambia su descripción. Se toca solo si sigue la de antes: si alguien la
-- cambió en el CMS, se queda la suya. También en el historial.

UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(`datos`,
  '"Nazarenos de capirote blanco durante la procesión"',
  '"Nazarenos del Grupo, de capirote negro, con sus cirios y la bandera blanca en la salida procesional"'),
  '"Nazarenos con capirote blanco bajo un árbol, en blanco y negro"',
  '"Nazarenos del Grupo, de capirote negro, por la calle en la salida procesional"')
WHERE `datos` LIKE '%capirote blanco%';

UPDATE `VersionContenido` SET `datos` = REPLACE(REPLACE(`datos`,
  '"Nazarenos de capirote blanco durante la procesión"',
  '"Nazarenos del Grupo, de capirote negro, con sus cirios y la bandera blanca en la salida procesional"'),
  '"Nazarenos con capirote blanco bajo un árbol, en blanco y negro"',
  '"Nazarenos del Grupo, de capirote negro, por la calle en la salida procesional"')
WHERE `datos` LIKE '%capirote blanco%';
