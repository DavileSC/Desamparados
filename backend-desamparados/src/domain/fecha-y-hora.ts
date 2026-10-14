/**
 * «8 de octubre de 2026, a las 18:05», en hora de Madrid: cuándo pasó algo de
 * la cuenta, para los correos que avisan de ello.
 */
export function fechaYHoraParaCorreo(fecha: Date): string {
  const dia = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long', year: 'numeric' }).format(fecha);
  const hora = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }).format(fecha);
  return `${dia}, a las ${hora}`;
}
