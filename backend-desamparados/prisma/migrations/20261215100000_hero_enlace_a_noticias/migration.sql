-- El enlace secundario del hero de la portada lleva a las noticias y no a la
-- agenda (26-11-2026). El destino está en el código; aquí, su texto, solo si
-- sigue siendo el de partida: uno ya cambiado en el CMS se queda como está.
UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`, '$.hero.enlaceSecundario', 'Noticias')
WHERE `slug` = 'portada'
  AND JSON_VALUE(`datos`, '$.hero.enlaceSecundario') = 'Agenda y cultos';
