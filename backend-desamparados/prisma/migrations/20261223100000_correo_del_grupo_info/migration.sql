-- El correo del Grupo Parroquial pasa del Gmail a info@desamparadosmalaga.com
-- (28-11-2026), el buzón del dominio en OVH. Va donde estuviera el viejo: los
-- datos de la corporación (Secretaría y el correo de los derechos del RGPD),
-- las páginas, su historial y las secciones guardadas.
--
-- Solo se busca esa dirección exacta: el correo de la Parroquia
-- (goretti@diocesismalaga.es) es otro y no se toca, y en otra instalación no
-- hay nada que cambiar.

UPDATE `Configuracion`
SET `value` = REPLACE(`value`, 'goretti.desamparados@gmail.com', 'info@desamparadosmalaga.com')
WHERE `key` = 'corporacion_contacto' AND `value` LIKE '%goretti.desamparados@gmail.com%';

UPDATE `ContenidoPagina`
SET `datos` = REPLACE(`datos`, 'goretti.desamparados@gmail.com', 'info@desamparadosmalaga.com')
WHERE `datos` LIKE '%goretti.desamparados@gmail.com%';

UPDATE `VersionContenido`
SET `datos` = REPLACE(`datos`, 'goretti.desamparados@gmail.com', 'info@desamparadosmalaga.com')
WHERE `datos` LIKE '%goretti.desamparados@gmail.com%';

UPDATE `SeccionGuardada`
SET `bloques` = REPLACE(`bloques`, 'goretti.desamparados@gmail.com', 'info@desamparadosmalaga.com')
WHERE `bloques` LIKE '%goretti.desamparados@gmail.com%';
