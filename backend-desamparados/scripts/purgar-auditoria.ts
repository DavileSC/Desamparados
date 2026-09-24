// Borra los registros de auditoría más antiguos que el plazo de retención.
//
// La auditoría guarda la IP y el navegador de cada acción, que son datos
// personales: el RGPD no deja guardarlos sin límite. El plazo lo marca
// AUDIT_RETENTION_DAYS (730 días por defecto: dos ejercicios contables
// completos) y la regla vive en AuditoriaService.purgarAntiguos.
//
// Uso (desde backend-desamparados):
//   npm run auditoria:purgar
//
// En el servidor se ejecuta a diario con el timer de systemd descrito en
// docs/despliegue.md. Sale con código 1 si falla, para que systemd lo marque.
//
// De paso olvida las claves de operación de la mesa de la procesión (ver
// services/procesion/una-vez.ts): solo sirven para los reintentos del día.
import 'dotenv/config';
import db from '../src/config/db.js';
import { AuditoriaService } from '../src/services/auditoria.service.js';
import { olvidarOperacionesViejas } from '../src/services/procesion/una-vez.js';

try {
  const dias = Number(process.env.AUDIT_RETENTION_DAYS ?? 730);
  const borrados = await AuditoriaService.purgarAntiguos(dias);
  console.log(`[Auditoría] Retención de ${dias} días: ${borrados} registro(s) borrado(s).`);
  const claves = await olvidarOperacionesViejas();
  console.log(`[Mesa] ${claves} clave(s) de operación antiguas olvidadas.`);
} catch (error) {
  console.error('[Auditoría] No se pudo purgar:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
