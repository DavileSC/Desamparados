-- Módulos del CMS activables por instalación: una fila por módulo del catálogo
-- (shared/modulos.json) con su interruptor. La siembra crea las que falten con
-- el lote inicial de shared/datos-entidad.json y no toca las que ya existen.
-- CreateTable
CREATE TABLE `Modulo` (
    `clave` VARCHAR(40) NOT NULL,
    `activo` BOOLEAN NOT NULL,
    `cambiadoEl` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `cambiadoPor` VARCHAR(120) NULL,

    PRIMARY KEY (`clave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

