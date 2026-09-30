/**
 * Los actos de la Agenda en formato iCalendar (RFC 5545): uno suelto para
 * «Añadir a mi calendario» y la agenda entera para quien se suscribe desde
 * el móvil. Sin dependencias: el formato es texto con cuatro reglas.
 *
 * - Las horas van en la de Madrid (TZID=Europe/Madrid), con la zona declarada
 *   en el propio calendario: en UTC, un quinario que cruce el cambio de hora
 *   de marzo saldría una hora corrido desde ese día.
 * - Un acto de varios días (un triduo de 19:00 a 20:00 del 3 al 5) no es un
 *   bloque de tres días seguidos: es el mismo acto repetido cada día
 *   (RRULE:FREQ=DAILY;COUNT=3), para que en el móvil salga a su hora cada tarde.
 * - Sin hora de fin, una hora de duración.
 */

export interface ActoIcs {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  startDate: Date;
  endDate: Date | null;
  updatedAt: Date;
  dedicatoria?: string | null;
}

const UNA_HORA = 60 * 60 * 1000;
const ZONA = 'Europe/Madrid';

/** La zona de Madrid, para que cualquier calendario sepa pasar sus horas. */
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${ZONA}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

/** El día y la hora de un instante en Madrid: { dia: '20261103', hora: '190000' }. */
function enMadrid(fecha: Date) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(fecha).map((p) => [p.type, p.value]),
  );
  return { dia: `${partes.year}${partes.month}${partes.day}`, hora: `${partes.hour}${partes.minute}${partes.second}` };
}
const local = ({ dia, hora }: { dia: string; hora: string }) => `${dia}T${hora}`;
const aUtc = (dia: string) => Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(4, 6)) - 1, Number(dia.slice(6)));
const diasEntre = (a: string, b: string) => Math.round((aUtc(b) - aUtc(a)) / (24 * UNA_HORA));

/** 20261103T180000Z, para DTSTAMP, que siempre va en UTC. */
export const instanteIcs = (fecha: Date) => fecha.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Comas, puntos y coma, barras y saltos de línea van escapados. */
export const textoIcs = (texto: string) =>
  texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/**
 * Las líneas de más de 75 octetos se parten y siguen con un espacio. Se
 * cuentan octetos en UTF-8, no letras: «Señora» ocupa siete.
 */
export function plegar(linea: string): string {
  const trozos: string[] = [];
  let actual = '';
  let octetos = 0;
  for (const letra of linea) {
    const tam = Buffer.byteLength(letra, 'utf8');
    const limite = trozos.length === 0 ? 75 : 74;
    if (octetos + tam > limite) {
      trozos.push(actual);
      actual = '';
      octetos = 0;
    }
    actual += letra;
    octetos += tam;
  }
  trozos.push(actual);
  return trozos.join('\r\n ');
}

/**
 * El principio y el final del primer día, en hora de Madrid, y cuántos días
 * se repite. Un acto de varios días va cada día de su hora de inicio a su
 * hora de fin (o una hora, si la de fin no va después).
 */
export function horario(acto: Pick<ActoIcs, 'startDate' | 'endDate'>) {
  const inicio = enMadrid(acto.startDate);
  const unaHoraDespues = enMadrid(new Date(acto.startDate.getTime() + UNA_HORA));
  const { endDate } = acto;
  if (!endDate || endDate <= acto.startDate) return { desde: local(inicio), hasta: local(unaHoraDespues), dias: 1 };
  const fin = enMadrid(endDate);
  if (fin.dia === inicio.dia) return { desde: local(inicio), hasta: local(fin), dias: 1 };
  const hasta = fin.hora > inicio.hora ? local({ dia: inicio.dia, hora: fin.hora }) : local(unaHoraDespues);
  return { desde: local(inicio), hasta, dias: diasEntre(inicio.dia, fin.dia) + 1 };
}

function vevento(acto: ActoIcs, dominio: string, urlAgenda: string): string[] {
  const { desde, hasta, dias } = horario(acto);
  const resumen = acto.dedicatoria ? `${acto.title} ${acto.dedicatoria}` : acto.title;
  return [
    'BEGIN:VEVENT',
    `UID:evento-${acto.id}@${dominio}`,
    `DTSTAMP:${instanteIcs(acto.updatedAt)}`,
    `LAST-MODIFIED:${instanteIcs(acto.updatedAt)}`,
    `DTSTART;TZID=${ZONA}:${desde}`,
    `DTEND;TZID=${ZONA}:${hasta}`,
    ...(dias > 1 ? [`RRULE:FREQ=DAILY;COUNT=${dias}`] : []),
    `SUMMARY:${textoIcs(resumen)}`,
    ...(acto.location?.trim() ? [`LOCATION:${textoIcs(acto.location.trim())}`] : []),
    ...(acto.description?.trim() ? [`DESCRIPTION:${textoIcs(acto.description.trim())}`] : []),
    `URL:${urlAgenda}`,
    'END:VEVENT',
  ];
}

/**
 * Un calendario con los actos dados. Con `nombre`, es el de la suscripción.
 * `autor` es la corporación, que firma el PRODID: llega de fuera para que este
 * fichero siga sin depender de nada.
 */
export function calendarioIcs(actos: ActoIcs[], { urlWeb, nombre, autor }: { urlWeb: string; nombre?: string; autor: string }): string {
  const dominio = new URL(urlWeb).hostname;
  const urlAgenda = `${urlWeb.replace(/\/+$/, '')}/agenda`;
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${autor}//Agenda//ES`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...(nombre ? [
      `X-WR-CALNAME:${textoIcs(nombre)}`,
      `X-WR-TIMEZONE:${ZONA}`,
      // Cada cuánto vuelve a mirar un calendario suscrito: medio día.
      'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
      'X-PUBLISHED-TTL:PT12H',
    ] : []),
    ...VTIMEZONE,
    ...actos.flatMap((acto) => vevento(acto, dominio, urlAgenda)),
    'END:VCALENDAR',
  ];
  return lineas.map(plegar).join('\r\n') + '\r\n';
}

/** «solemne-triduo.ics»: el nombre del fichero, sin tildes ni signos. */
export const nombreDeFichero = (titulo: string) => {
  const limpio = titulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return `${limpio || 'acto'}.ics`;
};
