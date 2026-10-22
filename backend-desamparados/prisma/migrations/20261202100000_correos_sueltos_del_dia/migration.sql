-- Los correos que salen al momento (un alta, una contraseña, un justificante)
-- cuentan para el tope diario de la cola: el servicio de envío tiene uno para
-- todos, y sin contarlos la cola gastaba el cupo de los urgentes.
-- (El nombre de la tabla va con su mayúscula: en Linux MariaDB distingue.)

-- CreateTable
CREATE TABLE `CorreosSueltosDelDia` (
    `dia` CHAR(10) NOT NULL,
    `enviados` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`dia`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
