import { type } from 'arktype';
import { motivoContrasenaDebil } from '../domain/password-debil.js';

// --- TIPOS REUTILIZABLES CON MENSAJES EN ESPAÑOL ---

// 1. Texto obligatorio SIN caracteres HTML (Prevención XSS)
export const textoRequerido = type("string")
    .narrow((s) => s.trim().length > 0)
    .matching(/^[^<>]+$/) // Prohíbe inyección de etiquetas HTML
    .describe("un texto válido sin caracteres especiales (<, >)");

// Email: una sola dirección, de 254 caracteres como mucho (el máximo del
// estándar). Sin tope y admitiendo comas, el formulario público de contacto
// dejaba mandar sin sesión una «dirección» enorme con miles de comas que el
// analizador de direcciones de nodemailer procesaba en tiempo cuadrático, y una
// lista separada por comas se convierte en varios destinatarios. Por eso se
// excluyen los separadores y la sintaxis de nombre (`,;<>()":[]\`), que ninguna
// dirección real necesita.
export const email = type("string <= 254")
    .matching(/^[^\s@,;<>()":\\[\]]+@[^\s@,;<>()":\\[\]]+\.[^\s@,;<>()":\\[\]]+$/)
    .describe("un email válido");

// 2. Contraseña: longitud mínima real, tope máximo (previene DoS en bcrypt)
// y rechazo de las que se adivinan a la primera. Las reglas viven en
// src/domain/password-debil.ts para poder probarlas sin base de datos.
export const password = type("string")
    .narrow((valor, ctx) => {
        const motivo = motivoContrasenaDebil(valor);
        return motivo === null || ctx.reject({ problem: `la contraseña ${motivo}` });
    });

// Teléfono español (9 dígitos)
export const telefono = type("string")
    .matching(/^[0-9]{9}$/)
    .describe("un teléfono válido (9 dígitos)");

// Texto opcional de la ficha (profesión, parroquia, provincia...): puede ir
// vacío, y como todo texto libre, sin «<» ni «>».
export const textoOpcional = type("string <= 160")
    .matching(/^[^<>]*$/)
    .describe("un texto sin «<» ni «>», de 160 caracteres como mucho");

// IBAN: sin espacios y en mayúsculas, con el dígito de control comprobado
// (módulo 97, ISO 13616). El hermano lo cambia él mismo desde su área, y una
// cuenta mal copiada es un recibo devuelto por el banco. Devuelve el limpio.
export function normalizarIban(valor: string): string {
    return valor.replace(/[\s-]/g, '').toUpperCase();
}

export function esIbanValido(iban: string): boolean {
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
    if (iban.startsWith('ES') && iban.length !== 24) return false;
    const reordenado = iban.slice(4) + iban.slice(0, 4);
    let resto = 0;
    for (const caracter of reordenado) {
        const cifras = /[A-Z]/.test(caracter) ? String(caracter.charCodeAt(0) - 55) : caracter;
        for (const cifra of cifras) resto = (resto * 10 + Number(cifra)) % 97;
    }
    return resto === 1;
}

export const iban = type("string").pipe(
    normalizarIban,
    type("string").narrow(esIbanValido).describe("un IBAN válido (revisa los dígitos de control)"),
);

// Código postal (5 dígitos). Vivía suelto como `type(...).matching(...)` dentro
// de auth.schema.ts: nadie podía atarlo a la tabla de shared/casos-identidad.json
// (que sí ata DNI y teléfono), así que el regex del servidor podía cambiar sin
// que ningún test se enterara. Se exporta aquí, con el mismo estilo que los demás.
//
// Se recorta aquí, en el servidor: a diferencia del DNI y el teléfono, el
// formulario no normaliza el código postal antes de enviarlo, así que un
// espacio de más tecleado sin querer («29013 ») llega tal cual. Sin este
// recorte, ese dato correcto chocaba contra un 400 que no explica nada — el
// mismo fallo que cerró esta tarea, pero en un campo más.
export const codigoPostal = type("string").pipe(
    (valor: string) => valor.trim(),
    type("string").matching(/^[0-9]{5}$/).describe("un código postal válido de 5 dígitos"),
);

// 3. DNI/NIE con Validación Matemática Oficial
//
// Normaliza ANTES de comprobar y devuelve el valor limpio, no el que llegó:
// guardar «12345678z» dejaba en la base un DNI que el índice único no
// reconoce como el mismo que «12345678Z». El formulario también normaliza
// (desamparados-web/src/lib/validacion/identidad.ts), pero el servidor no
// puede fiarse del cliente. Mismo patrón que codigoPostal: .pipe() con dos
// argumentos, porque encadenar .narrow() tras un .pipe() de un solo
// argumento revienta en arktype 2.1.29 («Pattern operand must be a string
// (was a morph)»).
//
// Normalizar es también completar: los DNI antiguos empiezan por ceros que
// casi nadie escribe («123456S» es el 00123456S, con su letra bien), y los NIE
// antiguos llevan ocho cifras tras la X, la primera un cero de relleno. Antes
// se rechazaban; la letra se sigue comprobando igual. Fuera también puntos y
// cualquier otro separador: «12.345.678-Z» es como sale en muchos papeles.
const LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE";

export function normalizarDni(valor: string): string {
    const limpio = valor.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    const dni = /^([0-9]{1,7})([A-Z])$/.exec(limpio);
    if (dni) return dni[1].padStart(8, '0') + dni[2];
    const nie = /^([XYZ])0([0-9]{7}[A-Z])$/.exec(limpio);
    if (nie) return nie[1] + nie[2];
    return limpio;
}

export const dni = type("string").pipe(
    normalizarDni,
    type("string").narrow((str: string) => {
        if (!/^[XYZ0-9][0-9]{7}[A-Z]$/.test(str)) return false;
        const letra = str.slice(-1);
        // En un NIE la letra inicial vale por un dígito: X=0, Y=1, Z=2.
        const numero = parseInt(str.slice(0, -1).replace('X', '0').replace('Y', '1').replace('Z', '2'), 10);
        return letra === LETRAS_DNI[numero % 23];
    }).describe("un DNI/NIE válido con letra correcta"),
);

// ID numérico (para params)
export const idParam = type("string")
    .matching(/^\d+$/)
    .describe("un ID numérico válido");

/**
 * Para esparcir dentro del `query` de cualquier esquema de listado:
 *
 *   type({ query: { ...paginacionQuery, "tipo?": tipoEventoSchema } })
 *
 * Sin declararlos, `validate` los borra en silencio y el extremo sirve siempre
 * la primera página.
 */
export const paginacionQuery = {
    "page?": type("string").matching(/^\d+$/).describe("un número de página"),
    "limit?": type("string").matching(/^\d+$/).describe("un tamaño de página"),
};
/**
 * El `?orden=` de un listado: solo los nombres de su tabla en
 * `domain/ordenacion.ts`. Otro cualquiera es un 400 con la lista de los que
 * valen, no un listado ordenado por lo que caiga.
 */
export const ordenQuery = (tabla: Record<string, unknown>) =>
    type.enumerated(...Object.keys(tabla)).describe(`un orden de estos: ${Object.keys(tabla).join(', ')}`);
