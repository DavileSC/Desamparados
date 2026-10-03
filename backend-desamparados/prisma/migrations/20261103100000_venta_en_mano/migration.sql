-- La caja de la tienda pasa a «venta en mano»: el Grupo no tiene mostrador,
-- vende en mano de vez en cuando y lleva el efectivo al banco. Las ventas ya
-- no necesitan una caja abierta (las de antes conservan la suya), y lo que se
-- ingresa en el banco se apunta para que la partida doble lo pase de Caja a
-- Bancos y se sepa cuánto efectivo queda por ingresar.
-- Los nombres de tabla, con su mayúscula: en el servidor Linux la distinguen.

-- AlterTable
ALTER TABLE `CajaVenta` MODIFY `sesionId` INTEGER NULL;

-- CreateTable
CREATE TABLE `IngresoEfectivoTienda` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha` DATETIME(3) NOT NULL,
    `importe` DECIMAL(10, 2) NOT NULL,
    `nota` VARCHAR(300) NULL,
    `apuntadoPor` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `IngresoEfectivoTienda_fecha_idx`(`fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
