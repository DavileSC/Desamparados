-- El aviso de «No es de mi familia» apunta a la ficha devuelta para que el
-- Inicio del CMS la enlace. Sin clave foránea, como creadoPorId: el aviso no
-- debe impedir borrar ni mover la ficha.
ALTER TABLE `AvisoJunta` ADD COLUMN `hermanoId` INTEGER NULL;
