-- Auditoría del 11-09-2026.
-- `detalles`: estado anterior y nuevo de cada acción auditada, para que el
-- registro diga qué cambió y no solo sobre qué id.
-- `twoFactorLastStep`: último intervalo TOTP aceptado, para que un mismo código
-- de 6 dígitos no sirva dos veces dentro de su ventana.

-- AlterTable
ALTER TABLE `AuditLog` ADD COLUMN `detalles` JSON NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `twoFactorLastStep` INTEGER NULL;
