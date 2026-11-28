-- Sagrada titular, detalle a detalle (27-11-2026): la página se acerca a la
-- Virgen poco a poco, rostro, corona, corazón, manos y saya, cada uno con su
-- foto a pantalla y su texto (bloque nuevo «Detalle a detalle»). El ajuar ya
-- no va en carrusel aparte: se cuenta así, pieza a pieza, y el ancla #ajuar
-- pasa a los detalles. Después, «La imagen» (datos en ficha nueva: autor,
-- bendición, material y reconocimiento), la advocación en cuatro fechas y la
-- banda del triduo y el besamanos con «Ver los cultos». La cabecera cambia
-- su frase.
--
-- Solo si la página sigue con sus bloques de partida (texto, el texto del
-- ajuar con su ancla y el carrusel): si alguien la ha rehecho en el CMS, no se
-- toca. Si además lleva, detrás del primer texto, la galería con las fotos
-- que se subieron desde el CMS, se conserva: va después de «La imagen».

SET @nuevos = '[{"tipo":"texto","titulo":"","presentacion":{"estilo":"entradilla","alineacion":"centro"},"html":"<p>La devoción a la Virgen de los Desamparados nace en Valencia y se extiende por toda España. Aquí es Madre y Titular, patrona de quienes se sienten solos, olvidados o necesitados de misericordia.</p>"},{"tipo":"detalles","titulo":"","presentacion":{"ancla":"ajuar"},"detalles":[{"titulo":"El rostro","texto":"Tallado por Juan Vega Ortega en madera de cedro real y bendecido el 20 de octubre de 2007 en Santa María Goretti. Fue su primera imagen mariana para Málaga.","foto":{"url":"/images/cabeceras/rostro.webp","alt":"El rostro de la Virgen de los Desamparados, con la mirada alzada y una lágrima en la mejilla"}},{"titulo":"La corona","texto":"Un resplandor de rayos y estrellas, rematado por la cruz, que enmarca el rostro sobre la toca de encaje.","foto":{"url":"/images/ajuar/corona.webp","alt":"La Virgen de los Desamparados de perfil, con la corona de rayos y estrellas y la toca de encaje"}},{"titulo":"El corazón","texto":"Sobre el pecherín, traspasado por siete puñales: los siete dolores de María.","foto":{"url":"/images/ajuar/corazon.webp","alt":"El corazón de plata atravesado por siete puñales, sobre el pecherín de encaje"}},{"titulo":"Las manos","texto":"La pulsera de perlas en la muñeca y el puño de encaje, junto a la manga ribeteada en oro.","foto":{"url":"/images/ajuar/perlas.webp","alt":"La mano izquierda de la Virgen con la pulsera de perlas y el puño de encaje"}},{"titulo":"La saya","texto":"Tela clara y cintura bordada en oro, con la flor de lis; de la mano cae el rosario de cuentas negras.","foto":{"url":"/images/ajuar/saya.webp","alt":"La saya clara con la cintura bordada en oro, entre las manos de la Virgen"}}]},{"tipo":"datos","titulo":"La imagen","presentacion":{"fondo":"oscuro","disposicion":"ficha"},"lineas":[{"etiqueta":"Autor","valor":"Juan Vega Ortega","nota":"Su primera imagen mariana para Málaga."},{"etiqueta":"Bendición","valor":"20 de octubre de 2007","nota":"En Santa María Goretti."},{"etiqueta":"Material","valor":"Cedro real","nota":"Dolorosa de unos 162 cm."},{"etiqueta":"Reconocimiento","valor":"La Hornacina","nota":"Mejor imagen de 2007."}]},{"tipo":"cronologia","titulo":"De Valencia a los Corazones","presentacion":{"disposicion":"horizontal","alineacionTitulo":"izquierda"},"hitos":[{"periodo":"1409","etiqueta":"Valencia","titulo":"El padre Jofré pide un hospital para los enfermos mentales abandonados.","relato":"","foto":{"url":"","alt":"","pie":""},"tono":"oro"},{"periodo":"1414","etiqueta":"Valencia","titulo":"Nace la cofradía de Nuestra Señora de los Inocentes, Mártires y Desamparados.","relato":"","foto":{"url":"","alt":"","pie":""},"tono":"oro"},{"periodo":"1923","etiqueta":"Valencia","titulo":"La patrona de Valencia es coronada canónicamente.","relato":"","foto":{"url":"","alt":"","pie":""},"tono":"oro"},{"periodo":"2007","etiqueta":"Málaga","titulo":"Juan Vega Ortega talla nuestra imagen para Santa María Goretti.","relato":"","foto":{"url":"","alt":"","pie":""},"tono":"oro"}]},{"tipo":"fotoTexto","titulo":"","presentacion":{"fondo":"oscuro","lado":"derecha","proporcion":"4:3"},"url":"/images/ajuar/altar.webp","alt":"La Virgen de los Desamparados en su altar, vestida y entre velas encendidas","pie":"","html":"<h2>Triduo y besamanos</h2><p>Cada noviembre, tres días de oración ante la Virgen que acaban en un besamanos.</p>","boton":"Ver los cultos","enlace":"/cultos"}]';

UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.bloques', JSON_EXTRACT(@nuevos, '$'),
  '$.cabecera.subtitulo', 'Madre de los que se sienten solos.')
WHERE `slug` = 'sagrada-titular'
  AND JSON_LENGTH(`datos`, '$.bloques') = 3
  AND JSON_VALUE(`datos`, '$.bloques[0].tipo') = 'texto'
  AND JSON_VALUE(`datos`, '$.bloques[1].presentacion.ancla') = 'ajuar'
  AND JSON_VALUE(`datos`, '$.bloques[2].tipo') = 'carrusel';

-- Con la galería: se mete tal cual en el cuarto puesto. Las funciones JSON
-- van anidadas sin nada en medio para que la galería entre como objeto y no
-- como texto.
UPDATE `ContenidoPagina` SET `datos` = JSON_SET(`datos`,
  '$.bloques', JSON_ARRAY_INSERT(JSON_EXTRACT(@nuevos, '$'), '$[3]', JSON_EXTRACT(`datos`, '$.bloques[1]')),
  '$.cabecera.subtitulo', 'Madre de los que se sienten solos.')
WHERE `slug` = 'sagrada-titular'
  AND JSON_LENGTH(`datos`, '$.bloques') = 4
  AND JSON_VALUE(`datos`, '$.bloques[0].tipo') = 'texto'
  AND JSON_VALUE(`datos`, '$.bloques[1].tipo') = 'galeria'
  AND JSON_VALUE(`datos`, '$.bloques[2].presentacion.ancla') = 'ajuar'
  AND JSON_VALUE(`datos`, '$.bloques[3].tipo') = 'carrusel';
