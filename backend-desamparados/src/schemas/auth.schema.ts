import { type } from 'arktype';
import { email, password, dni, textoRequerido, textoOpcional, telefono, idParam, codigoPostal, iban } from '../config/common';
import { esEndpointDePush } from '../domain/aprobacion-entrada';

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
 * Un menor a cargo del adulto que se registra. El DNI y el correo son
 * opcionales **a propósito**: un niño de siete años no tiene ninguno de los
 * dos, pero uno de quince ya suele tener ambos, y obligar a dejarlos en blanco
 * dejaría fuera a media adolescencia. La edad no se comprueba aquí sino en el
 * servicio (`comprobarEsMenor`), que es quien sabe qué día es hoy.
 */
const menorSchema = type({
    nombre: textoRequerido,
    "apellidos?": textoOpcional,  // Sin ellos se heredan los del adulto: ver auth.service
    "primerApellido?": textoRequerido,
    "segundoApellido?": textoOpcional,
    "dni?": dni,             // Si viene, pasa por la validación de la letra
    "email?": email,
    // Qué es el menor para quien lo apunta. No siempre es su hijo: un tío, un abuelo
    // o un padrino pueden ser su tutor, y Secretaría pide con ello la autorización de los padres.
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

// El id de un móvil apuntado (MovilApuntado.id) y su clave: 32 bytes en
// base64url, que solo guarda el móvil.
const dispositivo = type("number.integer > 0").describe("el número de un móvil apuntado");
const claveDelMovil = type("string").matching(/^[A-Za-z0-9_-]{43}$/).describe("la clave de este móvil");

export const loginSchema = type({
    body: {
        email: email,
        password: type("string >= 1"), // Aquí no limitamos máximo para no dar pistas, solo que no esté vacío
        "recordarme?": "boolean",
        "contexto?": "'cms' | 'hermanos'",
        // Si se entra desde un móvil apuntado: no se le manda el aviso a sí mismo.
        "dispositivo?": dispositivo
    }
});

// El cuerpo entero es opcional: un POST /logout sin nada cierra las dos áreas.
export const logoutSchema = type({
    "body?": type({ "area?": "'cms' | 'hermanos'" }).or("undefined")
});

// Esquema para validar los 6 dígitos del TOTP
const totpTokenSchema = type("string").matching(/^[0-9]{6}$/).describe("un código numérico de 6 dígitos");

// Acepta el TOTP (123456) o un código de respaldo (AB2C-DEF4-GH56). También en
// minúsculas, sin guiones o con espacios: el servicio lo normaliza
// (normalizarCodigo2FA) antes de comparar.
const codigo2FASchema = type("string")
    .matching(/^\s*(?:[0-9]{3}\s?[0-9]{3}|[A-Z2-9]{4}[-\s]?[A-Z2-9]{4}[-\s]?[A-Z2-9]{4})\s*$/i)
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
        email: email, // Reutilizamos tu validador base
        // Desde qué acceso se pide: el enlace del correo vuelve a ese mismo.
        "contexto?": "'cms' | 'hermanos'"
    }
});

// =================================================================
//  5. RGPD: BORRADO DE LA PROPIA CUENTA
// =================================================================
// Exige la contraseña actual como confirmación de identidad.
/**
 * Cambiar la contraseña con la sesión abierta. La nueva, con las mismas reglas
 * que el enlace de recuperación; la actual solo tiene que venir (y no pasar
 * del tope de bcrypt, que corta en 72 bytes y no merece más).
 */
export const cambiarContrasenaSchema = type({
    body: {
        actual: type("1 <= string <= 128").describe("tu contraseña actual"),
        nueva: password
    }
});

export const deleteAccountSchema = type({
    body: {
        password: type("string >= 1").describe("tu contraseña actual")
    }
});

// =================================================================
//  6. APROBAR LA ENTRADA DESDE EL MÓVIL
// =================================================================

/**
 * Apuntar este móvil: la contraseña (es una acción sensible), un nombre para
 * reconocerlo y la suscripción tal como la da `PushSubscription.toJSON()`.
 * El endpoint, solo de un servicio de push conocido: el servidor le hace un
 * POST, y no puede ser una dirección cualquiera.
 */
export const apuntarMovilSchema = type({
    body: {
        password: type("1 <= string <= 128").describe("tu contraseña"),
        nombre: textoRequerido.and("string <= 60"),
        suscripcion: {
            endpoint: type("string <= 1000").narrow((url, ctx) => esEndpointDePush(url) || ctx.reject({ problem: 'no es de un servicio de avisos conocido' })),
            "expirationTime?": "number | null",
            keys: {
                p256dh: type("string").matching(/^[A-Za-z0-9_-]{40,200}={0,2}$/),
                auth: type("string").matching(/^[A-Za-z0-9_-]{16,100}={0,2}$/)
            }
        }
    }
});

export const quitarMovilSchema = type({ params: { id: idParam } });

// El id de una aprobación: 16 bytes aleatorios en base64url.
const idDeAprobacion = type("string").matching(/^[A-Za-z0-9_-]{22}$/).describe("una aprobación");

/** Lo que manda el móvil para ver o rechazar una aprobación: quién es y su clave. */
export const movilAprobacionSchema = type({
    params: { id: idDeAprobacion },
    body: { dispositivo, clave: claveDelMovil }
});

export const aprobarEntradaSchema = type({
    params: { id: idDeAprobacion },
    body: { dispositivo, clave: claveDelMovil, numero: "10 <= number.integer <= 99" }
});

/** Entrar desde el mismo móvil apuntado: el testigo va en su cookie, como el código. */
export const entrarDesdeEsteMovilSchema = type({
    body: { dispositivo, clave: claveDelMovil }
});
