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

const fechaDia = type("string").matching(/^\d{4}-\d{2}-\d{2}$/).describe("una fecha AAAA-MM-DD");

// 3. Esquema para la Secretaría (Admin)
// Base + Datos Procesión + Estados Internos
//
// Sin `activo` y sin quitar la baja (null): la edición genérica de la ficha no
// da altas ni bajas. Antes, guardar una errata en una solicitud pendiente la
// activaba sin aprobarla (sin número, con la cuenta cerrada, sin auditoría) y
// una fecha de baja con el interruptor encendido dejaba a alguien de baja pero
// activo. Las altas van por «Aprobar» y «Reactivar»; las bajas, por «Dar de
// baja». `validate` borra en silencio las claves no declaradas, así que un
// cliente viejo que mande `activo` no cambia nada.
export const updateAdminHermanoSchema = type({
    body: baseUpdateBody.and(datosProcesionSchema).and(type({
        "esTitular?": "boolean",
        "numeroHermano?": type("number.integer >= 1").describe("un número de hermano entero mayor que 0"),
        // Secretaría regulariza fichas antiguas: estas dos fechas son las que
        // más se corrigen a mano. La baja solo se corrige en fichas que ya
        // están de baja (lo comprueba el servicio, que conoce el estado).
        "fechaAlta?": fechaDia,
        "fechaBaja?": fechaDia
    }))
});

// 3 bis. Dar de baja desde secretaría. La fecha es opcional (por defecto, hoy):
// se da de baja a quien avisó hace unos días con la fecha en que avisó. El
// cuerpo entero es opcional porque un DELETE sin cuerpo sigue siendo válido.
export const bajaHermanoSchema = type({
    "body?": type({ "fechaBaja?": fechaDia }).or("undefined")
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

// 6. Emancipación desde secretaría: sin contraseña, va un enlace al hermano.
// Quien está en el mostrador no elige la contraseña de otra persona.
export const emancipateByStaffSchema = type({
    body: {
        newEmail: email,
        "newDni?": dni
    }
});