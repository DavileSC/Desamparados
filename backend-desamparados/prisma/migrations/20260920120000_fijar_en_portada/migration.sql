-- La destacada de la portada. Hasta ahora la portada se llenaba sola con las
-- tres más recientes publicadas y no había forma de intervenir: el único mando
-- era cambiarle la fecha a la noticia. Con esta columna, la marcada encabeza y
-- las otras dos plazas se siguen rellenando por fecha.
--
-- Solo una a la vez: la exclusividad la garantiza el servicio (al fijar una,
-- suelta la anterior), no la base de datos, porque un índice único sobre un
-- booleano no dejaría tener ninguna sin fijar.
--
-- Sin índice nuevo: el orden pasa a ser `fijada DESC, fecha DESC` y un índice
-- mixto no se aprovecharía con fiabilidad en MariaDB; con el volumen real de
-- noticias y publicaciones, los índices de `visible, fecha` siguen bastando.

-- AlterTable
ALTER TABLE `Noticia` ADD COLUMN `fijada` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Publicacion` ADD COLUMN `fijada` BOOLEAN NOT NULL DEFAULT false;
