-- Se quita «Aprobar la entrada al CMS desde el móvil» (14-10-2026): el acceso vuelve a ser
-- solo con el código de la app. Los avisos a los hermanos usan su propia tabla (MovilDeAvisos).
-- DropForeignKey
ALTER TABLE `AprobacionEntrada` DROP FOREIGN KEY `AprobacionEntrada_userId_fkey`;

-- DropForeignKey
ALTER TABLE `MovilApuntado` DROP FOREIGN KEY `MovilApuntado_userId_fkey`;

-- DropTable
DROP TABLE `AprobacionEntrada`;

-- DropTable
DROP TABLE `MovilApuntado`;


-- El módulo y la plantilla del correo «Móvil apuntado» ya no existen.
DELETE FROM `Modulo` WHERE `clave` = 'avisos-en-el-movil';
DELETE FROM `PlantillaCorreo` WHERE `uso` = 'movil_apuntado';
