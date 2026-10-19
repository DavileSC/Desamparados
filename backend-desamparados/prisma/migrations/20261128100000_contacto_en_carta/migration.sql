-- Contacto pasa a la «Carta» (maqueta A1, 19-10-2026): el formulario escrito
-- como una carta, al ancho y con las etiquetas del estilo «carta» de
-- Formación, y los datos de contacto al pie. Delante, un texto en carta con el
-- antetítulo y la entrada, editable en el CMS como cualquier bloque de texto.
--
-- Solo en la instalación del Grupo (el texto lo nombra) y solo si nadie ha
-- elegido aún otra presentación para el bloque ni le ha puesto un texto
-- delante. MariaDB puede guardar el JSON con o sin espacio tras los dos
-- puntos, así que se prueban las dos formas.

UPDATE `ContenidoPagina` SET `datos` = REPLACE(REPLACE(`datos`,
  '"bloques":[{"tipo":"contacto",', '"bloques":[{"tipo":"texto","titulo":"","html":"<h2>Escribe al Grupo Parroquial</h2><p>Cuéntanos lo que necesites: una duda sobre el alta, los cultos o la salida. La Secretaría te contesta por correo.</p>","presentacion":{"estilo":"carta"}},{"tipo":"contacto","presentacion":{"disposicion":"carta"},'),
  '"bloques": [{"tipo": "contacto",', '"bloques": [{"tipo": "texto", "titulo": "", "html": "<h2>Escribe al Grupo Parroquial</h2><p>Cuéntanos lo que necesites: una duda sobre el alta, los cultos o la salida. La Secretaría te contesta por correo.</p>", "presentacion": {"estilo": "carta"}}, {"tipo": "contacto", "presentacion": {"disposicion": "carta"},')
WHERE `slug` = 'contacto' AND `datos` LIKE '%Corregidor Paz Guzm%' AND `datos` NOT LIKE '%"disposicion"%';
