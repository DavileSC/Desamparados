/**
 * «ES91 2100 0418 4502 0005 1332» → «ES•• •••• •••• •••• •••• 1332»: el país y
 * los cuatro últimos, lo justo para que el hermano reconozca su cuenta sin que
 * la pantalla (o quien mire por encima del hombro) la tenga entera.
 */
export function enmascararIban(iban: string | null | undefined): string | null {
  if (!iban) return null;
  const limpio = iban.replace(/\s/g, '');
  if (limpio.length < 8) return '••••';
  const oculto = '•'.repeat(limpio.length - 8);
  const cuerpo = `${oculto}${limpio.slice(-4)}`.replace(/(.{4})/g, '$1 ').trim();
  return `${limpio.slice(0, 2)}•• ${cuerpo}`;
}
