import { type } from 'arktype';
import { email, password, dni, textoRequerido, textoOpcional, telefono, idParam, codigoPostal, iban } from '../config/common';

// =================================================================
//  1. ESQUEMAS BASE REUTILIZABLES
// =================================================================

// Datos del adulto responsable (el que se registra, sea tutor o no)
const usuarioSchema = type({
    email: email,
    password: password,
    dni: dni,
    nombre: textoRequerido,
    apellidos: textoRequerido,
    // Por separado, si el formulario los manda así: mandan sobre `apellidos`.
    "primerApellido?": textoRequerido,
    "segundoApellido?": textoOpcional,
    telefono: telefono,
    direccion: textoRequerido,
    poblacion: textoRequerido,
    codigoPostal: codigoPostal,
    "provincia?": textoOpcional,
    "comunidadAutonoma?": textoOpcional,
    "pais?": textoOpcional,
    "boletin?": "boolean",
    "autorizaImagen?": "boolean"
});

// =================================================================
//  2. REGISTRO: UNA FORMA PARA LOS TRES CAMINOS
// =================================================================

const diaNacimiento = type("string")
    .matching(/^\d{4}-\d{2}-\d{2}$/)
    .describe("una fecha de nacimiento válida (YYYY-MM-DD)");

const diaBautismo = type("string")
    .matching(/^\d{4}-\d{2}-\d{2}$/)
    .describe("una fecha de bautismo válida (YYYY-MM-DD)");

/**
 * La ficha propia de quien se hace hermano. Sexo, estado civil y fecha de
 * bautismo son obligatorios en el alta; dónde y en qué parroquia, no. Que el
 * bautismo no sea anterior al nacimiento ni futuro lo mira el servicio.
 */
const titularSchema = type({
    fechaNacimiento: diaNacimiento,
    sexo: "'HOMBRE' | 'MUJER'",
    estadoCivil: "'SOLTERO' | 'CASADO' | 'PAREJA_DE_HECHO' | 'SEPARADO' | 'DIVORCIADO' | 'VIUDO'",
    fechaBautismo: diaBautismo,
    "lugarBautismo?": textoOpcional,
    "parroquiaBautismo?": textoOpcional
});

/**
 * Cómo se paga la cuota (anual). Domiciliada, con el IBAN y quién es el
 * titular de la cuenta; o en Secretaría, sin datos bancarios. Que la
 * domiciliación traiga su IBAN, y el nombre del titular cuando no es quien
 * se apunta, lo comprueba el servicio: aquí son todos opcionales.
 */
const pagoSchema = type({
    forma: "'DOMICILIACION' | 'EFECTIVO'",
    "iban?": iban,
    "titularidad?": "'PROPIA' | 'FAMILIAR_HERMANO' | 'OTRA_PERSONA'",
    "titularCuenta?": textoOpcional
});

/**
 * Qué es el menor para quien lo apunta. No siempre es su hijo: un tío, un
 * abuelo o un padrino pueden ser su tutor a efectos de la cofradía, y a
 * Secretaría le hace falta saberlo para pedir la autorización de los padres.
 */
export const PARENTESCOS = ['HIJO', 'SOBRINO', 'NIETO', 'AHIJADO', 'OTRO'] as const;
export type ParentescoAlta = (typeof PARENTESCOS)[number];

/**
 * Un menor a cargo del adulto que se registra. El DNI y el correo son
 * opcionales **a propósito**: un niño de siete años no tiene ninguno de los
 * dos, pero uno de quince ya suele tener ambos, y obligar a dejarlos en blanco
 * dejaría fuera a media adolescencia. La edad no se comprueba aquí sino en el
 * servicio (`comprobarEsMenor`), que es quien sabe qué día es hoy.
 */
const menorSchema = type({
    nombre: textoRequerido,
    "apellidos?": "string",  // Sin ellos se heredan los del adulto: ver auth.service
    "primerApellido?": textoRequerido,
    "segundoApellido?": textoOpcional,
    "dni?": dni,             // Si viene, pasa por la validación de la letra
    "email?": email,
    "parentesco?": "'HIJO' | 'SOBRINO' | 'NIETO' | 'AHIJADO' | 'OTRO'",
    fechaNacimiento: diaNacimiento
});

