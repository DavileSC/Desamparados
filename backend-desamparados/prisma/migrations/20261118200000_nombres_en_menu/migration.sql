-- El nombre de cada página en el menú público, editable desde el CMS (clave
-- `nombres_en_menu` de `Configuracion`: JSON { ruta: nombre }, solo los que
-- cambian; sin fila, los nombres de siempre del código).
--
-- En la etapa 6 de la Fase 8 la entrada «Parroquia · Pasionistas» pasó a
-- «Parroquia» para que el código no fuera de Desamparados. Aquí Desamparados
-- recupera su nombre, pero SOLO una instalación en marcha: la señal, como en
-- `20261117200000_salidas_neutras_en_base_nueva`, es que ya hay páginas de
-- contenido (la API las siembra al arrancar, después de las migraciones), así
-- que una base recién creada para otra corporación no se lleva este nombre.
-- Si la clave ya existe (alguien la guardó desde el CMS), no se toca.
INSERT INTO `Configuracion` (`key`, `value`, `descripcion`, `updatedAt`)
SELECT 'nombres_en_menu',
       '{"/parroquia":"Parroquia · Pasionistas"}',
       'Nombres de las páginas en el menú público (CMS → Páginas)',
       CURRENT_TIMESTAMP(3)
FROM DUAL
WHERE EXISTS (SELECT 1 FROM `ContenidoPagina`)
  AND NOT EXISTS (SELECT 1 FROM `Configuracion` WHERE `key` = 'nombres_en_menu');
