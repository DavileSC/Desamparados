/**
 * La cuenta de custodia: de ella cuelgan las fichas del censo importado que
 * no tienen cuenta propia (y las que un titular devuelve con «No es de mi
 * familia»). No es de nadie: su correo, su DNI, su nombre y su teléfono son
 * relleno, porque `User` los exige.
 *
 * Por eso no se enseñan nunca como datos de una ficha: el CMS caía en el
 * teléfono de la cuenta cuando la ficha no traía uno y salía «000000000», y
 * las demás fichas de la custodia no son su familia (salían como tal en la
 * mesa, en el ropero y como a quién dar el pésame).
 */
export const CUENTA_CENSO_IMPORTADO = {
  email: 'censo-importado@cuentas.invalido',
  dni: 'CENSO-IMPORTADO',
  nombre: 'Censo',
  apellidos: 'importado',
  telefono: '000000000',
};

/** Si esa cuenta es la de custodia. Se reconoce por el correo, que es único y no puede ser de nadie. */
export const esCuentaDeCustodia = (cuenta: { email: string } | null | undefined): boolean =>
  cuenta?.email === CUENTA_CENSO_IMPORTADO.email;

/** La ficha sin su cuenta (`user` a null) si cuelga de la de custodia. */
export const sinCuentaDeCustodia = <T extends { user: { email: string } | null }>(ficha: T): T | (Omit<T, 'user'> & { user: null }) =>
  esCuentaDeCustodia(ficha.user) ? { ...ficha, user: null } : ficha;

/**
 * Si una dirección no es de nadie: las del dominio reservado `.invalido`, que
 * es el de la cuenta de custodia y el de las fichas de la demo. Ningún correo
 * debe salir hacia ellas (rebotaría en el buzón de Secretaría); para quien
 * envía, es lo mismo que no tener correo.
 */
export const esDireccionDeNadie = (email: string): boolean => /\.invalido$/i.test(email.trim());
