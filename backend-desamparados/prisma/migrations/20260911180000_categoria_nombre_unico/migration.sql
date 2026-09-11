-- Una categoría contable no puede repetir nombre dentro de su tipo. El servicio
-- ya lo comprueba (sin distinguir mayúsculas, tildes ni la ñ, como la
-- intercalación utf8mb4_unicode_ci de la columna), pero dos altas simultáneas
-- podían colarse; el índice lo cierra en la base de datos.
--
-- Antes de esta migración nada impedía los repetidos, así que una base ya en
-- uso puede tenerlos («Donativos» y «donativos»): crear el índice sin más
-- fallaría con el error 1062 y dejaría la migración a medias. Primero se
-- fusionan: sobrevive la más antigua de cada grupo (menor id), se queda activa
-- si alguna del grupo lo estaba, y sus apuntes pasan a ella.
--
-- El agrupamiento usa la misma intercalación que el índice (GROUP BY y la
-- comparación de `nombre` la heredan de la columna), así que lo que el índice
-- consideraría repetido es exactamente lo que se fusiona.

CREATE TEMPORARY TABLE `_categoria_superviviente` AS
  SELECT MIN(`id`) AS `superviviente`, `tipo`, `nombre`, MAX(`activa`) AS `algunaActiva`
  FROM `CategoriaTransaccion`
  GROUP BY `tipo`, `nombre`;

UPDATE `Transaccion` t
  JOIN `CategoriaTransaccion` c ON c.`id` = t.`categoriaId`
  JOIN `_categoria_superviviente` s ON s.`tipo` = c.`tipo` AND s.`nombre` = c.`nombre`
  SET t.`categoriaId` = s.`superviviente`
  WHERE c.`id` <> s.`superviviente`;

UPDATE `CategoriaTransaccion` c
  JOIN `_categoria_superviviente` s ON s.`superviviente` = c.`id`
  SET c.`activa` = s.`algunaActiva`;

DELETE c FROM `CategoriaTransaccion` c
  JOIN `_categoria_superviviente` s ON s.`tipo` = c.`tipo` AND s.`nombre` = c.`nombre`
  WHERE c.`id` <> s.`superviviente`;

DROP TEMPORARY TABLE `_categoria_superviviente`;

-- CreateIndex
CREATE UNIQUE INDEX `CategoriaTransaccion_tipo_nombre_key` ON `CategoriaTransaccion`(`tipo`, `nombre`);
