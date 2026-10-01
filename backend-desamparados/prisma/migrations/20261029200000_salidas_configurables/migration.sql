-- Las salidas pasan de un enum en el código a filas que define el CMS. Las
-- dos de siempre se crean con lo que hoy está en el código y en la
-- configuración, y las papeletas, solicitudes y repartos se enlazan a ellas.

CREATE TABLE `Salida` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `conRopa` BOOLEAN NOT NULL DEFAULT false,
    `cobro` ENUM('CUOTA', 'DONATIVO') NOT NULL DEFAULT 'CUOTA',
    `importeCuota` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `fecha` ENUM('PASCUA', 'MANUAL') NOT NULL,
    `diasDesdePascua` INTEGER NULL,
    `horaSalida` VARCHAR(191) NULL,
    `lugar` VARCHAR(191) NULL,
    `eventoId` INTEGER NULL,
    `plazoAbierto` BOOLEAN NOT NULL DEFAULT false,
    `plazoCambiadoEl` DATETIME(3) NULL,
    `puestos` JSON NOT NULL,
    `cortejo` JSON NULL,
    `indicaciones` TEXT NULL,
    UNIQUE INDEX `Salida_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Salida` ADD CONSTRAINT `Salida_eventoId_fkey` FOREIGN KEY (`eventoId`) REFERENCES `Evento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- La Pasión: cuota de salida, hora y acceso, plazo y cortejo de la configuración.
-- Un cortejo guardado que no sea JSON válido haría fallar el INSERT: se deja
-- en null y la salida toma el cortejo por defecto.
INSERT INTO `Salida` (`slug`, `nombre`, `orden`, `conRopa`, `cobro`, `importeCuota`, `fecha`, `diasDesdePascua`,
  `horaSalida`, `lugar`, `plazoAbierto`, `plazoCambiadoEl`, `puestos`, `cortejo`, `indicaciones`)
SELECT 'sabado-de-pasion', 'Sábado de Pasión', 1, true, 'CUOTA',
  COALESCE((SELECT CAST(REPLACE(`value`, ',', '.') AS DECIMAL(8, 2)) FROM `Configuracion` WHERE `key` = 'precio_papeleta_sitio'), 0),
  'PASCUA', -8,
  (SELECT `value` FROM `Configuracion` WHERE `key` = 'procesion_hora'),
  (SELECT `value` FROM `Configuracion` WHERE `key` = 'procesion_acceso'),
  COALESCE((SELECT `value` = 'true' FROM `Configuracion` WHERE `key` = 'papeletas_abiertas'), false),
  (SELECT `updatedAt` FROM `Configuracion` WHERE `key` = 'papeletas_abiertas'),
  '[{"nombre":"Nazareno","tunica":true,"tocado":"CAPIROTE","alturaHombro":false},{"nombre":"Trono","tunica":true,"tocado":null,"alturaHombro":true},{"nombre":"Guardería","tunica":true,"tocado":"FARAONA","alturaHombro":false},{"nombre":"Viacrucis","tunica":true,"tocado":"CAPIROTE","alturaHombro":false},{"nombre":"Bocina","tunica":true,"tocado":"CAPIROTE","alturaHombro":false},{"nombre":"Diputado de tramo","tunica":true,"tocado":"CAPIROTE","alturaHombro":false},{"nombre":"Acólito","tunica":true,"tocado":null,"alturaHombro":false},{"nombre":"Monaguillo","tunica":true,"tocado":null,"alturaHombro":false},{"nombre":"Monaguillo guardería","tunica":true,"tocado":null,"alturaHombro":false},{"nombre":"Mayordomo guardería","tunica":true,"tocado":null,"alturaHombro":false},{"nombre":"Mantilla","tunica":false,"tocado":null,"alturaHombro":false}]',
  (SELECT IF(JSON_VALID(`value`), `value`, NULL) FROM `Configuracion` WHERE `key` = 'cortejo_PASION'),
  'Se ruega puntualidad y decoro en la vestimenta. Es obligatorio portar la medalla del Grupo Parroquial y calzado oscuro. Guarde silencio durante la formación.';

-- El Rosario: donativo, fecha a mano con el acto que ya tenga en la Agenda.
INSERT INTO `Salida` (`slug`, `nombre`, `orden`, `conRopa`, `cobro`, `fecha`, `eventoId`,
  `plazoAbierto`, `plazoCambiadoEl`, `puestos`, `cortejo`, `indicaciones`)
SELECT 'rosario-vespertino', 'Rosario vespertino', 2, false, 'DONATIVO', 'MANUAL',
  (SELECT e.`id` FROM `Evento` e JOIN `Configuracion` c ON c.`key` = 'rosario_evento_id' AND e.`id` = CAST(c.`value` AS INTEGER)),
  COALESCE((SELECT `value` = 'true' FROM `Configuracion` WHERE `key` = 'papeletas_abiertas_rosario'), false),
  (SELECT `updatedAt` FROM `Configuracion` WHERE `key` = 'papeletas_abiertas_rosario'),
  '[{"nombre":"Cruz de guía","tunica":false,"tocado":null,"alturaHombro":false},{"nombre":"Farol","tunica":false,"tocado":null,"alturaHombro":false},{"nombre":"Estandarte","tunica":false,"tocado":null,"alturaHombro":false},{"nombre":"Simpecado","tunica":false,"tocado":null,"alturaHombro":false},{"nombre":"Vela","tunica":false,"tocado":null,"alturaHombro":false},{"nombre":"Rezo de un misterio","tunica":false,"tocado":null,"alturaHombro":false},{"nombre":"Acólito","tunica":false,"tocado":null,"alturaHombro":false},{"nombre":"Trono","tunica":false,"tocado":null,"alturaHombro":true}]',
  (SELECT IF(JSON_VALID(`value`), `value`, NULL) FROM `Configuracion` WHERE `key` = 'cortejo_ROSARIO'),
  'Se va en traje oscuro, con la medalla del Grupo Parroquial. Se ruega puntualidad y recogimiento durante el rezo.';

-- Enlazar lo que ya existe. Nullable primero, se rellena y luego se exige.
ALTER TABLE `Turno` ADD COLUMN `salidaId` INTEGER NULL;
ALTER TABLE `PapeletaSitio` ADD COLUMN `salidaId` INTEGER NULL;
ALTER TABLE `Solicitud` ADD COLUMN `salidaId` INTEGER NULL;

UPDATE `Turno` t JOIN `Salida` s ON s.`slug` = IF(t.`salida` = 'PASION', 'sabado-de-pasion', 'rosario-vespertino') SET t.`salidaId` = s.`id`;
UPDATE `PapeletaSitio` p JOIN `Salida` s ON s.`slug` = IF(p.`salida` = 'PASION', 'sabado-de-pasion', 'rosario-vespertino') SET p.`salidaId` = s.`id`;
UPDATE `Solicitud` o JOIN `Salida` s ON s.`slug` = IF(o.`salida` = 'PASION', 'sabado-de-pasion', 'rosario-vespertino') SET o.`salidaId` = s.`id`;

ALTER TABLE `Turno` MODIFY `salidaId` INTEGER NOT NULL;
ALTER TABLE `PapeletaSitio` MODIFY `salidaId` INTEGER NOT NULL;
ALTER TABLE `Solicitud` MODIFY `salidaId` INTEGER NOT NULL;

-- La clave nueva antes de soltar la vieja: empieza por hermanoId y sostiene
-- la clave ajena del hermano (mismo truco que en mesa_por_zonas).
CREATE UNIQUE INDEX `PapeletaSitio_hermanoId_year_salidaId_key` ON `PapeletaSitio`(`hermanoId`, `year`, `salidaId`);
DROP INDEX `PapeletaSitio_hermanoId_year_salida_key` ON `PapeletaSitio`;
CREATE INDEX `PapeletaSitio_year_salidaId_idx` ON `PapeletaSitio`(`year`, `salidaId`);
DROP INDEX `PapeletaSitio_year_salida_idx` ON `PapeletaSitio`;
CREATE INDEX `Solicitud_hermanoId_year_salidaId_idx` ON `Solicitud`(`hermanoId`, `year`, `salidaId`);
DROP INDEX `Solicitud_hermanoId_year_salida_idx` ON `Solicitud`;
CREATE INDEX `Solicitud_year_salidaId_estado_idx` ON `Solicitud`(`year`, `salidaId`, `estado`);
DROP INDEX `Solicitud_year_salida_estado_idx` ON `Solicitud`;
CREATE INDEX `Turno_salidaId_idx` ON `Turno`(`salidaId`);

ALTER TABLE `Turno` DROP COLUMN `salida`;
ALTER TABLE `PapeletaSitio` DROP COLUMN `salida`;
ALTER TABLE `Solicitud` DROP COLUMN `salida`;

ALTER TABLE `Turno` ADD CONSTRAINT `Turno_salidaId_fkey` FOREIGN KEY (`salidaId`) REFERENCES `Salida`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `PapeletaSitio` ADD CONSTRAINT `PapeletaSitio_salidaId_fkey` FOREIGN KEY (`salidaId`) REFERENCES `Salida`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Solicitud` ADD CONSTRAINT `Solicitud_salidaId_fkey` FOREIGN KEY (`salidaId`) REFERENCES `Salida`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lo que vivía en la configuración y ahora vive en la salida.
DELETE FROM `Configuracion` WHERE `key` IN ('papeletas_abiertas', 'papeletas_abiertas_rosario', 'precio_papeleta_sitio',
  'rosario_evento_id', 'procesion_hora', 'procesion_acceso', 'procesion_fecha', 'cortejo_PASION', 'cortejo_ROSARIO');
