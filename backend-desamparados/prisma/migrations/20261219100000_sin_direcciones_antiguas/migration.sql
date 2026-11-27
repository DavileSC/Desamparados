-- La web deja de redirigir las direcciones viejas (27-11-2026, lo pidió así el
-- usuario): /parroquia-pasionistas, /rosario, /publicaciones/boletines,
-- /nuestros-fines/formacion y los prefijos de antes de quitar las portadas de
-- sección (/corporacion/…, /actualidad/…, /hermanos/…, /sagrada-titular/…).
-- Ahora dan 404, y el servidor ya no acepta un enlace guardado a ellas.
--
-- Aquí, los enlaces guardados pasan a la dirección de ahora: sin esto llevarían
-- a «página no encontrada» y su página no se podría volver a guardar. El
-- historial también, para que restaurar una versión vieja no traiga uno.
--
-- Se busca la dirección con la comilla de apertura delante: así vale igual en
-- un "enlace" que en un href dentro de un HTML (en el JSON, \"/rosario), lo
-- que venga detrás (#ancla, ?consulta) se conserva, y "/cultos/rosario" no se
-- toca al cambiar "/rosario". Formación lleva a Evangelización, como hacía su
-- redirección.

UPDATE `ContenidoPagina` SET `datos` =
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`datos`,
    '"/parroquia-pasionistas', '"/parroquia'),
    '"/rosario', '"/cultos/rosario'),
    '"/publicaciones/boletines', '"/publicaciones/newsletter'),
    '"/nuestros-fines/formacion', '"/nuestros-fines/evangelizacion'),
    '"/corporacion/', '"/'),
    '"/actualidad/', '"/'),
    '"/hermanos/', '"/'),
    '"/sagrada-titular/', '"/')
WHERE `datos` REGEXP '"/(parroquia-pasionistas|rosario|publicaciones/boletines|nuestros-fines/formacion|corporacion/|actualidad/|hermanos/|sagrada-titular/)';

UPDATE `VersionContenido` SET `datos` =
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`datos`,
    '"/parroquia-pasionistas', '"/parroquia'),
    '"/rosario', '"/cultos/rosario'),
    '"/publicaciones/boletines', '"/publicaciones/newsletter'),
    '"/nuestros-fines/formacion', '"/nuestros-fines/evangelizacion'),
    '"/corporacion/', '"/'),
    '"/actualidad/', '"/'),
    '"/hermanos/', '"/'),
    '"/sagrada-titular/', '"/')
WHERE `datos` REGEXP '"/(parroquia-pasionistas|rosario|publicaciones/boletines|nuestros-fines/formacion|corporacion/|actualidad/|hermanos/|sagrada-titular/)';

UPDATE `SeccionGuardada` SET `bloques` =
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`bloques`,
    '"/parroquia-pasionistas', '"/parroquia'),
    '"/rosario', '"/cultos/rosario'),
    '"/publicaciones/boletines', '"/publicaciones/newsletter'),
    '"/nuestros-fines/formacion', '"/nuestros-fines/evangelizacion'),
    '"/corporacion/', '"/'),
    '"/actualidad/', '"/'),
    '"/hermanos/', '"/'),
    '"/sagrada-titular/', '"/')
WHERE `bloques` REGEXP '"/(parroquia-pasionistas|rosario|publicaciones/boletines|nuestros-fines/formacion|corporacion/|actualidad/|hermanos/|sagrada-titular/)';

UPDATE `Noticia` SET `contenido` =
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`contenido`,
    '"/parroquia-pasionistas', '"/parroquia'),
    '"/rosario', '"/cultos/rosario'),
    '"/publicaciones/boletines', '"/publicaciones/newsletter'),
    '"/nuestros-fines/formacion', '"/nuestros-fines/evangelizacion'),
    '"/corporacion/', '"/'),
    '"/actualidad/', '"/'),
    '"/hermanos/', '"/'),
    '"/sagrada-titular/', '"/')
WHERE `contenido` REGEXP '"/(parroquia-pasionistas|rosario|publicaciones/boletines|nuestros-fines/formacion|corporacion/|actualidad/|hermanos/|sagrada-titular/)';

-- Un nombre del menú guardado con una dirección vieja ya no tiene página.
UPDATE `Configuracion` SET `value` = JSON_REMOVE(`value`,
  '$."/parroquia-pasionistas"', '$."/rosario"', '$."/publicaciones/boletines"', '$."/nuestros-fines/formacion"')
WHERE `key` = 'nombres_en_menu' AND JSON_VALID(`value`)
  AND `value` REGEXP '"/(parroquia-pasionistas|rosario|publicaciones/boletines|nuestros-fines/formacion)"';
