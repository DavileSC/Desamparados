import { type } from 'arktype';
import { dni, textoRequerido, telefono, email, password } from '../config/common';

// ==========================================
// PIEZAS REUTILIZABLES (No exportadas directamente)
// ==========================================

// Datos comunes para procesionar (Privilegio Cofrade)
const datosProcesionSchema = type({
    "tieneTunicaPropia?": "boolean",
    "tunica?": "string",
    "alturaHombro?": "number",
    "puesto?": "string"
});

// El cuerpo base para actualizar (Datos personales básicos)
const baseUpdateBody = type({
    "nombre?": textoRequerido,
    "apellidos?": "string",
    "fechaNacimiento?": type("string").matching(/^\d{4}-\d{2}-\d{2}$/),
    "dni?": dni,
    "telefono?": telefono,
    "email?": email,
    "direccion?": "string",
    "poblacion?": "string",
    "codigoPostal?": "string"
});


// ==========================================
// ESQUEMAS FINALES (Exportados para las rutas)
// ==========================================

// 1. Añadir un perfil dependiente (Hijo / Menor a cargo)
// SIN datos cofrades
export const addProfileSchema = type({
    body: type({
        nombre: textoRequerido,
        "apellidos?": "string",
        fechaNacimiento: type("string").matching(/^\d{4}-\d{2}-\d{2}$/),
        "dni?": dni, 
        "telefono?": telefono,
        "email?": email,
    })
});

// 2. Actualizar mi propio perfil o el de un dependiente
// SIN datos cofrades
export const updateProfileSchema = type({
    body: baseUpdateBody
});

// 3. Esquema para la Secretaría (Admin)
// Base + Datos Procesión + Estados Internos
export const updateAdminHermanoSchema = type({
    body: baseUpdateBody.and(datosProcesionSchema).and(type({
        "activo?": "boolean",
        "esTitular?": "boolean",
        "numeroHermano?": "number" // Opcional, por si manejan antigüedad
    }))
});

// 4. Buscador Total para Secretaría
export const searchHermanoSchema = type({
    query: {
        "q?": "string", // Búsqueda global (nombre, apellidos, DNI, email)
        "tunica?": "string",
        "puesto?": "string",
        "activo?": "'true' | 'false'", // Las URLs siempre envían strings
        "tieneTunicaPropia?": "'true' | 'false'",
        "page?": type("string").matching(/^[1-9]\d*$/), // Número mayor que 0
        "limit?": type("string").matching(/^[1-9]\d*$/)
    }
});

// 5. Emancipación: un dependiente crea su propia cuenta de usuario
export const emancipateSchema = type({
    body: {
        newEmail: email,
        newPassword: password,
        "newDni?": dni
    }
});