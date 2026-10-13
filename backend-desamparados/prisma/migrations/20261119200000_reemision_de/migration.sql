-- La reemisión de un recibo devuelto se enlaza con él (NG1, auditoría del
-- 13-10-2026). Hasta ahora contaba como reemisión cualquier recibo posterior
-- del mismo hermano, año y tipo: la papeleta de otra salida del mismo año
-- tapaba al devuelto de la primera y esa deuda dejaba de verse.

-- AlterTable
ALTER TABLE `Recibo` ADD COLUMN `reemisionDeId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Recibo_reemisionDeId_key` ON `Recibo`(`reemisionDeId`);

-- AddForeignKey
ALTER TABLE `Recibo` ADD CONSTRAINT `Recibo_reemisionDeId_fkey` FOREIGN KEY (`reemisionDeId`) REFERENCES `Recibo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Relleno de lo que ya existe. Todos los caminos que reemitían ponían
-- «(reemisión…» en el concepto (la mesa, el aviso del banco, el «Reemitir»
-- de Tesorería y la papeleta que se vuelve a sacar), y los recibos de otras
-- salidas no lo llevan: así que cada devuelto se enlaza con el primer recibo
-- posterior de su misma clave que se llame reemisión y, si los dos vienen de
-- una salida, de la misma salida. Un devuelto sin ninguno queda sin enlazar,
-- es decir, pendiente: mejor una deuda de más a la vista, que Tesorería puede
-- anular, que una oculta. Si dos devueltos apuntan al mismo, se queda el más
-- cercano (el de id mayor).
UPDATE `Recibo` AS r
JOIN (
  SELECT c.reemisionId, MAX(c.devueltoId) AS devueltoId
  FROM (
    SELECT d.id AS devueltoId, MIN(n.id) AS reemisionId
    FROM `Recibo` AS d
    JOIN `Recibo` AS n
      ON n.hermanoId = d.hermanoId AND n.year = d.year AND n.tipo = d.tipo
     AND n.id > d.id AND n.concepto LIKE '%(reemisi_n%'
    LEFT JOIN `Solicitud` AS sd ON sd.reciboId = d.id
    LEFT JOIN `Solicitud` AS sn ON sn.reciboId = n.id
    WHERE d.estado = 'DEVUELTO'
      AND (sd.salidaId IS NULL OR sn.salidaId IS NULL OR sd.salidaId = sn.salidaId)
    GROUP BY d.id
  ) AS c
  GROUP BY c.reemisionId
) AS x ON r.id = x.reemisionId
SET r.reemisionDeId = x.devueltoId;
