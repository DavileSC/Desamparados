import { type } from 'arktype';
import { email, password, dni, telefono, textoRequerido } from '../config/common';

// Definimos los roles permitidos
const roleType = type("'ADMIN' | 'STAFF' | 'TESORERO'");

export const createStaffSchema = type({
    body: {
        nombre: textoRequerido,
        apellidos: textoRequerido,
        email: email,
        password: password,
        dni: dni,
        telefono: telefono,
        role: roleType,
        "direccion?": "string" // Opcional
    }
});

export const updateStaffSchema = type({
    body: {
        "nombre?": textoRequerido,
        "apellidos?": textoRequerido,
        "email?": email,
        "dni?": dni,
        "telefono?": telefono,
        "role?": roleType,
        "direccion?": "string",
        "password?": password // Opcional en edición
    }
});