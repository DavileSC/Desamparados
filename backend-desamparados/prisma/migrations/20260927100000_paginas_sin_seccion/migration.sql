-- Las páginas dejan de colgar de su sección: /corporacion/historia pasa a ser
-- /historia, /actualidad/noticias/<noticia> a /noticias/<noticia>,
-- /hermanos/acceso a /acceso, y así con todas. Las portadas de sección se
-- quitaron en la migración anterior y el prefijo ya no aportaba nada.
--
-- Se reescriben los enlaces ya guardados: las tarjetas y botones de las
-- páginas del CMS, y los enlaces escritos dentro de noticias, páginas antiguas
-- y descripciones de actos. Sin esto, una página con un enlace viejo no se
-- podría volver a guardar (el servidor solo acepta destinos que existen). Las
-- direcciones viejas siguen funcionando en la web, que las lleva a las nuevas.
--
-- En MariaDB una columna JSON es texto: REPLACE trabaja sobre ella tal cual.
--
-- Solo se tocan las que empiezan justo tras unas comillas (un enlace, no un
-- texto que las mencione) o tras el dominio de la web.

UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`datos`, '"/corporacion/', '"/'), '"/sagrada-titular/', '"/'), '"/actualidad/', '"/'), '"/hermanos/acceso', '"/acceso'), '"/hermanos/hazte-hermano', '"/hazte-hermano'), 'desamparadosmalaga.com/corporacion/', 'desamparadosmalaga.com/'), 'desamparadosmalaga.com/sagrada-titular/', 'desamparadosmalaga.com/'), 'desamparadosmalaga.com/actualidad/', 'desamparadosmalaga.com/'), 'desamparadosmalaga.com/hermanos/acceso', 'desamparadosmalaga.com/acceso'), 'desamparadosmalaga.com/hermanos/hazte-hermano', 'desamparadosmalaga.com/hazte-hermano');

UPDATE `Noticia` SET `contenido` = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`contenido`, '"/corporacion/', '"/'), '"/sagrada-titular/', '"/'), '"/actualidad/', '"/'), '"/hermanos/acceso', '"/acceso'), '"/hermanos/hazte-hermano', '"/hazte-hermano'), 'desamparadosmalaga.com/corporacion/', 'desamparadosmalaga.com/'), 'desamparadosmalaga.com/sagrada-titular/', 'desamparadosmalaga.com/'), 'desamparadosmalaga.com/actualidad/', 'desamparadosmalaga.com/'), 'desamparadosmalaga.com/hermanos/acceso', 'desamparadosmalaga.com/acceso'), 'desamparadosmalaga.com/hermanos/hazte-hermano', 'desamparadosmalaga.com/hazte-hermano');

UPDATE `Pagina` SET `contenido` = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`contenido`, '"/corporacion/', '"/'), '"/sagrada-titular/', '"/'), '"/actualidad/', '"/'), '"/hermanos/acceso', '"/acceso'), '"/hermanos/hazte-hermano', '"/hazte-hermano'), 'desamparadosmalaga.com/corporacion/', 'desamparadosmalaga.com/'), 'desamparadosmalaga.com/sagrada-titular/', 'desamparadosmalaga.com/'), 'desamparadosmalaga.com/actualidad/', 'desamparadosmalaga.com/'), 'desamparadosmalaga.com/hermanos/acceso', 'desamparadosmalaga.com/acceso'), 'desamparadosmalaga.com/hermanos/hazte-hermano', 'desamparadosmalaga.com/hazte-hermano');

UPDATE `Evento` SET `description` = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`description`, '"/corporacion/', '"/'), '"/sagrada-titular/', '"/'), '"/actualidad/', '"/'), '"/hermanos/acceso', '"/acceso'), '"/hermanos/hazte-hermano', '"/hazte-hermano'), 'desamparadosmalaga.com/corporacion/', 'desamparadosmalaga.com/'), 'desamparadosmalaga.com/sagrada-titular/', 'desamparadosmalaga.com/'), 'desamparadosmalaga.com/actualidad/', 'desamparadosmalaga.com/'), 'desamparadosmalaga.com/hermanos/acceso', 'desamparadosmalaga.com/acceso'), 'desamparadosmalaga.com/hermanos/hazte-hermano', 'desamparadosmalaga.com/hazte-hermano') WHERE `description` IS NOT NULL;
