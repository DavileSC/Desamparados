import { type } from 'arktype';
import { email, password, dni, textoRequerido, telefono, idParam } from '../config/common';

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
    telefono: telefono,
    direccion: textoRequerido,
    poblacion: textoRequerido,
    codigoPostal: type("string").matching(/^[0-9]{5}$/).describe("un código postal válido de 5 dígitos")
});

// =================================================================
//  2. LÓGICA CONDICIONAL DE REGISTRO (Unión Discriminada)
// =================================================================

// CASO A: Es un Tutor dando de alta a un hermano/menor
const registroTutor = type({
    isTutor: "true", // literal 'true'
    usuario: usuarioSchema,
    hermano: type({
        nombre: textoRequerido,
        "apellidos?": "string", // Opcional (si no viene, tu controlador coge el del usuario)
        "dni?": dni,            // Opcional, pero si viene, pasa por la validación matemática
        fechaNacimiento: type("string").matching(/^\d{4}-\d{2}-\d{2}$/).describe("una fecha de nacimiento válida (YYYY-MM-DD)")
    })
});

// CASO B: Es un adulto dándose de alta a sí mismo
// (necesita su fecha de nacimiento para crear su ficha de hermano)
const registroPropio = type({
    isTutor: "false", // literal 'false'
    usuario: usuarioSchema,
    hermano: type({
        fechaNacimiento: type("string").matching(/^\d{4}-\d{2}-\d{2}$/).describe("una fecha de nacimiento válida (YYYY-MM-DD)")
    })
});

// Esquema final de Registro (Acepta A o B)
export const registerSchema = type({
    body: registroTutor.or(registroPropio)
});


// =================================================================
//  3. ESQUEMAS DE LOGIN Y 2FA
// =================================================================

export const loginSchema = type({
    body: {
        email: email,
        password: type("string >= 1") // Aquí no limitamos máximo para no dar pistas, solo que no esté vacío
    }
});

// Esquema para validar los 6 dígitos del TOTP
export const totpTokenSchema = type("string").matching(/^[0-9]{6}$/).describe("un código numérico de 6 dígitos");

// Acepta el TOTP (123456) o un código de respaldo (AB2C-DEF4-GH56)
const codigo2FASchema = type("string")
    .matching(/^[0-9]{6}$|^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    .describe("un código TOTP de 6 dígitos o un código de respaldo");

export const verify2FASchema = type({
    body: {
        userId: type("number"),
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

export const resetPasswordSchema = type({
    body: {
        token: type("string > 0").describe("un token de recuperación válido"),
        newPassword: password // Reutilizamos tu validador de contraseñas seguras
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
