-- La Memoria del curso pasa a ser el Informe anual: el Grupo Parroquial lleva
-- su ejercicio por año natural (1 de enero – 31 de diciembre), no por cursos de
-- Sábado de Pasión a Sábado de Pasión. Se renombra la tabla y su clave, sin
-- borrar ni crear, para no perder los textos ya escritos (una fila que era del
-- curso 2026–2027 queda como la del año 2026).
RENAME TABLE `MemoriaCurso` TO `InformeAnual`;
ALTER TABLE `InformeAnual` RENAME COLUMN `curso` TO `anio`;
