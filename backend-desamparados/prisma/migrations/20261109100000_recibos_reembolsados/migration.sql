-- Un reembolso (papeleta anulada o solicitud cancelada con el donativo pagado)
-- deja de ser DEVUELTO: DEVUELTO es «el banco no lo cobró» y cuenta como
-- deuda, se reemite y se puede pagar en línea; un reembolso no se debe.
ALTER TABLE `Recibo` MODIFY `estado` ENUM('PENDIENTE', 'REMESADO', 'PAGADO', 'DEVUELTO', 'ANULADO', 'EXENTO', 'REEMBOLSADO') NOT NULL DEFAULT 'PENDIENTE';

-- Los reembolsos ya hechos se reconocen por la nota que dejaba la mesa
-- (NOTA_ANULACION y NOTA_CANCELACION en papeletas.service.ts).
UPDATE `Recibo`
SET `estado` = 'REEMBOLSADO'
WHERE `estado` = 'DEVUELTO'
  AND (`observaciones` LIKE '%Anulado por devolución de la papeleta de sitio.%'
    OR `observaciones` LIKE '%Devuelto al cancelar la solicitud de salida.%');
