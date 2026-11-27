-- El Rosario (/cultos/rosario) sigue siendo una página, apartado de Cultos,
-- pero deja de salir en el menú (27-11-2026). Un nombre propio en el menú
-- puesto en el CMS ya no tiene dónde verse, y el servidor no lo aceptaría al
-- guardar el siguiente: fuera.
UPDATE `Configuracion` SET `value` = JSON_REMOVE(`value`, '$."/cultos/rosario"')
WHERE `key` = 'nombres_en_menu' AND JSON_VALID(`value`)
  AND JSON_CONTAINS_PATH(`value`, 'one', '$."/cultos/rosario"');
