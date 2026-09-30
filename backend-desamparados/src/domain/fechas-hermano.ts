import { HttpError } from '../utils/error.handle';
import { diaMadrid, esDiaValido, inicioDiaMadrid } from './contabilidad';

/**
 * Reglas de las fechas de la ficha (alta, baja y nacimiento).
 *
 * Vive aquí y no en el formulario porque el CMS no es el único que puede llamar
 * al endpoint: una regla que solo existe en la pantalla no es una regla.
 *
 * TODO se razona en el día de Madrid (el del Grupo Parroquial), no en el de
 * UTC. En la ficha conviven dos formas de guardar un día: el instante real (un
 * alta aprobada a las 00:30 de Málaga son las 22:30 UTC del día anterior) y la
 * medianoche UTC (el nacimiento que escribe el registro). `diaMadrid` lee bien
 * las dos; `toISOString().slice(0, 10)` se equivoca con la primera, y al
 * guardar la ficha movía el alta al día anterior (y de mes, si era día 1).
 */

/** El día de hoy como 'AAAA-MM-DD' en Madrid. */
export function diaDeHoy(ahora: Date = new Date()): string {
  return diaMadrid(ahora);
}

/** El día de Madrid de una fecha guardada. */
export const diaDe = (fecha: Date) => diaMadrid(fecha);

/** ¿Caen dos fechas en el mismo día de Madrid? Lo que no cambia de día no se reescribe. */
export const mismoDia = (a: Date | null | undefined, b: Date | null | undefined): boolean =>
  !!a && !!b && diaDe(a) === diaDe(b);

/**
 * 'AAAA-MM-DD' escrito en el CMS → instante que se guarda.
 * - Alta y baja: el comienzo de ese día en Madrid, como los apuntes contables
 *   (`inicioDiaMadrid`), para que se lea el mismo día en cualquier sitio que
 *   razone en Madrid (el panel, la auditoría, el propio formulario).
 * - Nacimiento: medianoche UTC, que es como lo guarda el registro y lo que
 *   esperan quienes lo leen como día UTC; en Madrid cae también el mismo día.
 * - Bautismo, jura y medalla: como el alta, el comienzo del día en Madrid.
 */
export function instanteDeDia(dia: string, campo: 'fechaAlta' | 'fechaBaja' | 'fechaNacimiento' | 'fechaBautismo' | 'fechaJura' | 'fechaMedalla'): Date {
  if (!esDiaValido(dia)) throw new HttpError(`Fecha inválida en ${campo}.`);
  if (campo === 'fechaNacimiento') {
    const [anio, mes, d] = dia.split('-').map(Number);
    return new Date(Date.UTC(anio, mes - 1, d));
  }
  return inicioDiaMadrid(dia);
}

/**
 * La baja no puede ser anterior al alta. Ya no fuerza nada más: antes, quitar
 * la baja reactivaba al hermano por la puerta de atrás (sin número, sin cuenta
 * y sin auditoría) y hasta activaba solicitudes pendientes sin aprobarlas. Las
 * altas y bajas van siempre por sus propias operaciones.
 */
export function comprobarFechasHermano(
  fechaAlta: Date | null | undefined,
  fechaBaja: Date | null | undefined,
): void {
  if (fechaAlta && fechaBaja && diaDe(fechaBaja) < diaDe(fechaAlta)) {
    throw new HttpError('La fecha de baja no puede ser anterior a la de alta.');
  }
}

/**
 * Una baja con fecha de mañana dejaría hoy fuera del censo a alguien que
 * todavía pertenece a él: la baja es de hoy o de antes.
 */
export function comprobarBajaNoFutura(fechaBaja: Date, hoy: string = diaDeHoy()): void {
  if (diaDe(fechaBaja) > hoy) {
    throw new HttpError('La fecha de baja no puede ser posterior a hoy.');
  }
}

/** Años cumplidos a día de hoy, contando el cumpleaños del año en curso. */
export function aniosCumplidos(fechaNacimiento: Date, hoy: string = diaDeHoy()): number {
  const [anio, mes, dia] = hoy.split('-').map(Number);
  const [anioNac, mesNac, diaNac] = diaDe(fechaNacimiento).split('-').map(Number);
  let edad = anio - anioNac;
  // Si el cumpleaños de este año aún no ha llegado, se le resta uno.
  if (mes < mesNac || (mes === mesNac && dia < diaNac)) edad -= 1;
  return edad;
}

export const MAYORIA_DE_EDAD = 18;

/**
 * La emancipación da una cuenta propia, con su contraseña y su acceso a la web:
 * solo para quien tiene 18 años cumplidos. Sin fecha de nacimiento no hay forma
 * de saberlo, y se pide completarla en vez de suponer nada.
 */
export function comprobarMayoriaDeEdad(fechaNacimiento: Date | null | undefined, hoy: string = diaDeHoy()): void {
  if (!fechaNacimiento || Number.isNaN(fechaNacimiento.getTime())) {
    throw new HttpError('Falta la fecha de nacimiento del hermano: complétala en su ficha antes de darle cuenta propia.');
  }
  if (aniosCumplidos(fechaNacimiento, hoy) < MAYORIA_DE_EDAD) {
    throw new HttpError(`Solo puede tener cuenta propia un hermano con ${MAYORIA_DE_EDAD} años cumplidos.`);
  }
}

/**
 * La regla espejo, para el alta: a quien se apunta como menor a cargo de otro
 * hay que comprobarle que de verdad lo es. Con 18 cumplidos no puede depender
 * de la cuenta de nadie —tiene que darse de alta él, con su DNI— o entraría en
 * el censo un adulto cuyos datos gestiona un tercero para siempre.
 *
 * El nacimiento futuro se descarta aquí y no en el esquema: la fecha llega como
 * 'AAAA-MM-DD' válida, y es esta función la que sabe qué día es hoy.
 */
export function comprobarEsMenor(fechaNacimiento: Date, quien: string, hoy: string = diaDeHoy()): void {
  const edad = aniosCumplidos(fechaNacimiento, hoy);
  if (edad < 0) {
    throw new HttpError(`Revisa la fecha de nacimiento de ${quien}: es una fecha futura.`);
  }
  if (edad >= MAYORIA_DE_EDAD) {
    throw new HttpError(
      `${quien} tiene ${MAYORIA_DE_EDAD} años cumplidos: con esa edad el alta la hace la propia persona, con su DNI.`
    );
  }
}

/** Y la de siempre, dicha para el alta: quien abre la cuenta es mayor de edad. */
export function comprobarEsAdulto(fechaNacimiento: Date, hoy: string = diaDeHoy()): void {
  const edad = aniosCumplidos(fechaNacimiento, hoy);
  if (edad < 0) {
    throw new HttpError('Revisa tu fecha de nacimiento: es una fecha futura.');
  }
  if (edad < MAYORIA_DE_EDAD) {
    throw new HttpError(
      `Para abrir una cuenta hacen falta ${MAYORIA_DE_EDAD} años. Si eres menor, tiene que apuntarte un adulto a su cargo.`
    );
  }
}
