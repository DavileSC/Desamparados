-- La misma Formación en «Las preguntas» de 20261204100000_formacion_en_preguntas,
-- para las bases donde aquella no hizo nada. Buscaba el texto
-- `"estilo":"carta"` junto, y una página que ha pasado por JSON_SET (la foto
-- de la cabecera, por ejemplo) MariaDB la guarda con espacios: `"estilo":
-- "carta"`. Pasó en la web de pruebas el 23-10-2026. Aquí el estilo se lee con
-- JSON_VALUE, que no depende de cómo esté escrito el JSON.
--
-- Mismas condiciones que la otra: solo si la página sigue con la carta de
-- partida (tres bloques, el primero en carta y con el texto de siempre). Donde
-- aquella ya la cambió, el primer bloque es «preguntas» y esta no hace nada.

UPDATE `ContenidoPagina`
SET `datos` = JSON_SET(`datos`, '$.bloques', JSON_EXTRACT('[{"tipo":"texto","titulo":"","presentacion":{"estilo":"preguntas"},"html":"<p>¿Por qué rezamos un triduo?</p><p>¿Qué significa el besamanos?</p><p>¿Por qué salimos a la calle?</p>"},{"tipo":"texto","titulo":"","presentacion":{"estilo":"margen"},"html":"<h3>Para eso, la formación</h3><p>La formación es uno de los pilares del Grupo Parroquial. No se trata de acumular conocimientos, sino de ayudar a cada hermano a conocer mejor a Dios y a vivir el Evangelio en lo de cada día.</p>"},{"tipo":"tarjetas","titulo":"","presentacion":{"columnas":"4","estilo":"filetes"},"tarjetas":[{"titulo":"Catequesis y charlas","descripcion":"Durante el curso, sesiones para profundizar en la fe, la liturgia y la devoción a la Virgen.","enlace":"","etiqueta":"Durante el curso"},{"titulo":"Retiros y oración","descripcion":"Momentos para parar, rezar juntos y prepararse para los tiempos fuertes del año: el Adviento y la Cuaresma.","enlace":"","etiqueta":"Adviento y Cuaresma"},{"titulo":"La espiritualidad de la Pasión","descripcion":"De la mano de los Pasionistas, que nos acompañan en la parroquia, con la Cruz como escuela de amor.","enlace":"","etiqueta":"Con los Pasionistas"},{"titulo":"Jóvenes y nuevos hermanos","descripcion":"Una atención especial para que conozcan la historia, los fines y las tradiciones del Grupo.","enlace":"","etiqueta":"Al entrar en el Grupo"}]},{"tipo":"texto","titulo":"","presentacion":{"fondo":"oscuro"},"html":"<p>Todo lo que proponemos está abierto a hermanos, devotos y a cualquiera que quiera acercarse. Las fechas se anuncian en la <a href=\\"/agenda\\">Agenda</a>.</p><p>La preparación para los sacramentos la lleva la parroquia de Santa María Goretti: pregunta en el despacho parroquial, <strong>martes y viernes de 18:00 a 20:00</strong>.</p>"},{"tipo":"cita","titulo":"","presentacion":{"estilo":"clasica","alineacion":"centro"},"texto":"María conservaba todas estas cosas, meditándolas en su corazón.","autor":"","fuente":"Evangelio según san Lucas, 2, 19"},{"tipo":"botones","titulo":"","presentacion":{"alineacion":"centro"},"botones":[{"texto":"Ver la agenda","enlace":"/agenda","estilo":"principal"},{"texto":"Escríbenos","enlace":"/contacto","estilo":"secundario"}]}]', '$'))
WHERE `slug` = 'formacion'
  AND JSON_VALUE(`datos`, '$.bloques[0].presentacion.estilo') = 'carta'
  AND JSON_LENGTH(`datos`, '$.bloques') = 3
  AND `datos` LIKE '%<h3>Jóvenes y nuevos hermanos</h3>%'
  AND `datos` LIKE '%Una atención especial para que conozcan la historia%';
