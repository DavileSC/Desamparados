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

// 3. DNI/NIE con Validación Matemática Oficial
export const dni = type("string")
    .narrow((s) => {
        const str = s.toUpperCase();
        // 1. Validar formato básico
        if (!/^[XYZ0-9][0-9]{7}[A-Z]$/.test(str)) return false;
        
        // 2. Extraer número y letra
        const letra = str.slice(-1);
        // Si es NIE (X, Y, Z), lo convertimos al número correspondiente para la fórmula
        const numeroStr = str.slice(0, -1).replace('X', '0').replace('Y', '1').replace('Z', '2');
        const numero = parseInt(numeroStr, 10);
        
        // 3. Calcular módulo 23
        const letrasValidas = "TRWAGMYFPDXBNJZSQVHLCKE";
        const letraCalculada = letrasValidas[numero % 23];
        
        return letra === letraCalculada;
    })
    .describe("un DNI/NIE válido con letra correcta");

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