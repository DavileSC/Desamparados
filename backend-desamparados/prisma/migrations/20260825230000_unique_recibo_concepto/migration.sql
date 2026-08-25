-- Evita generar dos veces la misma cuota para un hermano y año.
CREATE UNIQUE INDEX `Recibo_hermanoId_year_concepto_key`
ON `Recibo`(`hermanoId`, `year`, `concepto`);
