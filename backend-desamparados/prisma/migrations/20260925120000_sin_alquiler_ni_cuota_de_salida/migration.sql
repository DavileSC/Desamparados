-- Hoy no hay cuota de salida ni alquiler de túnica: para salir basta con
-- estar al día con la cuota de hermano. Lavar o arreglar túnicas lo paga el
-- Grupo. La cuota de salida sigue configurable (precio_papeleta_sitio) por si
-- algún año se cobra; el alquiler desaparece.
UPDATE `Configuracion` SET `value` = '0' WHERE `key` = 'precio_papeleta_sitio';
DELETE FROM `Configuracion` WHERE `key` = 'precio_alquiler_tunica';
