/**
 * El instante de una fecha y hora de Madrid (`AAAA-MM-DDTHH:mm`), sea cual sea
 * la zona de quien mira: el Sábado de Pasión sale a las 18:00 de Málaga
 * también para quien lo sigue desde Buenos Aires.
 */
export function instanteEnMadrid(fecha: string): number | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(fecha)
  if (!partes) return null
  const [anio, mes, dia, hora, minuto] = partes.slice(1).map(Number)
  const comoUtc = Date.UTC(anio, mes - 1, dia, hora, minuto)
  // Lo que marca un reloj de Madrid en ese instante UTC: la diferencia es el
  // desfase de ese día (una hora en invierno, dos en verano).
  const enMadrid = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(comoUtc))
  const valor = (tipo: string) => Number(enMadrid.find((p) => p.type === tipo)?.value)
  const desfase = Date.UTC(valor('year'), valor('month') - 1, valor('day'), valor('hour'), valor('minute')) - comoUtc
  return comoUtc - desfase
}
