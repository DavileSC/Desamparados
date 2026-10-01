/**
 * El NIF de quien dona, para el Modelo 182 y su certificado: el de una
 * persona (DNI o NIE) o el de una entidad (CIF). Hacienda rechaza la línea
 * entera de un declarado con el NIF mal, así que se comprueba la letra o el
 * dígito de control al recogerlo, no al presentar.
 */

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';
const CONTROL_CIF = 'JABCDEFGHI';

/** «12.345.678-z» → «12345678Z»; los DNI cortos, con ceros delante (como `normalizarDni`). */
export function normalizarNif(valor: string): string {
  const limpio = valor.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  const dni = /^([0-9]{1,7})([A-Z])$/.exec(limpio);
  return dni ? dni[1].padStart(8, '0') + dni[2] : limpio;
}

function dniValido(n: string): boolean {
  if (!/^[XYZ0-9][0-9]{7}[A-Z]$/.test(n)) return false;
  const numero = Number(n.slice(0, -1).replace('X', '0').replace('Y', '1').replace('Z', '2'));
  return n.slice(-1) === LETRAS_DNI[numero % 23];
}

/** Los NIF de menores y extranjeros sin NIE (K, L, M) llevan la letra como un DNI. */
function klmValido(n: string): boolean {
  return /^[KLM][0-9]{7}[A-Z]$/.test(n) && n.slice(-1) === LETRAS_DNI[Number(n.slice(1, 8)) % 23];
}

function cifValido(n: string): boolean {
  const m = /^([ABCDEFGHJNPQRSUVW])([0-9]{7})([0-9A-J])$/.exec(n);
  if (!m) return false;
  const [, letra, cuerpo, control] = m;
  let suma = 0;
  for (let i = 0; i < 7; i++) {
    const d = Number(cuerpo[i]);
    // Las posiciones impares (1.ª, 3.ª…) se doblan y se suman sus cifras.
    suma += i % 2 === 0 ? Math.floor((d * 2) / 10) + ((d * 2) % 10) : d;
  }
  const digito = (10 - (suma % 10)) % 10;
  // Unas entidades llevan letra de control, otras cifra; el resto, cualquiera de las dos.
  if ('PQRSNW'.includes(letra)) return control === CONTROL_CIF[digito];
  if ('ABEH'.includes(letra)) return control === String(digito);
  return control === String(digito) || control === CONTROL_CIF[digito];
}

/** Si el NIF (ya normalizado) es bueno. */
export const nifValido = (n: string) => dniValido(n) || klmValido(n) || cifValido(n);

/**
 * La naturaleza del declarado en el Modelo 182: F, persona física; J,
 * jurídica; E, entidad en régimen de atribución de rentas (comunidades de
 * bienes y sociedades civiles: los CIF que empiezan por E y por J).
 */
export function naturalezaDelNif(n: string): 'F' | 'J' | 'E' {
  if (/^[0-9XYZKLM]/.test(n)) return 'F';
  if (/^[EJ]/.test(n)) return 'E';
  return 'J';
}
