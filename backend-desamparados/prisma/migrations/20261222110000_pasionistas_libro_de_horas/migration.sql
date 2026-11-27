-- Pasionistas, «libro de horas» (28-11-2026): el escudo pasionista oficial
-- entre filetes, el texto a dos columnas con capitular y las fechas al margen
-- (bloque nuevo «Notas al margen»), sus obras como el índice de un libro
-- (tarjetas en estilo «índice») y la cita del fundador en una lámina con la
-- Virgen en sepia (cita en estilo «lámina»). Sustituyen al dibujo de líneas
-- del signo pasionista y a la cita grande; lo demás de la página se queda.
--
-- Solo si la página sigue abriendo con ese dibujo: si alguien la ha rehecho
-- en el CMS, no se toca. Los bloques se buscan por su contenido (notas, §9).

SET @datos = (SELECT `datos` FROM `ContenidoPagina` WHERE `slug` = 'pasionistas');
SET @hay = COALESCE(JSON_VALUE(@datos, '$.bloques[0].tipo') = 'dibujo'
  AND JSON_VALUE(@datos, '$.bloques[0].dibujo') = 'signoPasionista', FALSE);
SET @nuevos = '[{"tipo":"foto","titulo":"","presentacion":{"marco":"entreFiletes"},"url":"/images/pasionistas/escudo-pasionista.png","alt":"El escudo pasionista: un corazón con la cruz, el lema Jesu XPI Passio y los tres clavos","pie":""},{"tipo":"notasAlMargen","titulo":"","presentacion":{"columnas":"2","alineacion":"justificado","capitular":true},"html":"<p>La Congregación de la Pasión de Jesucristo la fundó <strong>San Pablo de la Cruz</strong> en Italia, en el siglo XVIII. Sus religiosos firman con las siglas C.P. y llevan sobre el pecho este signo: un corazón con la cruz, los tres clavos y el lema <em>Jesu XPI Passio</em>, «la Pasión de Jesucristo».</p><p>Su carisma es mantener viva la memoria de la Pasión de Cristo y anunciarla, sobre todo a quienes sufren. Por eso el escudo pasionista va también, en blanco, en el capirote de nuestros nazarenos.</p><p>Llegaron a Málaga en 1972, cuando el obispado erigió la parroquia de Santa María Goretti y se la encomendó. Desde entonces ha sido una comunidad abierta y volcada con los jóvenes, y su trabajo ha salido de la parroquia.</p><p>Hoy atienden a un barrio de unos diez mil vecinos, en un templo de paredes blancas y cubierta verde que el arquitecto Verdú terminó en 1981.</p>","notas":[{"dato":"1720","texto":"San Pablo de la Cruz funda la Congregación."},{"dato":"1972","texto":"Llegan a Málaga y reciben la parroquia."},{"dato":"1981","texto":"Se termina el templo."},{"dato":"C.P.","texto":"Congregación de la Pasión."}]},{"tipo":"tarjetas","titulo":"Sus obras","presentacion":{"estilo":"indice","fondo":"oscuro"},"tarjetas":[{"titulo":"Cáritas parroquial","descripcion":"Acogida y ayuda a las familias del barrio","enlace":""},{"titulo":"Capellanías","descripcion":"De colegios y del cementerio","enlace":""},{"titulo":"Hogar del jubilado","descripcion":"","enlace":""},{"titulo":"Teléfono de la Esperanza","descripcion":"","enlace":""},{"titulo":"Catequesis","descripcion":"De niños, jóvenes y adultos","enlace":""},{"titulo":"Ejercicios espirituales","descripcion":"","enlace":""},{"titulo":"Bautizos y bodas","descripcion":"Su preparación","enlace":""},{"titulo":"Acompañamiento espiritual","descripcion":"","enlace":""},{"titulo":"Legión de María","descripcion":"","enlace":""}]},{"tipo":"cita","titulo":"","presentacion":{"estilo":"lamina"},"texto":"La Pasión de Jesús es la obra más grande y maravillosa del amor de Dios.","autor":"San Pablo de la Cruz","fuente":"Fundador de los Pasionistas","foto":"/images/cabeceras/virgen-entre-candeleros.webp","fotoAlt":"La Virgen de los Desamparados en su altar, entre candeleros encendidos","pie":"La Virgen en su altar de Santa María Goretti."}]';

-- Fuera la cita del fundador, esté donde esté, y luego el dibujo (el primero):
-- en ese orden, quitar uno no mueve al otro.
SET @cita = REGEXP_REPLACE(JSON_UNQUOTE(JSON_SEARCH(@datos, 'one', 'San Pablo de la Cruz', NULL, '$.bloques[*].autor')), '\\.autor$', '');
UPDATE `ContenidoPagina` SET `datos` = JSON_REMOVE(`datos`, @cita)
WHERE `slug` = 'pasionistas' AND @hay AND @cita IS NOT NULL;

UPDATE `ContenidoPagina` SET `datos` = JSON_ARRAY_INSERT(JSON_REMOVE(`datos`, '$.bloques[0]'),
  '$.bloques[0]', JSON_EXTRACT(@nuevos, '$[0]'),
  '$.bloques[1]', JSON_EXTRACT(@nuevos, '$[1]'),
  '$.bloques[2]', JSON_EXTRACT(@nuevos, '$[2]'),
  '$.bloques[3]', JSON_EXTRACT(@nuevos, '$[3]'))
WHERE `slug` = 'pasionistas' AND @hay;
