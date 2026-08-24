-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `dni` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `apellidos` VARCHAR(191) NOT NULL,
    `telefono` VARCHAR(191) NOT NULL,
    `direccion` VARCHAR(191) NULL,
    `poblacion` VARCHAR(191) NULL,
    `codigoPostal` VARCHAR(191) NULL,
    `role` ENUM('USER', 'ADMIN', 'TESORERIA', 'ALBACERIA', 'HERMANO_MAYOR', 'REDES', 'SECRETARIA') NOT NULL DEFAULT 'USER',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `twoFactorSecret` VARCHAR(191) NULL,
    `twoFactorEnabled` BOOLEAN NOT NULL DEFAULT false,
    `resetPasswordToken` VARCHAR(191) NULL,
    `resetPasswordExpires` DATETIME(3) NULL,
    `esJuntaDeGobierno` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_dni_key`(`dni`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Hermano` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `apellidos` VARCHAR(191) NOT NULL,
    `dni` VARCHAR(191) NULL,
    `fechaNacimiento` DATETIME(3) NOT NULL,
    `telefono` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `direccion` VARCHAR(191) NULL,
    `poblacion` VARCHAR(191) NULL,
    `codigoPostal` VARCHAR(191) NULL,
    `fechaAlta` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `numeroHermano` INTEGER NULL,
    `fechaBaja` DATETIME(3) NULL,
    `esTitular` BOOLEAN NOT NULL DEFAULT false,
    `userId` INTEGER NOT NULL,
    `tieneTunicaPropia` BOOLEAN NOT NULL DEFAULT false,
    `tunica` VARCHAR(191) NULL,
    `alturaHombro` INTEGER NULL,
    `puesto` VARCHAR(191) NULL,
    `formaPagoPref` ENUM('EFECTIVO', 'BIZUM', 'TRANSFERENCIA', 'TARJETA', 'DOMICILIACION') NOT NULL DEFAULT 'EFECTIVO',
    `iban` VARCHAR(191) NULL,
    `titularCuenta` VARCHAR(191) NULL,

    UNIQUE INDEX `Hermano_dni_key`(`dni`),
    UNIQUE INDEX `Hermano_numeroHermano_key`(`numeroHermano`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Turno` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fecha` DATETIME(3) NOT NULL,
    `horaInicio` DATETIME(3) NOT NULL,
    `horaFin` DATETIME(3) NOT NULL,
    `capacidadEstimada` INTEGER NOT NULL DEFAULT 100,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Cita` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `estado` ENUM('RESERVADA', 'ATENDIDA', 'CANCELADA', 'NO_PRESENTADO') NOT NULL DEFAULT 'RESERVADA',
    `turnoId` INTEGER NOT NULL,
    `hermanoId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Cita_hermanoId_turnoId_key`(`hermanoId`, `turnoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CategoriaTransaccion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `tipo` ENUM('INGRESO', 'GASTO') NOT NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transaccion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` ENUM('INGRESO', 'GASTO') NOT NULL,
    `categoriaId` INTEGER NOT NULL,
    `concepto` VARCHAR(191) NOT NULL,
    `importe` DECIMAL(10, 2) NOT NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `metodoPago` ENUM('EFECTIVO', 'BIZUM', 'TRANSFERENCIA', 'TARJETA', 'DOMICILIACION') NULL,
    `hermanoId` INTEGER NULL,
    `reciboId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Transaccion_reciboId_key`(`reciboId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Recibo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `concepto` VARCHAR(191) NOT NULL,
    `importe` DECIMAL(10, 2) NOT NULL,
    `fechaEmision` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tipo` ENUM('PAPELETA_SITIO', 'CUOTA_HERMANO', 'DONATIVO', 'OTRO') NOT NULL DEFAULT 'PAPELETA_SITIO',
    `estado` ENUM('PENDIENTE', 'REMESADO', 'PAGADO', 'DEVUELTO', 'ANULADO', 'EXENTO') NOT NULL DEFAULT 'PENDIENTE',
    `fechaPago` DATETIME(3) NULL,
    `metodoPago` ENUM('EFECTIVO', 'BIZUM', 'TRANSFERENCIA', 'TARJETA', 'DOMICILIACION') NULL,
    `observaciones` TEXT NULL,
    `hermanoId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Recibo_year_idx`(`year`),
    INDEX `Recibo_hermanoId_idx`(`hermanoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PapeletaSitio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `year` INTEGER NOT NULL,
    `puesto` VARCHAR(191) NOT NULL,
    `tramo` VARCHAR(191) NULL,
    `numero` INTEGER NULL,
    `numTunicaAsignada` VARCHAR(191) NULL,
    `numCapiroteAsignado` VARCHAR(191) NULL,
    `observaciones` VARCHAR(191) NULL,
    `hermanoId` INTEGER NOT NULL,
    `reciboId` INTEGER NOT NULL,
    `citaId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PapeletaSitio_reciboId_key`(`reciboId`),
    UNIQUE INDEX `PapeletaSitio_citaId_key`(`citaId`),
    INDEX `PapeletaSitio_year_idx`(`year`),
    UNIQUE INDEX `PapeletaSitio_hermanoId_year_key`(`hermanoId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Evento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `location` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `visibility` ENUM('public', 'members_only') NOT NULL DEFAULT 'public',
    `type` ENUM('CULTO', 'PROCESION', 'FORMACION', 'ENSAYO', 'REUNION', 'SOCIAL', 'OTRO') NOT NULL DEFAULT 'OTRO',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Evento_startDate_idx`(`startDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Enser` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre` VARCHAR(191) NOT NULL,
    `referencia` VARCHAR(191) NULL,
    `categoria` VARCHAR(191) NULL,
    `ubicacion` VARCHAR(191) NULL,
    `cantidadOptimo` INTEGER NOT NULL DEFAULT 0,
    `cantidadBueno` INTEGER NOT NULL DEFAULT 0,
    `cantidadReparar` INTEGER NOT NULL DEFAULT 0,
    `cantidadTotal` INTEGER NOT NULL DEFAULT 0,
    `imagenUrl` VARCHAR(191) NULL,
    `fechaAdquisicion` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Prenda` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `numero` VARCHAR(191) NOT NULL,
    `tipo` ENUM('TUNICA', 'CAPIROTE', 'FARAONA', 'CAPA', 'OTRO') NOT NULL,
    `talla` VARCHAR(191) NULL,
    `estado` ENUM('DISPONIBLE', 'PRESTADA', 'TALLER', 'BAJA') NOT NULL DEFAULT 'DISPONIBLE',
    `observaciones` VARCHAR(191) NULL,
    `hermanoId` INTEGER NULL,
    `fechaAsignacion` DATETIME(3) NULL,

    UNIQUE INDEX `Prenda_numero_key`(`numero`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Noticia` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `extracto` VARCHAR(191) NULL,
    `contenido` TEXT NOT NULL,
    `imagenUrl` VARCHAR(191) NULL,
    `fecha` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `visible` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Noticia_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Configuracion` (
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pagina` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `contenido` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Pagina_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_TurnosResponsables` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_TurnosResponsables_AB_unique`(`A`, `B`),
    INDEX `_TurnosResponsables_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Hermano` ADD CONSTRAINT `Hermano_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cita` ADD CONSTRAINT `Cita_turnoId_fkey` FOREIGN KEY (`turnoId`) REFERENCES `Turno`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Cita` ADD CONSTRAINT `Cita_hermanoId_fkey` FOREIGN KEY (`hermanoId`) REFERENCES `Hermano`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaccion` ADD CONSTRAINT `Transaccion_categoriaId_fkey` FOREIGN KEY (`categoriaId`) REFERENCES `CategoriaTransaccion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaccion` ADD CONSTRAINT `Transaccion_hermanoId_fkey` FOREIGN KEY (`hermanoId`) REFERENCES `Hermano`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaccion` ADD CONSTRAINT `Transaccion_reciboId_fkey` FOREIGN KEY (`reciboId`) REFERENCES `Recibo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Recibo` ADD CONSTRAINT `Recibo_hermanoId_fkey` FOREIGN KEY (`hermanoId`) REFERENCES `Hermano`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PapeletaSitio` ADD CONSTRAINT `PapeletaSitio_hermanoId_fkey` FOREIGN KEY (`hermanoId`) REFERENCES `Hermano`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PapeletaSitio` ADD CONSTRAINT `PapeletaSitio_reciboId_fkey` FOREIGN KEY (`reciboId`) REFERENCES `Recibo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PapeletaSitio` ADD CONSTRAINT `PapeletaSitio_citaId_fkey` FOREIGN KEY (`citaId`) REFERENCES `Cita`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Prenda` ADD CONSTRAINT `Prenda_hermanoId_fkey` FOREIGN KEY (`hermanoId`) REFERENCES `Hermano`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_TurnosResponsables` ADD CONSTRAINT `_TurnosResponsables_A_fkey` FOREIGN KEY (`A`) REFERENCES `Turno`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_TurnosResponsables` ADD CONSTRAINT `_TurnosResponsables_B_fkey` FOREIGN KEY (`B`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
