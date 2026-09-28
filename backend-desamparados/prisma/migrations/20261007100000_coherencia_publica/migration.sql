-- Coherencia de la web pública (auditoría visual del 28-09-2026). Como
-- siempre, solo cambia lo que siga con el valor de partida.

-- Contacto y Rosario llevaban la misma foto de cabecera: Contacto pasa a la
-- única foto de cabecera que no usaba ninguna página.
UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(`datos`,
  '"/images/cabeceras/virgen-de-noche.webp"', '"/images/cabeceras/nazarenos-con-cirios.webp"'),
  '"La Virgen de los Desamparados de noche, entre cirios encendidos"', '"Nazarenos con túnica negra y cirios por una avenida arbolada, camino de la cruz de guía"')
WHERE `slug` = 'contacto';

-- «Parroquia - Pasionistas», con el punto medio que usa el resto de la web.
UPDATE `ContenidoPagina` SET `datos` = REPLACE(`datos`, '"Parroquia - Pasionistas"', '"Parroquia · Pasionistas"')
WHERE `slug` = 'parroquia';
