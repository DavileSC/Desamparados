-- Los contadores de intentos fallidos (login, 2FA, cambio de contraseña, DNI)
-- y las redes confiadas pasan de la memoria del proceso a la base: antes
-- cada reinicio o despliegue levantaba todos los bloqueos. Empiezan vacías.

-- CreateTable
CREATE TABLE `FalloDeAcceso` (
    `contador` VARCHAR(40) NOT NULL,
    `clave` VARCHAR(320) NOT NULL,
    `fallos` INTEGER NOT NULL DEFAULT 0,
    `ultimoFallo` DATETIME(3) NOT NULL,
    `bloqueadoHasta` DATETIME(3) NOT NULL,
    `tandas` INTEGER NOT NULL DEFAULT 0,

    INDEX `FalloDeAcceso_contador_ultimoFallo_idx`(`contador`, `ultimoFallo`),
    PRIMARY KEY (`contador`, `clave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RedConfiada` (
    `clave` VARCHAR(320) NOT NULL,
    `vistaEn` DATETIME(3) NOT NULL,

    INDEX `RedConfiada_vistaEn_idx`(`vistaEn`),
    PRIMARY KEY (`clave`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

