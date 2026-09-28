-- El Sábado de Pasión no recorre el centro histórico de Málaga: la Virgen sale
-- por su barrio, el de los Corazones. Se corrigen los textos de partida que
-- decían lo contrario (Historia y Sábado de Pasión) y el acto de la agenda.
-- Como siempre, solo cambia lo que siga con el texto de partida.

UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(REPLACE(`datos`,
  'al Sábado de Pasión por el centro de Málaga.', 'al Sábado de Pasión por el barrio de los Corazones.'),
  'recorre las calles del centro histórico de Málaga,', 'recorre las calles del barrio de los Corazones,'),
  '"Sábado de Pasión, por las calles de Málaga"', '"Sábado de Pasión, por el barrio de los Corazones"')
WHERE `slug` = 'historia';

UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(REPLACE(`datos`,
  'sale en estación de penitencia por el centro histórico de Málaga,', 'sale en estación de penitencia por las calles del barrio de los Corazones,'),
  'Itinerario oficial de la estación de penitencia por las calles de Málaga.', 'Itinerario oficial de la estación de penitencia por las calles del barrio de los Corazones.'),
  'Itinerario oficial de la estación de penitencia por las calles de su barrio en Málaga', 'Itinerario oficial de la estación de penitencia por las calles del barrio de los Corazones')
WHERE `slug` = 'sabado-de-pasion';

UPDATE `Evento` SET `description` = 'Salida procesional de Nuestra Señora de los Desamparados por el barrio de los Corazones.'
WHERE `description` = 'Salida procesional de Nuestra Señora de los Desamparados por el centro histórico.';
