-- Los correos de la procesión dejan de ser uno por salida fija (Pasión,
-- Rosario) y pasan a ser uno por clase de correo, válido para todas las
-- salidas: «papeleta» y «apertura», con el nombre de la salida en {{salida}}.
-- Las salidas ya son filas editables (20261029200000_salidas_configurables) y
-- un uso por salida fija no sabría qué hacer con una tercera.
--
-- Las plantillas guardadas no se pierden: pasan al uso nuevo. Las de la Pasión
-- conservan si estaban en uso; las del Rosario entran sin uso, porque de cada
-- uso solo puede haber una en uso y la de la Pasión es la que valía para el
-- correo con más destinatarios.

UPDATE `PlantillaCorreo` SET `uso` = 'papeleta' WHERE `uso` = 'papeleta_pasion';
UPDATE `PlantillaCorreo` SET `uso` = 'apertura' WHERE `uso` = 'apertura_pasion';
UPDATE `PlantillaCorreo` SET `uso` = 'papeleta', `enUso` = false WHERE `uso` = 'papeleta_rosario';
UPDATE `PlantillaCorreo` SET `uso` = 'apertura', `enUso` = false WHERE `uso` = 'apertura_rosario';
