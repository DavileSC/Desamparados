-- Nuestros fines pasa de los tres anillos a los fines «en foco» (maqueta B):
-- los tres nombres en grande, uno nítido y los otros desenfocados; la cita se
-- enfoca palabra a palabra y la llamada va en una fila.
--
-- Solo cambia la presentación de los tres bloques, y solo si la página sigue
-- con los tres de partida (fines, cita y llamada) y los fines siguen en sus
-- anillos sobre fondo oscuro sin más opciones: si alguien ya la ha tocado en
-- el CMS, se queda como está. Los textos no se tocan.

UPDATE `ContenidoPagina`
SET `datos` = JSON_SET(`datos`,
  '$.bloques[0].presentacion', JSON_OBJECT('disposicion', 'foco'),
  '$.bloques[1].presentacion', JSON_OBJECT('estilo', 'enfoque', 'alineacion', 'izquierda'),
  '$.bloques[2].presentacion', JSON_OBJECT('estilo', 'fila'))
WHERE `slug` = 'nuestros-fines'
  AND JSON_LENGTH(`datos`, '$.bloques') = 3
  AND JSON_VALUE(`datos`, '$.bloques[0].tipo') = 'anillos'
  AND JSON_VALUE(`datos`, '$.bloques[1].tipo') = 'cita'
  AND JSON_VALUE(`datos`, '$.bloques[2].tipo') = 'llamada'
  AND JSON_VALUE(`datos`, '$.bloques[0].presentacion.fondo') = 'oscuro'
  AND JSON_LENGTH(`datos`, '$.bloques[0].presentacion') = 1
  AND JSON_EXTRACT(`datos`, '$.bloques[2].presentacion') IS NULL;