/**
 * Tantos menores como caben en un alta. El tope existe para que un solo envío
 * no pueda sembrar fichas sin límite; ocho es más de lo que ninguna familia
 * apunta de una vez.
 */
export const MAXIMO_MENORES_POR_ALTA = 8;

/**
 * Los tres caminos del alta, sin discriminador artificial: lo que se pide
 * describe a quién se está apuntando.
 *
 *  - Solo `titular`             → un adulto que se hace hermano.
 *  - `titular` y `menores`      → y que además apunta a menores a su cargo.
 *  - Solo `menores`             → un adulto que NO se hace hermano y solo
 *                                 apunta a un menor: su cuenta es la de quien
 *                                 lo gestiona.
 *
 * Que venga al menos uno de los dos lo comprueba el servicio, junto al resto de
 * reglas que necesitan mirar la base de datos o el calendario.
 */
export const registerSchema = type({
    body: {
        usuario: usuarioSchema,
        "titular?": titularSchema,
        // Opcional solo para las webs de antes de pedirlo: sin él, en Secretaría.
        "pago?": pagoSchema,
        "menores?": menorSchema.array().moreThanLength(0).atMostLength(MAXIMO_MENORES_POR_ALTA),
        // El campo trampa para robots. Se admite y se ignora: quien lo rellena
        // recibe la misma respuesta que una persona, pero no se le crea nada.
        // Con tope de longitud para que no sirva de cubo donde volcar texto.
        "comentarioAdicional?": "string <= 200"
    }
});

/**
 * Pedir volver tras una baja. Van los dos datos porque con el DNI solo, el
 * formulario serviría para saber quién está en el censo: el correo no se
 * comprueba contra nada, pero deja constancia de quién dice ser y hace que
 * probar DNI sueltos no tenga ningún premio (la respuesta es siempre la misma).
 */
export const reactivacionSchema = type({
    body: {
        dni: dni,
        email: email
    }
});


// =================================================================
//  3. ESQUEMAS DE LOGIN Y 2FA
// =================================================================

export const loginSchema = type({
    body: {
        email: email,
        password: type("string >= 1"), // Aquí no limitamos máximo para no dar pistas, solo que no esté vacío
        "recordarme?": "boolean",
        "contexto?": "'cms' | 'hermanos'"
    }
});

// El cuerpo entero es opcional: un POST /logout sin nada cierra las dos áreas.
export const logoutSchema = type({
    "body?": type({ "area?": "'cms' | 'hermanos'" }).or("undefined")
});

// Esquema para validar los 6 dígitos del TOTP
export const totpTokenSchema = type("string").matching(/^[0-9]{6}$/).describe("un código numérico de 6 dígitos");

// Acepta el TOTP (123456) o un código de respaldo (AB2C-DEF4-GH56)
const codigo2FASchema = type("string")
    .matching(/^[0-9]{6}$|^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    .describe("un código TOTP de 6 dígitos o un código de respaldo");

// El usuario ya no viaja en el cuerpo: sale de la cookie del primer factor.
export const verify2FASchema = type({
    body: {
        token2fa: codigo2FASchema
    }
});

export const enable2FASchema = type({
    body: {
        token2fa: totpTokenSchema
    }
});

export const disable2FASchema = type({
    body: {
        token2fa: codigo2FASchema
    }
});

// =================================================================
//  4. ESQUEMAS DE RECUPERACIÓN DE CONTRASEÑA
// =================================================================

export const requestPasswordResetSchema = type({
    body: {
        email: email // Reutilizamos tu validador base
    }
});

// =================================================================
//  5. RGPD: BORRADO DE LA PROPIA CUENTA
// =================================================================
// Exige la contraseña actual como confirmación de identidad.
export const deleteAccountSchema = type({
    body: {
        password: type("string >= 1").describe("tu contraseña actual")
    }
});
