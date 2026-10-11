import { diaMadrid } from './contabilidad.js';

/**
 * Los aniversarios de los hermanos difuntos: cuándo toca el próximo y cuántos
 * años hace. Todo en días de Madrid: un fallecimiento del 3 de noviembre es
 * del 3 de noviembre aunque se apuntara a medianoche en hora universal.
 */

interface Aniversario {
  /** El día del próximo aniversario, AAAA-MM-DD (hoy, si es hoy). */
  dia: string;
  /** Los años que se cumplen ese día. */
  anios: number;
  /** Cuántos días faltan (0 si es hoy). */
  faltan: number;
}

const aUtc = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};

/**
 * El próximo aniversario de un fallecimiento, contado desde `hoy`. Un 29 de
 * febrero se recuerda el 28 en los años que no lo tienen. En el mismo año del
 * fallecimiento no hay aniversario: el primero es al año siguiente.
 */
export function proximoAniversario(defuncion: Date, hoy: Date): Aniversario {
  const [anio, mes, dia] = diaMadrid(defuncion).split('-').map(Number);
  const hoyDia = diaMadrid(hoy);
  const hoyAnio = Number(hoyDia.slice(0, 4));
  const enAnio = (a: number) => {
    const ultimo = new Date(Date.UTC(a, mes, 0)).getUTCDate();
    return `${a}-${String(mes).padStart(2, '0')}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`;
  };
  let a = Math.max(hoyAnio, anio + 1);
  if (enAnio(a) < hoyDia) a += 1;
  const cuando = enAnio(a);
  return { dia: cuando, anios: a - anio, faltan: Math.round((aUtc(cuando) - aUtc(hoyDia)) / 86_400_000) };
}

/** Los años que fue hermano, del alta al fallecimiento (completos). */
export function aniosDeHermano(alta: Date, defuncion: Date): number {
  const [a1, m1, d1] = diaMadrid(alta).split('-').map(Number);
  const [a2, m2, d2] = diaMadrid(defuncion).split('-').map(Number);
  return Math.max(0, a2 - a1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0));
}
