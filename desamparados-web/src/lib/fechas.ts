/**
 * Las fechas como las piden los campos del formulario: el día y la hora de
 * aquí, no el ISO en UTC del servidor.
 *
 * `new Date().toISOString().slice(0, 10)` es lo que sale solo y está mal: a
 * las 00:30 de Málaga en verano devuelve el día anterior, y una noticia
 * guardada de madrugada aparecía fechada un día antes. Por eso se arma con
 * `getFullYear/getMonth/getDate`, que son locales.
 *
 * Estaba copiado en cada ficha del CMS («const hoy = () => …», tres veces) y
 * en los filtros de contabilidad, cada uno con su nombre.
 */

const dosCifras = (n: number) => String(n).padStart(2, '0')

/** El día de una fecha, en el formato de un `<input type="date">`. */
export const aDia = (fecha: Date) => `${fecha.getFullYear()}-${dosCifras(fecha.getMonth() + 1)}-${dosCifras(fecha.getDate())}`

/** Su hora, en el de un `<input type="time">`. */
export const aHora = (fecha: Date) => `${dosCifras(fecha.getHours())}:${dosCifras(fecha.getMinutes())}`

/** Hoy, aquí. */
export const hoy = () => aDia(new Date())
