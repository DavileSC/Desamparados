import { type } from 'arktype';

// --- TIPOS REUTILIZABLES CON MENSAJES EN ESPAÑOL ---

// 1. Texto obligatorio SIN caracteres HTML (Prevención XSS)
export const textoRequerido = type("string")
    .narrow((s) => s.trim().length > 0)
    .matching(/^[^<>]+$/) // Prohíbe inyección de etiquetas HTML
    .describe("un texto válido sin caracteres especiales (<, >)");

// Email con validación regex estándar (Perfecto como estaba)
export const email = type("string")
    .matching(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    .describe("un email válido");

// 2. Contraseña con límite máximo (Prevención DoS en Bcrypt)
export const password = type("string >= 8 & string <= 64")
    .describe("una contraseña entre 8 y 64 caracteres");

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