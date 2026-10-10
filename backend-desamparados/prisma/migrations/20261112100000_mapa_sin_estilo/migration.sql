-- El bloque de mapa tenía una opción «estilo» (oscuro / natural) que no hacía
-- nada: el mapa va con los colores de Google a propósito (en gris se veía
-- apagado). Se quita del catálogo y aquí de lo guardado, o el servidor
-- rechazaría volver a guardar esas páginas («no es una opción de este
-- bloque»). Solo el mapa usa la clave «estilo» con esos valores (el fondo
-- oscuro es «fondo»). Con expresión regular y no REPLACE: MariaDB guarda
-- parte del JSON con espacios tras «:» y «,». Las tres formas: detrás de
-- otra opción, delante de otra y sola.

UPDATE `ContenidoPagina` SET `datos` = REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(`datos`, ',\\s*"estilo"\\s*:\\s*"(oscuro|natural)"', ''), '"estilo"\\s*:\\s*"(oscuro|natural)"\\s*,\\s*', ''), '"estilo"\\s*:\\s*"(oscuro|natural)"', '')
WHERE `datos` REGEXP '"estilo"\\s*:\\s*"(oscuro|natural)"';

UPDATE `VersionContenido` SET `datos` = REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(`datos`, ',\\s*"estilo"\\s*:\\s*"(oscuro|natural)"', ''), '"estilo"\\s*:\\s*"(oscuro|natural)"\\s*,\\s*', ''), '"estilo"\\s*:\\s*"(oscuro|natural)"', '')
WHERE `datos` REGEXP '"estilo"\\s*:\\s*"(oscuro|natural)"';

UPDATE `SeccionGuardada` SET `bloques` = REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(`bloques`, ',\\s*"estilo"\\s*:\\s*"(oscuro|natural)"', ''), '"estilo"\\s*:\\s*"(oscuro|natural)"\\s*,\\s*', ''), '"estilo"\\s*:\\s*"(oscuro|natural)"', '')
WHERE `bloques` REGEXP '"estilo"\\s*:\\s*"(oscuro|natural)"';
