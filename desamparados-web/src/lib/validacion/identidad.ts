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

/**
 * El DNI como se guarda: ocho cifras y la letra, o la X, Y o Z, siete cifras y
 * la letra. «12.345.678-z» es el mismo DNI que «12345678Z».
 *
 * Los DNI antiguos empiezan por ceros y casi nadie los escribe: «123456S» es el
 * 00123456S, con su letra bien. Antes se rechazaban por tener menos de ocho
 * cifras. Tampoco pasaban los NIE antiguos con ocho cifras tras la X, cuya
 * primera es un cero de relleno. La letra se sigue comprobando igual.
 */
export function normalizarDni(valor: string): string {
  const limpio = valor.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
  const dni = /^([0-9]{1,7})([A-Z])$/.exec(limpio)
  if (dni) return dni[1].padStart(8, '0') + dni[2]
  const nie = /^([XYZ])0([0-9]{7}[A-Z])$/.exec(limpio)
  if (nie) return nie[1] + nie[2]
  return limpio
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

/** El IBAN como lo guarda el servidor: sin espacios ni guiones y en mayúsculas. */
export function normalizarIban(valor: string): string {
  return valor.replace(/[\s-]/g, '').toUpperCase()
}

/**
 * IBAN con su dígito de control (módulo 97), igual que el servidor: una cuenta
 * mal copiada es un recibo que el banco devuelve. Un IBAN español, 24 caracteres.
 */
export function esIbanValido(valor: string): boolean {
  const iban = normalizarIban(valor)
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  if (iban.startsWith('ES') && iban.length !== 24) return false
  const reordenado = iban.slice(4) + iban.slice(0, 4)
  let resto = 0
  for (const caracter of reordenado) {
    const cifras = /[A-Z]/.test(caracter) ? String(caracter.charCodeAt(0) - 55) : caracter
    for (const cifra of cifras) resto = (resto * 10 + Number(cifra)) % 97
  }
  return resto === 1
}
