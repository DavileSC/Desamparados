-- Noticias: el extracto pasa de 191 a 300 caracteres (con 191, lo que el CMS
-- dejaba escribir de más fallaba al guardar) y cada foto gana su punto de
-- encuadre (de 0 a 100 en cada eje; sin él, el centro), porque el archivo la
-- recorta muy apaisada en la principal y cuadrada en la lista.
ALTER TABLE `noticia` ADD COLUMN `encuadreX` INTEGER NULL,
    ADD COLUMN `encuadreY` INTEGER NULL,
    MODIFY `extracto` VARCHAR(300) NULL;
