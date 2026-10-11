/**
 * Rechazo de contraseñas evidentes.
 *
 * El validador solo exigía entre 8 y 64 caracteres, así que `12345678` era
 * válida. La longitud protege más que obligar a meter símbolos raros —que la
 * gente resuelve siempre igual, con `Contrasena1!`—, de modo que aquí se sube
 * el mínimo y se descartan además los patrones que un atacante prueba primero.
 *
 * No pretende sustituir a una lista de filtraciones tipo HaveIBeenPwned: cubre
 * lo que aparece en los primeros miles de intentos de un ataque por diccionario,
 * sin añadir dependencias ni llamadas de red al registro.
 */
export const LONGITUD_MINIMA = 12;
const LONGITUD_MAXIMA = 64;

/** Contraseñas y raíces que aparecen en cabeza de cualquier diccionario. */
const RAICES_PROHIBIDAS = [
  'password', 'contrasena', 'contraseña', 'passwd', 'admin', 'administrador',
  'qwerty', 'qwertyui', 'asdfgh', 'zxcvbn', '123456', 'abcdef',
  'iloveyou', 'teamo', 'welcome', 'bienvenido', 'letmein', 'secret',
  'usuario', 'invitado', 'default', 'cambiame', 'changeme',
  // Propias del proyecto: las primeras que probaría alguien que lo conozca.
  'desamparados', 'hermandad', 'grupoparroquial', 'cofradia', 'malaga',
  'semanasanta', 'parroquia', 'pasionistas',
];

/** Sustituciones con las que se suele disfrazar una palabra: `P4ssw0rd!`. */
const DISFRACES: Record<string, string> = {
  '0': 'o', '4': 'a', '1': 'i', '3': 'e', '5': 's', '7': 't', '$': 's', '@': 'a',
};

/** Normaliza para que un disfraz o un acento no basten para esquivar la lista. */
function normalizar(valor: string): string {
  return valor
    .toLowerCase()
    // NFD separa la letra de su tilde, y \p{Diacritic} borra la tilde suelta.
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[0413570$@]/g, (c) => DISFRACES[c] ?? c)
    .replace(/[^a-z0-9]/g, '');
}

/** `true` si la cadena es un solo carácter repetido: `aaaaaaaaaaaa`. */
function esUnSoloCaracter(valor: string): boolean {
  return new Set(valor).size === 1;
}

/** `true` si son dígitos o letras consecutivos: `abcdefghijkl`, `987654321098`. */
function esSecuencia(valor: string): boolean {
  const normal = valor.toLowerCase();

  // Solo dígitos: se compara módulo 10 porque `123456789012` da la vuelta de 9
  // a 0 y aun así es exactamente lo que la gente teclea.
  if (/^[0-9]+$/.test(normal)) {
    const digitos = [...normal].map(Number);
    const sigue = (paso: number) =>
      digitos.every((d, i) => i === 0 || d === (digitos[i - 1] + paso + 10) % 10);
    return sigue(1) || sigue(-1);
  }

  let ascendente = true;
  let descendente = true;
  for (let i = 1; i < normal.length; i++) {
    const salto = normal.charCodeAt(i) - normal.charCodeAt(i - 1);
    if (salto !== 1) ascendente = false;
    if (salto !== -1) descendente = false;
  }
  return ascendente || descendente;
}

/**
 * Motivo por el que la contraseña no vale, o `null` si es aceptable.
 * El motivo se devuelve para poder decírselo a la persona: un «contraseña no
 * válida» a secas solo consigue que lo intente otras cinco veces.
 *
 * `laCorporacion` («el Grupo Parroquial») llega de fuera y no se importa: la
 * web incluye este módulo en su bundle, y la identidad de la API se lee del
 * disco, que en el navegador no hay. Cada lado pasa la suya.
 */
export function motivoContrasenaDebil(valor: string, laCorporacion: string): string | null {
  if (valor.length < LONGITUD_MINIMA) {
    return `debe tener al menos ${LONGITUD_MINIMA} caracteres`;
  }
  if (valor.length > LONGITUD_MAXIMA) {
    return `no puede pasar de ${LONGITUD_MAXIMA} caracteres`;
  }
  if (esUnSoloCaracter(valor)) {
    return 'no puede ser un mismo carácter repetido';
  }
  if (esSecuencia(valor)) {
    return 'no puede ser una secuencia de caracteres seguidos';
  }

  const normalizada = normalizar(valor);
  for (const raiz of RAICES_PROHIBIDAS) {
    const raizNormalizada = normalizar(raiz);
    if (!normalizada.includes(raizNormalizada)) continue;

    // Se quitan TODAS las apariciones, no una: `MalagaMalaga` es tan débil como
    // `Malaga`, y descontar solo la primera la dejaba pasar por longitud. Si lo
    // que sobra no llega a cinco caracteres, la contraseña *es* esa palabra con
    // adornos —`Desamparados2026`— y no una frase que la contenga.
    const resto = normalizada.split(raizNormalizada).join('');
    if (resto.length < 5) {
      return `es demasiado fácil de adivinar: evita palabras comunes o relacionadas con ${laCorporacion}`;
    }
  }

  return null;
}

/** `true` si la contraseña supera todas las comprobaciones. */
export function esContrasenaAceptable(valor: string): boolean {
  // El motivo no se enseña: la frase de la corporación da igual.
  return motivoContrasenaDebil(valor, '') === null;
}
