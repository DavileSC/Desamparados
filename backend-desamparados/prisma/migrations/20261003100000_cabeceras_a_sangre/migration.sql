-- Cabeceras a sangre: las páginas de información abren con una foto a todo
-- el ancho y el título encima. Cada una recibe una foto real del Grupo
-- (desamparados-web/public/images/cabeceras), con su descripción y su
-- encuadre: qué altura de la foto (0 arriba, 100 abajo) queda a la vista.
--
-- Solo se toca la página que sigue sin foto de cabecera: si alguien ya le ha
-- puesto una desde el CMS, se queda la suya.

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/nazarenos-con-cirios.webp',
  '$.cabecera.fotoAlt', 'Nazarenos de negro con cirios, en fila por la calle',
  '$.cabecera.encuadre', 45)
WHERE `slug` = 'recorrido' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') = '';

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/cruz-de-guia.webp',
  '$.cabecera.fotoAlt', 'La cruz de guía y los banderines dentro del templo, entre nazarenos, antes de la salida',
  '$.cabecera.encuadre', 35)
WHERE `slug` = 'parroquia' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') = '';

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/virgen-de-perfil.webp',
  '$.cabecera.fotoAlt', 'El rostro de la Virgen de los Desamparados de perfil, con corona de plata y encaje',
  '$.cabecera.encuadre', 55)
WHERE `slug` = 'organos-de-gobierno' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') = '';

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/virgen-en-su-altar.webp',
  '$.cabecera.fotoAlt', 'La Virgen de los Desamparados en su altar, entre candeleros encendidos y ante un dosel rojo',
  '$.cabecera.encuadre', 35)
WHERE `slug` = 'nuestros-fines' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') = '';

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/rostro.webp',
  '$.cabecera.fotoAlt', 'El rostro de la Virgen de los Desamparados, con la mirada alzada y una lágrima en la mejilla',
  '$.cabecera.encuadre', 40)
WHERE `slug` = 'caridad' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') = '';

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/cera.webp',
  '$.cabecera.fotoAlt', 'Cirios del trono con el emblema pasionista; detrás, la Virgen desenfocada',
  '$.cabecera.encuadre', 40)
WHERE `slug` = 'formacion' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') = '';

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/nazarenos.webp',
  '$.cabecera.fotoAlt', 'Nazarenos con capirote blanco bajo un árbol, en blanco y negro',
  '$.cabecera.encuadre', 55)
WHERE `slug` = 'sabado-de-pasion' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') = '';

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/trono-de-noche.webp',
  '$.cabecera.fotoAlt', 'El trono de la Virgen entre las casas del barrio, de noche, en blanco y negro',
  '$.cabecera.encuadre', 55)
WHERE `slug` = 'trono' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') = '';

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/insignias-de-noche.webp',
  '$.cabecera.fotoAlt', 'Banderines bordados en plata y cruces del cortejo, de noche por la calle',
  '$.cabecera.encuadre', 45)
WHERE `slug` = 'enseres' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') = '';

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/virgen-dosel-rojo.webp',
  '$.cabecera.fotoAlt', 'Nuestra Señora de los Desamparados con corona de plata y rostrillo de encaje, ante un dosel rojo',
  '$.cabecera.encuadre', 35)
WHERE `slug` = 'desamparados' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') = '';

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/saya.webp',
  '$.cabecera.fotoAlt', 'Las manos de la Virgen sobre la saya bordada en oro, con el rosario y el encaje del pecherín',
  '$.cabecera.encuadre', 40)
WHERE `slug` = 'ajuar' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') = '';

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/trono-en-la-calle.webp',
  '$.cabecera.fotoAlt', 'El trono de la Virgen en la calle, entre ciriales y bajo los árboles',
  '$.cabecera.encuadre', 55)
WHERE `slug` = 'noticias' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') = '';

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/manto.webp',
  '$.cabecera.fotoAlt', 'El manto de terciopelo azul, bordado en oro, sobre el trono y bajo los árboles',
  '$.cabecera.encuadre', 45)
WHERE `slug` = 'publicaciones' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') = '';

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/virgen-entre-candeleros.webp',
  '$.cabecera.fotoAlt', 'La Virgen de los Desamparados entre candeleros encendidos, ante un dosel rojo',
  '$.cabecera.encuadre', 35)
WHERE `slug` = 'boletines' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') = '';

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/hombres-de-trono.webp',
  '$.cabecera.fotoAlt', 'Hombres de trono en fila bajo los varales, en la calle',
  '$.cabecera.encuadre', 40)
WHERE `slug` = 'dossier-prensa' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') = '';

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.cabecera.foto', '/images/cabeceras/virgen-de-noche.webp',
  '$.cabecera.fotoAlt', 'La Virgen de los Desamparados de noche, entre cirios encendidos',
  '$.cabecera.encuadre', 45)
WHERE `slug` = 'contacto' AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`datos`, '$.cabecera.foto')), '') = '';
