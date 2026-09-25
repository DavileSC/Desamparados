-- Las portadas de sección (Corporación, Sagrada Titular y Actualidad) se
-- quitaron de la web: el menú entra directamente por sus subpáginas y esas
-- direcciones dan «Página no encontrada». Sus documentos ya no se leen ni se
-- editan desde el CMS.
DELETE FROM `ContenidoPagina` WHERE `slug` IN ('corporacion', 'titular', 'actualidad');
