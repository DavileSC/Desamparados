-- La papeleta ya no se manda por correo: se da en papel en la mesa y está en
-- el área de hermanos. Las plantillas de ese correo no tendrían dónde verse
-- en el CMS, así que se van (sus versiones caen con ellas por la cascada).
DELETE FROM `PlantillaCorreo` WHERE `uso` = 'papeleta';
