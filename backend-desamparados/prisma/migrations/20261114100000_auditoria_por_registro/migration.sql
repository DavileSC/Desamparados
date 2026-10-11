-- FR9: el historial de un registro se busca por tipo e id (la supresión RGPD
-- de una cuenta y sus fichas). Sin índice, recorría la auditoría entera.
CREATE INDEX `AuditLog_entityType_entityId_idx` ON `AuditLog`(`entityType`, `entityId`);
