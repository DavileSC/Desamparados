/**
 * Genera los correos del expediente de alta en storage/correos para poder
 * revisarlos con el navegador, sin base de datos y sin credenciales de Gmail.
 *
 *   npm run correos:muestra
 *
 * Fuerza el buzón de pruebas aunque el .env no lo tenga puesto, y se niega a
 * correr con NODE_ENV=production: es una herramienta de revisión, y en el
 * servidor mandaría correos de mentira a direcciones de ejemplo.
 *
 * No añade lógica propia: llama a los mismos métodos de EmailService que usan
 * el registro, la aprobación, el rechazo y la baja, así que lo que se ve aquí
 * es exactamente lo que recibe un hermano.
 */

import 'dotenv/config';

if (process.env.NODE_ENV?.trim() === 'production') {
  console.error('Este script no se ejecuta en producción.');
  process.exit(1);
}

process.env.EMAIL_BUZON_PRUEBAS = 'true';
process.env.CONTACT_EMAIL_TO ||= 'secretaria@ejemplo.local';
process.env.FRONTEND_URL ||= 'http://localhost:5173';

const { EmailService } = await import('../src/services/email.service.js');
const { carpetaCorreos } = await import('../src/utils/buzon-pruebas.js');

const SOLICITANTE = { nombre: 'Lucía', apellidos: 'Moreno Gil', email: 'lucia.moreno@ejemplo.local' };

await EmailService.enviarConfirmacionRegistro(SOLICITANTE.email, SOLICITANTE.nombre, { sexo: 'MUJER' });
await EmailService.enviarAvisoSolicitud(SOLICITANTE);
await EmailService.enviarAprobacionSolicitud(SOLICITANTE.email, SOLICITANTE.nombre, [{ ...SOLICITANTE, numeroHermano: 418 }], 'MUJER');
await EmailService.enviarBajaORechazo(SOLICITANTE.email, SOLICITANTE.nombre, 'rechazo', false, 'MUJER');
await EmailService.enviarBajaORechazo(SOLICITANTE.email, SOLICITANTE.nombre, 'baja', false, 'MUJER');
await EmailService.enviarBajaORechazo(SOLICITANTE.email, SOLICITANTE.nombre, 'baja', true, 'MUJER');

console.log(`\nListo. Los correos están en:\n  ${carpetaCorreos()}\n`);
console.log('Ábrelos con doble clic. Los bloques de horario y dirección no salen');
console.log('porque shared/datos-entidad.json los tiene todavía sin confirmar.');
