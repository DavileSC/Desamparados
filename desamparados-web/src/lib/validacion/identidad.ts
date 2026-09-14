/**
 * Las reglas de identidad del alta, copiadas de las del servidor
 * (`backend-desamparados/src/config/common.ts`).
 *
 * Están duplicadas a la fuerza: son dos paquetes con su propio `package.json` y
 * no hay código compartido entre ellos. Lo que impide que se separen es la
 * tabla de casos de `shared/casos-identidad.json`, que ejecutan los tests de
 * los dos lados.
 *
 * Antes, el formulario admitía `/^[XYZ]?\d{7,8}[A-Z]$/i` —siete dígitos y sin
 * comprobar la letra— y el servidor exigía ocho con el módulo 23. Quien metía
 * un DNI que el navegador daba por bueno recibía un 400 del servidor que solo
 * decía «Error de validación».
 */

/** Fuera espacios y guiones, y a mayúsculas: «12345678-z» es el mismo DNI que «12345678Z». */
export function normalizarDni(valor: string): string {
  return valor.replace(/[\s-]/g, '').toUpperCase()
}

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE'

/** DNI o NIE con la letra calculada (módulo 23), igual que el servidor. */
export function esDniValido(valor: string): boolean {
  const dni = normalizarDni(valor)
  if (!/^[XYZ0-9][0-9]{7}[A-Z]$/.test(dni)) return false
  const letra = dni.slice(-1)
  // En un NIE la letra inicial vale por un dígito: X=0, Y=1, Z=2.
  const numero = Number(dni.slice(0, -1).replace('X', '0').replace('Y', '1').replace('Z', '2'))
  return letra === LETRAS_DNI[numero % 23]
}

/**
 * Fuera espacios, puntos y guiones, y el prefijo de España. El servidor guarda
 * nueve dígitos pelados, así que el formulario tiene que mandarlos así: quien
 * escribe «+34 600 12 34 56» está dando un teléfono válido.
 */
export function normalizarTelefono(valor: string): string {
  return valor.replace(/[\s.-]/g, '').replace(/^(\+34|0034)/, '')
}

export function esTelefonoValido(valor: string): boolean {
  return /^[0-9]{9}$/.test(normalizarTelefono(valor))
}

export function esCodigoPostalValido(valor: string): boolean {
  return /^[0-9]{5}$/.test(valor.trim())
}

/** El servidor rechaza `<` y `>` en todo texto libre (prevención de XSS). */
export function esTextoValido(valor: string): boolean {
  const texto = valor.trim()
  return texto.length > 0 && !/[<>]/.test(texto)
}
