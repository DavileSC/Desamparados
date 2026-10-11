-- La situación de la invitación del primer acceso, para que Secretaría sepa
-- cuándo hay que reenviarla. El enlace de la invitación y el de «¿Has olvidado
-- tu contraseña?» comparten `resetPasswordToken`: pedir una recuperación dejaba
-- muerto el enlace del correo y el CMS seguía dándolo por bueno catorce días.
--
-- `invitacionCaducaEn`: hasta cuándo vale el enlace de la invitación; se
-- escribe con su token y se borra cuando algo lo gasta o lo sustituye.
-- `contrasenaPuestaEn`: la última vez que la cuenta puso su contraseña;
-- distingue «ya entró» de «su enlace lo pisó una recuperación sin usar».

-- AlterTable
ALTER TABLE `User` ADD COLUMN `contrasenaPuestaEn` DATETIME(3) NULL,
    ADD COLUMN `invitacionCaducaEn` DATETIME(3) NULL;

-- Las cuentas ya invitadas antes de esta migración. Solo se rellena lo que se
-- deduce con seguridad:
--
-- 1. Si el token que tiene caduca a los 14 días de `invitadoEn` (con una hora
--    de margen: `invitadoEn` se apunta segundos después de crear el token, al
--    salir el correo), es el de la invitación y sigue sin usar. Una
--    recuperación dura una hora y el enlace de emancipación tres días: no se
--    confunden. Caducada o no, la fecha es la suya.
UPDATE `User`
SET `invitacionCaducaEn` = `resetPasswordExpires`
WHERE `primerAccesoPendiente` = 1
  AND `invitadoEn` IS NOT NULL
  AND `resetPasswordToken` IS NOT NULL
  AND ABS(TIMESTAMPDIFF(SECOND, `resetPasswordExpires`, `invitadoEn` + INTERVAL 14 DAY)) <= 3600;

-- 2. Invitada y sin token: hasta ahora solo lo borraba poner la contraseña
--    (con el enlace o cambiándola), así que ya entró. La hora exacta no se
--    guardaba; `invitadoEn` es la cota más baja que se conoce, y lo que se
--    usa de este campo es que no sea nulo.
UPDATE `User`
SET `contrasenaPuestaEn` = `invitadoEn`
WHERE `primerAccesoPendiente` = 1
  AND `invitadoEn` IS NOT NULL
  AND `resetPasswordToken` IS NULL;

-- El resto (invitada, con un token que no es el de la invitación) no se puede
-- saber si entró antes de pedir la recuperación: queda como «su enlace ya no
-- vale», con el reenvío destacado. Reenviar a quien ya entró no le estorba;
-- callar un enlace muerto sí.
