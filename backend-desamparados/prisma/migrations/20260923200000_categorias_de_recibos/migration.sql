-- Lo que entra por los recibos deja de ir todo a «Cuotas y papeletas»: cada
-- tipo de recibo tiene su categoría, para que Contabilidad distinga cuánto
-- entra por cuotas, por papeletas o por donativos. Y nace «Comisiones
-- bancarias», para lo que cobra el banco al devolver un recibo.

-- 1. Las categorías nuevas (las que ya existan, como «Donativos», se quedan).
INSERT IGNORE INTO `CategoriaTransaccion` (`nombre`, `tipo`, `activa`, `createdAt`, `updatedAt`) VALUES
  ('Cuotas de hermanos', 'INGRESO', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('Papeletas de sitio', 'INGRESO', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('Donativos', 'INGRESO', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('Otros recibos', 'INGRESO', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  ('Comisiones bancarias', 'GASTO', true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

-- Los recibos las usan siempre: si alguna estaba desactivada, vuelve.
UPDATE `CategoriaTransaccion`
SET `activa` = true, `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `activa` = false
  AND ((`tipo` = 'INGRESO' AND `nombre` IN ('Cuotas de hermanos', 'Papeletas de sitio', 'Donativos', 'Otros recibos'))
    OR (`tipo` = 'GASTO' AND `nombre` = 'Comisiones bancarias'));

-- 2. Los ingresos ya apuntados de cada recibo, a la categoría de su tipo.
UPDATE `Transaccion` t
JOIN `Recibo` r ON r.`id` = t.`reciboId`
JOIN `CategoriaTransaccion` c ON c.`tipo` = 'INGRESO' AND c.`nombre` = CASE r.`tipo`
    WHEN 'CUOTA_HERMANO' THEN 'Cuotas de hermanos'
    WHEN 'PAPELETA_SITIO' THEN 'Papeletas de sitio'
    WHEN 'DONATIVO' THEN 'Donativos'
    ELSE 'Otros recibos'
  END
SET t.`categoriaId` = c.`id`
WHERE t.`tipo` = 'INGRESO';

-- 3. Un gasto de un recibo que nunca tuvo ingreso no puede ser el reverso de
-- un cobro (la aplicación exige el ingreso para apuntarlo): es lo que cobró el
-- banco al devolverlo. En producción no hay ninguno; los datos de demostración
-- los traían así.
UPDATE `Transaccion` t
JOIN `CategoriaTransaccion` c ON c.`tipo` = 'GASTO' AND c.`nombre` = 'Comisiones bancarias'
SET t.`categoriaId` = c.`id`
WHERE t.`tipo` = 'GASTO'
  AND t.`reciboId` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM (SELECT `reciboId` FROM `Transaccion` WHERE `tipo` = 'INGRESO' AND `reciboId` IS NOT NULL) i
    WHERE i.`reciboId` = t.`reciboId`
  );

-- 4. «Cuotas y papeletas» se queda vacía: se borra. Si alguien le hubiera
-- metido apuntes a mano, se conserva (desactivada no: sigue siendo suya).
DELETE c FROM `CategoriaTransaccion` c
LEFT JOIN `Transaccion` t ON t.`categoriaId` = c.`id`
WHERE c.`tipo` = 'INGRESO' AND c.`nombre` = 'Cuotas y papeletas' AND t.`id` IS NULL;
