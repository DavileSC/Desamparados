-- Agenda, Cultos e Historia se abren con la cabecera a sangre, como las demás
-- (28-11-2026). Hasta ahora su foto, si la había, iba velada detrás de la
-- página; ahora va a todo el ancho arriba, así que cada una recibe una foto
-- del Grupo con su descripción y su encuadre.
--
-- Solo se toca la que sigue sin foto propia. En Historia cuenta como «sin
-- foto» la de la portada, que era la de partida para el fondo velado.

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/insignias-de-noche.webp',
  '$.cabecera.fotoAlt', 'Banderines bordados en plata y cruces del cortejo, de noche por la calle',
  '$.cabecera.encuadre', 45)
WHERE `slug` = 'agenda' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') = '';

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/saya.webp',
  '$.cabecera.fotoAlt', 'Las manos de la Virgen de los Desamparados sobre la saya bordada en oro, con el rosario y el encaje',
  '$.cabecera.encuadre', 40)
WHERE `slug` = 'cultos' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') = '';

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/virgen-de-perfil.webp',
  '$.cabecera.fotoAlt', 'El rostro de la Virgen de los Desamparados de perfil, con corona de plata y encaje',
  '$.cabecera.encuadre', 60)
WHERE `slug` = 'historia'
  AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') IN ('', '/images/hero-1920.webp');

-- El antetítulo de Historia ya no se pinta: la línea de encima del título
-- sale del menú, como en las demás. Al leer ya se descartaba; se quita
-- también de lo guardado para que no quede un dato muerto.
UPDATE `ContenidoPagina` SET `datos` = JSON_REMOVE(`datos`, '$.cabecera.ceja')
WHERE `slug` = 'historia' AND JSON_CONTAINS_PATH(`datos`, 'one', '$.cabecera.ceja');
