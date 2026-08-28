-- Índices para Noticia: la web pública filtra por `visible` y ordena por
-- `fecha desc`, y el CMS ordena por `fecha` sin filtrar. Publicacion, que se
-- consulta igual, ya los tenía; Noticia no tenía ninguno.

-- CreateIndex
CREATE INDEX `Noticia_visible_fecha_idx` ON `Noticia`(`visible`, `fecha`);

-- CreateIndex
CREATE INDEX `Noticia_fecha_idx` ON `Noticia`(`fecha`);
