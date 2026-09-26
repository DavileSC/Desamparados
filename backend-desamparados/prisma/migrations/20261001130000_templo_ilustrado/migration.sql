-- La parroquia cambia el dibujo de líneas del templo por su ilustración.
--
-- Solo añade la ilustración al bloque del templo (el primero de la página), y
-- solo si sigue siendo el dibujo del templo y aún no tiene ilustración: el
-- resto de la página, editada o no en el CMS, se queda como está.

UPDATE `ContenidoPagina`
SET `datos` = JSON_SET(`datos`, '$.bloques[0].foto', JSON_OBJECT('url', '/images/templo-goretti.webp', 'alt', 'Ilustración del templo de Santa María Goretti: edificio blanco de cubierta verde, con la torre de la cruz y una imagen tras la verja'))
WHERE `slug` = 'parroquia'
  AND JSON_VALUE(`datos`, '$.bloques[0].tipo') = 'dibujo'
  AND JSON_VALUE(`datos`, '$.bloques[0].dibujo') = 'templo'
  AND JSON_EXTRACT(`datos`, '$.bloques[0].foto') IS NULL;
