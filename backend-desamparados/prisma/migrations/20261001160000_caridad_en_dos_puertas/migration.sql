-- Caridad pasa a «Dos puertas» (maqueta B): un párrafo de entrada, dos paneles
-- —«Necesito ayuda», con el despacho y la dirección, y «Quiero ayudar», con el
-- voluntariado y el donativo—, lo que hace el Grupo en tarjetas numeradas y la
-- cita de san Mateo. El donativo queda sin valor, y por tanto sin pintar, hasta
-- que el Grupo dé el Bizum o la cuenta.
--
-- Solo se sustituye la página que sigue con el texto de partida: si alguien ya
-- la ha editado en el CMS, se queda como está.

UPDATE `ContenidoPagina` SET `datos` = '{"cabecera":{"titulo":"Caridad","subtitulo":"Mirar con los ojos de la Virgen a quienes hoy están sin amparo.","foto":"","fotoAlt":""},"bloques":[{"tipo":"texto","titulo":"","presentacion":{"estilo":"entradilla","alineacion":"centro","ancho":"estrecho"},"html":"<p>Para una corporación que lleva el nombre de los <strong>Desamparados</strong>, la caridad es casi una obligación: ser signo de la misericordia de Dios con quienes viven en soledad, enfermedad o exclusión. Lo hacemos desde la parroquia, junto a quienes ya trabajan en el barrio, y con lo que cada hermano aporta de su tiempo y de su bolsillo.</p>"},{"tipo":"puertas","titulo":"","puertas":[{"ceja":"Si lo necesitas","titulo":"Necesito ayuda","texto":"Acude a Cáritas parroquial de Santa María Goretti. Pregunta en el despacho parroquial o escríbenos y te orientamos, con discreción y sin preguntas de más.","datos":[{"etiqueta":"Despacho","valor":"Martes y viernes","nota":"18:00 – 20:00","copiable":false},{"etiqueta":"Dónde","valor":"C. Corregidor Paz Guzmán, 13","nota":"Parroquia de Santa María Goretti","copiable":false}],"boton":"Cómo llegar","enlace":"/parroquia-pasionistas#como-llegar"},{"ceja":"Si puedes dar","titulo":"Quiero ayudar","texto":"No hace falta ser hermano ni tener experiencia: basta con ganas y un par de horas cuando se pueda, o con un donativo. Escríbenos y te contamos en qué andamos ahora.","datos":[{"etiqueta":"Tu tiempo","valor":"Voluntario","nota":"Sin experiencia previa","copiable":false},{"etiqueta":"Donativo","valor":"","nota":"","copiable":true}],"boton":"Escríbenos","enlace":"/contacto"}]},{"tipo":"tarjetas","titulo":"Qué hacemos","presentacion":{"columnas":"4","estilo":"numeradas","alineacion":"izquierda"},"tarjetas":[{"titulo":"Alimentos","descripcion":"Recogemos y repartimos alimentos para familias que pasan por un mal momento.","enlace":"","icono":"manos"},{"titulo":"Familias en dificultad","descripcion":"Acompañamos a familias del barrio con necesidades concretas, con discreción y sin preguntas de más.","enlace":"","icono":"grupo"},{"titulo":"Enfermos y mayores","descripcion":"Visitamos a enfermos y a personas mayores que viven solas: a veces lo que más falta es compañía.","enlace":"","icono":"corazon"},{"titulo":"Con otras entidades","descripcion":"Colaboramos con Cáritas parroquial y con otras entidades sociales de Málaga para llegar más lejos.","enlace":"","icono":"iglesia"}]},{"tipo":"cita","titulo":"","presentacion":{"estilo":"franja","alineacion":"centro"},"texto":"Cada vez que lo hicisteis con uno de estos, mis hermanos más pequeños, conmigo lo hicisteis.","autor":"Jesús","fuente":"Evangelio según san Mateo, 25, 40"}]}'
WHERE `slug` = 'caridad' AND `datos` LIKE '%Si quieres sumarte, escríbenos y te contamos en qué andamos ahora%';

-- El botón «Cómo llegar» baja hasta el mapa de la Parroquia: se le pone el ancla
-- «como-llegar», solo si el bloque sigue siendo el mapa y aún no tiene ancla.

UPDATE `ContenidoPagina`
SET `datos` = JSON_SET(`datos`, '$.bloques[2].presentacion.ancla', 'como-llegar')
WHERE `slug` = 'parroquia'
  AND JSON_VALUE(`datos`, '$.bloques[2].tipo') = 'mapa'
  AND JSON_EXTRACT(`datos`, '$.bloques[2].presentacion') IS NOT NULL
  AND JSON_EXTRACT(`datos`, '$.bloques[2].presentacion.ancla') IS NULL;
