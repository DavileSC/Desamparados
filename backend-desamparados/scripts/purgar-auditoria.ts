// Borra los registros de auditoría más antiguos que el plazo de retención.
//
// La auditoría guarda la IP y el navegador de cada acción, que son datos
// personales: el RGPD no deja guardarlos sin límite. El plazo lo marca
// AUDIT_RETENTION_DAYS (730 días por defecto: dos ejercicios contables
// completos) y la regla vive en AuditService.purgarAntiguos.
//
// Uso (desde backend-desamparados):
//   npm run auditoria:purgar
//
// En el servidor se ejecuta a diario con el timer de systemd descrito en
// docs/despliegue.md. Sale con código 1 si falla, para que systemd lo marque.
import 'dotenv/config';
import db from '../src/config/db.js';
import { AuditService } from '../src/services/audit.service.js';

try {
  const dias = Number(process.env.AUDIT_RETENTION_DAYS ?? 730);
  const borrados = await AuditService.purgarAntiguos(dias);
  console.log(`[Auditoría] Retención de ${dias} días: ${borrados} registro(s) borrado(s).`);
} catch (error) {
  console.error('[Auditoría] No se pudo purgar:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
