-- La letra de la cubierta de cada publicación según su foto. Las que ya
-- tienen portada se quedan en NULL: la API la calcula la primera vez que las
-- sirve en la portada (necesita leer la foto, y eso no lo hace el SQL). Nombre
-- de la tabla con su mayúscula, como las demás.

-- AlterTable
ALTER TABLE `Publicacion` ADD COLUMN `tintaPortada` JSON NULL;
